package com.freshmart.model;

import jakarta.persistence.*;

@Entity
@Table(name = "inventory")
public class Inventory {
    public static final long MAX_QUANTITY = 1_000_000_000L;
    @Id @Column(name = "product_id", length = 36) private String productId;
    @MapsId @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id") private Product product;
    @Column(nullable = false) private long stock;
    @Column(name = "min_stock", nullable = false) private long minStock = 10;

    protected Inventory() {}
    public Inventory(Product product) { this.product = product; }
    public String getProductId() { return productId; }
    public Product getProduct() { return product; }
    public long getStock() { return stock; }
    public long getMinStock() { return minStock; }
    public void setStock(long stock) { this.stock = stock; }
    public void setMinStock(long minStock) { this.minStock = minStock; }
}
