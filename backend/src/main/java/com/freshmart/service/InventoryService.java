package com.freshmart.service;

import com.freshmart.dto.*;
import com.freshmart.model.*;
import com.freshmart.repository.*;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.Valid;

@Service
@Validated
@Transactional(readOnly = true)
public class InventoryService {
    private final InventoryRepository inventory;
    private final StockMovementRepository movements;
    public InventoryService(InventoryRepository inventory, StockMovementRepository movements) {
        this.inventory = inventory; this.movements = movements;
    }
    public List<InventoryResponse> list(String query, String categoryId, StockStatus status) {
        String term = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return inventory.findCatalog().stream().map(InventoryResponse::from)
                .filter(i -> (i.name() + " " + i.sku() + " " + (i.barcode() == null ? "" : i.barcode())).toLowerCase(Locale.ROOT).contains(term))
                .filter(i -> categoryId == null || categoryId.isBlank() || i.categoryId().equals(categoryId))
                .filter(i -> status == null || i.stockStatus() == status).toList();
    }
    public InventorySummary summary() { return InventorySummary.from(list(null, null, null)); }
    public InventoryResponse get(String id) {
        return InventoryResponse.from(inventory.findById(id).orElseThrow(() -> CatalogException.missing("Inventory product")));
    }
    public List<StockMovementResponse> history(String productId) {
        return (productId == null || productId.isBlank() ? movements.findAllByOrderByOccurredAtDescIdDesc()
                : movements.findByProductIdOrderByOccurredAtDescIdDesc(productId))
                .stream().map(StockMovementResponse::from).toList();
    }
    // All callers, including future POS services, must use this transactional operation.
    // The row lock serializes both the quantity check and the update across app instances.
    @Transactional
    public InventoryResponse adjust(String productId, @Valid StockAdjustmentRequest request, UserResponse actor) {
        Inventory item = lock(productId);
        long before = item.getStock();
        long delta = request.type() == StockOperation.STOCK_OUT ? -request.quantity() : request.quantity();
        long after = before + delta;
        if (after < 0) throw new CatalogException(409, "INSUFFICIENT_STOCK", "Only " + before + " units are available. Stock cannot become negative.");
        if (after > Inventory.MAX_QUANTITY) throw new CatalogException(409, "STOCK_LIMIT", "Stock cannot exceed 1,000,000,000 units.");
        item.setStock(after);
        movements.save(new StockMovement(item, request.type().name(), request.quantity(), before, item.getMinStock(), request.reason(), actor));
        inventory.flush();
        return InventoryResponse.from(item);
    }
    @Transactional
    public InventoryResponse threshold(String productId, @Valid StockThresholdRequest request, UserResponse actor) {
        Inventory item = lock(productId);
        long before = item.getMinStock();
        if (before != request.minStock()) {
            item.setMinStock(request.minStock());
            movements.save(new StockMovement(item, "THRESHOLD", 0, item.getStock(), before, "Low-stock threshold updated", actor));
            inventory.flush();
        }
        return InventoryResponse.from(item);
    }
    private Inventory lock(String id) {
        return inventory.lockByProductId(id).orElseThrow(() -> CatalogException.missing("Inventory product"));
    }
}
