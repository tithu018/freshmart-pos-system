package com.freshmart.model;

import com.freshmart.dto.ProductRequest;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "products")
public class Product {
    @Id @Column(length = 36) private String id = UUID.randomUUID().toString();
    @Column(nullable = false, length = 80) private String name;
    @Column(nullable = false, unique = true, length = 30) private String sku;
    @Column(unique = true, length = 64) private String barcode;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false) private Category category;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal price;
    @Column(nullable = false, length = 1000) private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private CatalogStatus status;
    @Column(nullable = false, length = 30) private String unit;
    @Column(nullable = false, length = 16) private String icon;
    @Column(nullable = false, length = 16) private String color;

    protected Product() {}
    public Product(ProductRequest request, Category category) { update(request, category); }
    public void update(ProductRequest request, Category category) {
        name = request.name(); sku = request.sku(); barcode = request.barcode();
        this.category = category; price = request.price(); description = request.description();
        status = request.status(); unit = request.unit(); icon = request.icon(); color = request.color();
    }
    public String getId() { return id; }
    public String getName() { return name; }
    public String getSku() { return sku; }
    public String getBarcode() { return barcode; }
    public Category getCategory() { return category; }
    public BigDecimal getPrice() { return price; }
    public String getDescription() { return description; }
    public CatalogStatus getStatus() { return status; }
    public String getUnit() { return unit; }
    public String getIcon() { return icon; }
    public String getColor() { return color; }
}
