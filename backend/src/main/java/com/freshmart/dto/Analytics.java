package com.freshmart.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class Analytics {
    private Analytics() {}
    public record Range(LocalDate from, LocalDate to, String timeZone) {}
    public record Summary(long orders, BigDecimal revenue, BigDecimal subtotal, BigDecimal discounts,
            BigDecimal taxes, long units, BigDecimal average) {}
    public record Point(String label, long orders, BigDecimal revenue) {}
    public record Payment(String method, long orders, BigDecimal revenue) {}
    // Product revenue is the historical line total, before order discounts and taxes.
    public record Product(String id, String name, String sku, long quantity, BigDecimal revenue) {}
    public record Cashier(String id, String name, long orders, BigDecimal revenue,
            BigDecimal discounts, BigDecimal taxes, BigDecimal average) {}
    public record Alert(String id, String name, String sku, long stock, long minStock) {}
    public record Inventory(long products, long lowStock, long outOfStock, List<Alert> alerts) {}
    public record Report(Range range, Summary summary, List<Point> daily, List<Payment> payments,
            List<Product> topByQuantity, List<Product> topByRevenue, List<Cashier> cashiers) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Dashboard(Range range, Summary today, Summary summary, List<Point> activity,
            List<Point> weekly, List<Payment> payments, List<SalesPage.Row> recent,
            List<Product> topProducts, Inventory inventory) {}
}
