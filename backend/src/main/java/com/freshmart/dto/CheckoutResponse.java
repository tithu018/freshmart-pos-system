package com.freshmart.dto;

import com.freshmart.model.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record CheckoutResponse(String id, Instant occurredAt, String userId, String userName,
        PaymentMethod payment, BigDecimal subtotal, BigDecimal discount, BigDecimal taxRate,
        BigDecimal tax, BigDecimal total, List<Item> items) {
    public record Item(String productId, String name, String sku, BigDecimal price, long quantity, BigDecimal lineTotal) {}
    public static CheckoutResponse from(Sale sale) {
        return new CheckoutResponse(sale.getId(), sale.getOccurredAt(), sale.getUserId(), sale.getUserName(),
                sale.getPayment(), sale.getSubtotal(), sale.getDiscount(), sale.getTaxRate(), sale.getTax(), sale.getTotal(),
                sale.getItems().stream().map(i -> new Item(i.getProductId(), i.getProductName(), i.getSku(),
                        i.getUnitPrice(), i.getQuantity(), i.getLineTotal())).toList());
    }
}
