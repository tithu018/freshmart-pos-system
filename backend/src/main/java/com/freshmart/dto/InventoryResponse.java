package com.freshmart.dto;

import com.freshmart.model.*;
import java.math.BigDecimal;

public record InventoryResponse(String id, String name, String sku, String barcode, String categoryId,
        String category, BigDecimal price, String unit, String icon, String color, CatalogStatus productStatus,
        long stock, long minStock, StockStatus stockStatus) {
    public static InventoryResponse from(Inventory inventory) {
        var p = inventory.getProduct();
        return new InventoryResponse(p.getId(), p.getName(), p.getSku(), p.getBarcode(),
                p.getCategory().getId(), p.getCategory().getName(), p.getPrice(), p.getUnit(), p.getIcon(),
                p.getColor(), p.getStatus(), inventory.getStock(), inventory.getMinStock(), StockStatus.of(inventory));
    }
}
