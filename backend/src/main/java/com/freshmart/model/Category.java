package com.freshmart.model;

import com.freshmart.dto.CategoryRequest;
import jakarta.persistence.*;
import java.util.Locale;
import java.util.UUID;

@Entity
@Table(name = "categories")
public class Category {
    @Id @Column(length = 36) private String id = UUID.randomUUID().toString();
    @Column(nullable = false, length = 50) private String name;
    @Column(name = "name_key", nullable = false, unique = true, length = 50) private String nameKey;
    @Column(nullable = false, length = 120) private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private CatalogStatus status;
    @Column(nullable = false, length = 16) private String icon;
    @Column(nullable = false, length = 16) private String color;

    protected Category() {}
    public Category(CategoryRequest request) { update(request); }
    public void update(CategoryRequest request) {
        name = request.name();
        nameKey = name.toLowerCase(Locale.ROOT);
        description = request.description();
        status = request.status();
        icon = request.icon();
        color = request.color();
    }
    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public CatalogStatus getStatus() { return status; }
    public String getIcon() { return icon; }
    public String getColor() { return color; }
}
