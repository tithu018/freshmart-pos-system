package com.freshmart.model;

import com.freshmart.dto.InventoryResponse;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "sale_items")
public class SaleItem {
    @Id @Column(length = 36) private String id = UUID.randomUUID().toString();
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "sale_id") private Sale sale;
    @Column(name = "product_id", nullable = false, length = 36) private String productId;
    @Column(name = "product_name", nullable = false, length = 80) private String productName;
    @Column(nullable = false, length = 30) private String sku;
    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2) private BigDecimal unitPrice;
    @Column(nullable = false) private long quantity;
    @Column(name = "line_total", nullable = false, precision = 18, scale = 2) private BigDecimal lineTotal;
    protected SaleItem() {}
    public SaleItem(Sale sale, InventoryResponse product, long quantity) {
        this.sale = sale; productId = product.id(); productName = product.name(); sku = product.sku();
        unitPrice = product.price(); this.quantity = quantity; lineTotal = unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
    public String getProductId() { return productId; }
    public String getProductName() { return productName; }
    public String getSku() { return sku; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public long getQuantity() { return quantity; }
    public BigDecimal getLineTotal() { return lineTotal; }
}
