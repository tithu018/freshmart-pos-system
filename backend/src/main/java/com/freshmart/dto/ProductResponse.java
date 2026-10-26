package com.freshmart.dto;

import com.freshmart.model.Product;
import com.freshmart.model.CatalogStatus;
import java.math.BigDecimal;

public record ProductResponse(String id, String name, String sku, String barcode, String categoryId,
        String category, BigDecimal price, String description, CatalogStatus status,
        String unit, String icon, String color) {
    public static ProductResponse from(Product product) {
        return new ProductResponse(product.getId(), product.getName(), product.getSku(), product.getBarcode(),
                product.getCategory().getId(), product.getCategory().getName(), product.getPrice(),
                product.getDescription(), product.getStatus(), product.getUnit(), product.getIcon(), product.getColor());
    }
}
