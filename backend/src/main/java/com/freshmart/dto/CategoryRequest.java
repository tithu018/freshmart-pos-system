package com.freshmart.dto;

import com.freshmart.model.CatalogStatus;
import jakarta.validation.constraints.*;

public record CategoryRequest(
        @NotBlank @Size(max = 50) String name,
        @Size(max = 120) String description,
        @NotNull CatalogStatus status,
        @NotBlank @Size(max = 16) String icon,
        @NotBlank @Pattern(regexp = "green|blue|amber|rose|purple|orange") String color) {
    public CategoryRequest {
        name = name == null ? null : name.trim();
        description = description == null ? "" : description.trim();
        icon = icon == null ? "📦" : icon;
        color = color == null ? "green" : color;
    }
}
