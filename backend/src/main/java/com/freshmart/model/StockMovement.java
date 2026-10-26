package com.freshmart.model;

import com.freshmart.dto.UserResponse;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "stock_movements")
public class StockMovement {
    @Id @Column(length = 36) private String id = UUID.randomUUID().toString();
    @Column(name = "product_id", nullable = false, length = 36) private String productId;
    @Column(name = "product_name", nullable = false, length = 80) private String productName;
    @Column(nullable = false, length = 30) private String sku;
    @Column(nullable = false, length = 16) private String type;
    @Column(nullable = false) private long quantity;
    @Column(name = "stock_before", nullable = false) private long stockBefore;
    @Column(name = "stock_after", nullable = false) private long stockAfter;
    @Column(name = "threshold_before", nullable = false) private long thresholdBefore;
    @Column(name = "threshold_after", nullable = false) private long thresholdAfter;
    @Column(nullable = false, length = 250) private String reason;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt = Instant.now();
    @Column(name = "user_id", nullable = false, length = 36) private String userId;
    @Column(name = "user_name", nullable = false, length = 100) private String userName;

    protected StockMovement() {}
    public StockMovement(Inventory inventory, String type, long quantity, long stockBefore,
            long thresholdBefore, String reason, UserResponse actor) {
        productId = inventory.getProductId(); productName = inventory.getProduct().getName();
        sku = inventory.getProduct().getSku(); this.type = type; this.quantity = quantity;
        this.stockBefore = stockBefore; stockAfter = inventory.getStock();
        this.thresholdBefore = thresholdBefore; thresholdAfter = inventory.getMinStock();
        this.reason = reason; userId = actor.id(); userName = actor.name();
    }
    public String getId() { return id; }
    public String getProductId() { return productId; }
    public String getProductName() { return productName; }
    public String getSku() { return sku; }
    public String getType() { return type; }
    public long getQuantity() { return quantity; }
    public long getStockBefore() { return stockBefore; }
    public long getStockAfter() { return stockAfter; }
    public long getThresholdBefore() { return thresholdBefore; }
    public long getThresholdAfter() { return thresholdAfter; }
    public String getReason() { return reason; }
    public Instant getOccurredAt() { return occurredAt; }
    public String getUserId() { return userId; }
    public String getUserName() { return userName; }
}
