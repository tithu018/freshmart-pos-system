package com.freshmart.repository;

import com.freshmart.dto.Analytics.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.stereotype.Repository;

@Repository
public class AnalyticsRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public AnalyticsRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Filter(Instant from, Instant until, String owner, String zone) {}
    private String where(Filter f) {
        return " s.occurred_at >= :from AND s.occurred_at < :until" +
                (f.owner() == null ? "" : " AND s.user_id = :owner");
    }
    private MapSqlParameterSource params(Filter f) {
        return new MapSqlParameterSource().addValue("from", f.from().atOffset(ZoneOffset.UTC))
                .addValue("until", f.until().atOffset(ZoneOffset.UTC)).addValue("owner", f.owner()).addValue("zone", f.zone());
    }
    private static BigDecimal average(BigDecimal amount, long orders) {
        return orders == 0 ? BigDecimal.ZERO : amount.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP);
    }
    public Summary summary(Filter f) {
        long units = jdbc.queryForObject("SELECT COALESCE(SUM(i.quantity),0) FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE" + where(f), params(f), Long.class);
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue,
                COALESCE(SUM(subtotal),0) AS subtotal, COALESCE(SUM(discount),0) AS discounts,
                COALESCE(SUM(tax),0) AS taxes FROM sales s WHERE
                """ + where(f), params(f), (rs, n) -> new Summary(rs.getLong("orders"), rs.getBigDecimal("revenue"),
                rs.getBigDecimal("subtotal"), rs.getBigDecimal("discounts"), rs.getBigDecimal("taxes"), units,
                average(rs.getBigDecimal("revenue"), rs.getLong("orders"))));
    }
    public List<Point> points(Filter f, boolean hourly) {
        String local = "(s.occurred_at AT TIME ZONE :zone)";
        // Extract local calendar fields explicitly: H2 casts zoned timestamps to DATE
        // in the connection timezone, unlike PostgreSQL's timestamp-without-zone result.
        String bucket = hourly ? "EXTRACT(HOUR FROM " + local + ")"
                : "EXTRACT(YEAR FROM " + local + ") * 10000 + EXTRACT(MONTH FROM " + local
                    + ") * 100 + EXTRACT(DAY FROM " + local + ")";
        return jdbc.query("SELECT " + bucket + " AS bucket, COUNT(*) AS orders, SUM(total) AS revenue FROM sales s WHERE" +
                where(f) + " GROUP BY bucket ORDER BY bucket", params(f),
                (rs, n) -> {
                    int key = rs.getInt("bucket");
                    String label = hourly ? Integer.toString(key) : LocalDate.of(key / 10000, key / 100 % 100, key % 100).toString();
                    return new Point(label, rs.getLong("orders"), rs.getBigDecimal("revenue"));
                });
    }
    public List<Payment> payments(Filter f) {
        var rows = jdbc.query("SELECT payment, COUNT(*) AS orders, SUM(total) AS revenue FROM sales s WHERE" + where(f) + " GROUP BY payment",
                params(f), (rs, n) -> new Payment(rs.getString("payment"), rs.getLong("orders"), rs.getBigDecimal("revenue")));
        return List.of("CASH", "CARD").stream().map(method -> rows.stream().filter(p -> p.method().equals(method))
                .findFirst().orElse(new Payment(method, 0, BigDecimal.ZERO))).toList();
    }
    public List<Product> products(Filter f, boolean byQuantity) {
        return jdbc.query("""
                SELECT i.product_id, MAX(i.product_name) AS name, MAX(i.sku) AS sku,
                SUM(i.quantity) AS quantity, SUM(i.line_total) AS revenue
                FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE
                """ + where(f) + " GROUP BY i.product_id ORDER BY " + (byQuantity ? "quantity DESC, revenue DESC" : "revenue DESC, quantity DESC")
                + ", i.product_id LIMIT 10", params(f), (rs, n) -> new Product(rs.getString("product_id"), rs.getString("name"),
                rs.getString("sku"), rs.getLong("quantity"), rs.getBigDecimal("revenue")));
    }
    public List<Cashier> cashiers(Filter f) {
        return jdbc.query("""
                SELECT user_id, MAX(user_name) AS name, COUNT(*) AS orders, SUM(total) AS revenue,
                SUM(discount) AS discounts, SUM(tax) AS taxes FROM sales s WHERE
                """ + where(f) + " GROUP BY user_id ORDER BY revenue DESC, user_id", params(f),
                (rs, n) -> new Cashier(rs.getString("user_id"), rs.getString("name"), rs.getLong("orders"), rs.getBigDecimal("revenue"),
                        rs.getBigDecimal("discounts"), rs.getBigDecimal("taxes"), average(rs.getBigDecimal("revenue"), rs.getLong("orders"))));
    }
    public Inventory inventory() {
        var alerts = jdbc.query("""
                SELECT p.id, p.name, p.sku, i.stock, i.min_stock FROM products p JOIN inventory i ON i.product_id=p.id
                WHERE i.stock=0 OR i.stock<i.min_stock ORDER BY i.stock, p.name, p.id LIMIT 5
                """, (rs, n) -> new Alert(rs.getString("id"), rs.getString("name"), rs.getString("sku"), rs.getLong("stock"), rs.getLong("min_stock")));
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS products,
                COALESCE(SUM(CASE WHEN i.stock>0 AND i.stock<i.min_stock THEN 1 ELSE 0 END),0) AS low_stock,
                COALESCE(SUM(CASE WHEN i.stock=0 THEN 1 ELSE 0 END),0) AS out_of_stock
                FROM products p JOIN inventory i ON i.product_id=p.id
                """, new MapSqlParameterSource(), (rs, n) -> new Inventory(rs.getLong("products"), rs.getLong("low_stock"), rs.getLong("out_of_stock"), alerts));
    }
}
