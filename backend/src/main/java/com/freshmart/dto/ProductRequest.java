package com.freshmart.dto;

import com.freshmart.model.CatalogStatus;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Locale;

public record ProductRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 30) String sku,
        @Size(max = 64) String barcode,
        @NotBlank @Size(max = 36) String categoryId,
        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal price,
        @Size(max = 1000) String description,
        @NotNull CatalogStatus status,
        @NotBlank @Size(max = 30) String unit,
        @NotBlank @Size(max = 16) String icon,
        @NotBlank @Pattern(regexp = "green|blue|amber|rose|purple|orange") String color) {
    public ProductRequest {
        name = name == null ? null : name.trim();
        sku = sku == null ? null : sku.trim().toUpperCase(Locale.ROOT);
        barcode = barcode == null || barcode.isBlank() ? null : barcode.trim();
        description = description == null ? "" : description.trim();
        unit = unit == null ? "each" : unit.trim();
        icon = icon == null ? "📦" : icon;
        color = color == null ? "green" : color;
    }
}
