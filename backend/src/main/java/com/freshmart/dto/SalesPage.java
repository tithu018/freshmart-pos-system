package com.freshmart.dto;

import com.freshmart.model.PaymentMethod;
import com.freshmart.model.Sale;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record SalesPage(List<Row> content, int page, int size, long totalElements, long totalPages,
        Summary summary, String timeZone) {
    public record Row(String id, Instant occurredAt, String userId, String userName,
            PaymentMethod payment, long quantity, BigDecimal total) {
        public static Row from(Sale sale, long quantity) {
            return new Row(sale.getId(), sale.getOccurredAt(), sale.getUserId(), sale.getUserName(),
                    sale.getPayment(), quantity, sale.getTotal());
        }
    }
    public record Summary(long orders, BigDecimal revenue, BigDecimal average, long units, long cash, long card) {}
    public record Cashier(String id, String name) {}
}
