package com.freshmart.model;

import com.freshmart.dto.UserResponse;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sales")
public class Sale {
    @Id @Column(length = 36) private String id = UUID.randomUUID().toString();
    @Column(name = "idempotency_key", nullable = false, unique = true, length = 36) private String idempotencyKey;
    @Column(name = "request_hash", nullable = false, length = 64) private String requestHash;
    @Column(name = "user_id", nullable = false, length = 36) private String userId;
    @Column(name = "user_name", nullable = false, length = 100) private String userName;
    @Column(name = "customer_id", length = 36) private String customerId;
    @Column(name = "customer_name", length = 100) private String customerName;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private PaymentMethod payment;
    @Column(nullable = false, precision = 18, scale = 2) private BigDecimal subtotal = BigDecimal.ZERO;
    @Column(nullable = false, precision = 18, scale = 2) private BigDecimal discount = BigDecimal.ZERO;
    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 2) private BigDecimal taxRate;
    @Column(nullable = false, precision = 18, scale = 2) private BigDecimal tax = BigDecimal.ZERO;
    @Column(nullable = false, precision = 18, scale = 2) private BigDecimal total = BigDecimal.ZERO;
    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL) @OrderBy("productId ASC")
    private List<SaleItem> items = new ArrayList<>();

    protected Sale() {}
    public Sale(String key, String hash, UserResponse actor, PaymentMethod payment, BigDecimal rate) {
        idempotencyKey = key; requestHash = hash; userId = actor.id(); userName = actor.name();
        this.payment = payment; taxRate = rate;
    }
    public void addItem(SaleItem item) { items.add(item); }
    public void customer(Customer customer) { customerId = customer.getId(); customerName = customer.getName(); }
    public String getCustomerId() { return customerId; }
    public String getCustomerName() { return customerName; }
    public void totals(BigDecimal subtotal, BigDecimal discount, BigDecimal tax) {
        this.subtotal = subtotal; this.discount = discount; this.tax = tax;
        total = subtotal.subtract(discount).add(tax);
    }
    public String getId() { return id; }
    public String getRequestHash() { return requestHash; }
    public String getUserId() { return userId; }
    public String getUserName() { return userName; }
    public Instant getOccurredAt() { return occurredAt; }
    public PaymentMethod getPayment() { return payment; }
    public BigDecimal getSubtotal() { return subtotal; }
    public BigDecimal getDiscount() { return discount; }
    public BigDecimal getTaxRate() { return taxRate; }
    public BigDecimal getTax() { return tax; }
    public BigDecimal getTotal() { return total; }
    public List<SaleItem> getItems() { return items; }
}
