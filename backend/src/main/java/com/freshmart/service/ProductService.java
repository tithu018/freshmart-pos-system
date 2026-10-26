package com.freshmart.service;

import com.freshmart.dto.*;
import com.freshmart.model.*;
import com.freshmart.repository.ProductRepository;
import com.freshmart.repository.InventoryRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductService {
    private final ProductRepository products;
    private final CategoryService categories;
    private final InventoryRepository inventory;
    public ProductService(ProductRepository products, CategoryService categories, InventoryRepository inventory) {
        this.products = products; this.categories = categories; this.inventory = inventory;
    }
    public List<ProductResponse> list(String query, String categoryId, CatalogStatus status) {
        String term = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String pattern = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return products.findAll((root, cq, cb) -> {
            root.fetch("category");
            var filters = new ArrayList<Predicate>();
            if (!term.isEmpty()) filters.add(cb.or(
                    cb.like(cb.lower(root.get("name")), pattern, '\\'),
                    cb.like(cb.lower(root.get("sku")), pattern, '\\'),
                    cb.like(cb.lower(root.get("barcode")), pattern, '\\'),
                    cb.like(cb.lower(root.get("description")), pattern, '\\')));
            if (categoryId != null && !categoryId.isBlank()) filters.add(cb.equal(root.get("category").get("id"), categoryId));
            if (status != null) filters.add(cb.equal(root.get("status"), status));
            return cb.and(filters.toArray(Predicate[]::new));
        }, Sort.by("name").ascending().and(Sort.by("id"))).stream().map(ProductResponse::from).toList();
    }
    public ProductResponse get(String id) { return ProductResponse.from(require(id)); }
    private Product require(String id) {
        return products.findById(id).orElseThrow(() -> CatalogException.missing("Product"));
    }
    @Transactional
    public ProductResponse save(String id, ProductRequest request) {
        Product product = id == null ? new Product(request, categories.require(request.categoryId())) : require(id);
        if (products.existsBySkuAndIdNot(request.sku(), product.getId()))
            throw new CatalogException(409, "DUPLICATE_SKU", "A product with this SKU already exists.");
        if (request.barcode() != null && products.existsByBarcodeAndIdNot(request.barcode(), product.getId()))
            throw new CatalogException(409, "DUPLICATE_BARCODE", "A product with this barcode already exists.");
        product.update(request, categories.require(request.categoryId()));
        Product saved = products.saveAndFlush(product);
        if (id == null) inventory.saveAndFlush(new Inventory(saved));
        return ProductResponse.from(saved);
    }
    @Transactional
    public void delete(String id) {
        Product product = require(id);
        var stock = inventory.lockByProductId(id);
        if (stock.isPresent() && stock.get().getStock() > 0)
            throw new CatalogException(409, "PRODUCT_HAS_STOCK", "Remove the remaining stock before deleting this product.");
        // Remove the managed @MapsId child before its parent so Hibernate cannot
        // re-persist the product through the inventory association during flush.
        stock.ifPresent(inventory::delete);
        inventory.flush();
        products.delete(product); products.flush();
    }
}
