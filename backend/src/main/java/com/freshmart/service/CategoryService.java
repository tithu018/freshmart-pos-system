package com.freshmart.service;

import com.freshmart.dto.*;
import com.freshmart.model.Category;
import com.freshmart.repository.*;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CategoryService {
    private final CategoryRepository categories;
    private final ProductRepository products;
    public CategoryService(CategoryRepository categories, ProductRepository products) {
        this.categories = categories; this.products = products;
    }
    public List<CategoryResponse> list(String query) {
        String term = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        var counts = products.countByCategory().stream().collect(Collectors.toMap(
                ProductRepository.CategoryCount::getCategoryId, ProductRepository.CategoryCount::getTotal));
        return categories.findAllByOrderByNameAsc().stream()
                .filter(c -> (c.getName() + " " + c.getDescription()).toLowerCase(Locale.ROOT).contains(term))
                .map(c -> CategoryResponse.from(c, counts.getOrDefault(c.getId(), 0L))).toList();
    }
    public CategoryResponse get(String id) { return CategoryResponse.from(require(id), products.countByCategoryId(id)); }
    public Category require(String id) {
        return categories.findById(id).orElseThrow(() -> CatalogException.missing("Category"));
    }
    @Transactional
    public CategoryResponse save(String id, CategoryRequest request) {
        Category category = id == null ? new Category(request) : require(id);
        if (categories.existsByNameKeyAndIdNot(request.name().toLowerCase(Locale.ROOT), category.getId()))
            throw new CatalogException(409, "DUPLICATE_CATEGORY", "A category with this name already exists.");
        category.update(request);
        categories.saveAndFlush(category);
        return CategoryResponse.from(category, products.countByCategoryId(category.getId()));
    }
    @Transactional
    public void delete(String id) {
        Category category = require(id);
        if (products.existsByCategoryId(id))
            throw new CatalogException(409, "CATEGORY_IN_USE", "This category is used by products. Reassign or delete those products first.");
        categories.delete(category);
        categories.flush(); // The foreign key also protects against concurrent product creation.
    }
}
