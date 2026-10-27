package com.freshmart.repository;

import com.freshmart.dto.People.*;
import java.util.*;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.stereotype.Repository;

@Repository
public class CustomerHistoryRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public CustomerHistoryRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }
    private static final String SELECT = "SELECT c.id,c.name,c.phone,c.email,c.enabled,c.created_at,COUNT(s.id) AS visits,COALESCE(SUM(s.total),0) AS spent FROM customers c LEFT JOIN sales s ON s.customer_id=c.id ";
    private static final String GROUP = " GROUP BY c.id,c.name,c.phone,c.email,c.enabled,c.created_at ";
    private final RowMapper<Customer> mapper = (rs, n) -> new Customer(rs.getString("id"), rs.getString("name"), rs.getString("phone"), rs.getString("email"),
            rs.getBoolean("enabled"), rs.getTimestamp("created_at").toInstant(), rs.getLong("visits"), rs.getBigDecimal("spent"));
    public Page<Customer> list(String pattern, Boolean enabled, int page, int size) {
        String where = " WHERE (LOWER(c.name) LIKE :q ESCAPE '\\' OR c.phone LIKE :q ESCAPE '\\' OR LOWER(c.email) LIKE :q ESCAPE '\\')" + (enabled == null ? "" : " AND c.enabled=:enabled");
        var params = new MapSqlParameterSource("q", pattern).addValue("enabled", enabled).addValue("limit", size).addValue("offset", page * size);
        var rows = jdbc.query(SELECT + where + GROUP + " ORDER BY c.name,c.id LIMIT :limit OFFSET :offset", params, mapper);
        long count = jdbc.queryForObject("SELECT COUNT(*) FROM customers c" + where, params, Long.class);
        var summary = jdbc.queryForObject("""
                SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN enabled THEN 1 ELSE 0 END),0) AS active,
                (SELECT COALESCE(SUM(total),0) FROM sales WHERE customer_id IS NOT NULL) AS spending FROM customers
                """, Map.of(), (rs,n) -> new Summary(rs.getLong("total"), rs.getLong("active"), 0, rs.getBigDecimal("spending")));
        return new Page<>(rows, page, size, count, summary);
    }
    public Customer get(String id) { return jdbc.queryForObject(SELECT + " WHERE c.id=:id" + GROUP, Map.of("id", id), mapper); }
    public List<CustomerOption> lookup(String pattern) {
        return jdbc.query("SELECT id,name,phone FROM customers WHERE enabled=true AND (LOWER(name) LIKE :q ESCAPE '\\' OR phone LIKE :q ESCAPE '\\') ORDER BY name,id LIMIT 20",
                Map.of("q", pattern), (rs,n) -> new CustomerOption(rs.getString("id"), rs.getString("name"), rs.getString("phone")));
    }
}
