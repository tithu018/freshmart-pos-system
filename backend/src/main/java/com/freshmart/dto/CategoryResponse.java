package com.freshmart.dto;

import com.freshmart.model.Category;
import com.freshmart.model.CatalogStatus;

public record CategoryResponse(String id, String name, String description, CatalogStatus status,
        String icon, String color, long productCount) {
    public static CategoryResponse from(Category category, long productCount) {
        return new CategoryResponse(category.getId(), category.getName(), category.getDescription(),
                category.getStatus(), category.getIcon(), category.getColor(), productCount);
    }
}
