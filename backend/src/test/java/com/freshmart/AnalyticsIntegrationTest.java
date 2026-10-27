package com.freshmart;

import com.fasterxml.jackson.databind.*;
import com.freshmart.dto.UserResponse;
import com.freshmart.model.*;
import com.freshmart.repository.UserRepository;
import com.freshmart.repository.AnalyticsRepository;
import com.freshmart.repository.SalesHistoryRepository;
import com.freshmart.security.*;
import com.freshmart.service.AnalyticsService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "analytics-test"})
@Transactional
class AnalyticsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtService tokens;
    @Autowired AnalyticsService analytics;
    @Autowired AnalyticsRepository analyticsRepository;
    @Autowired SalesHistoryRepository historyRepository;
    Cookie admin, cashier, other;
    UserResponse cashierActor;
    LocalDate day = LocalDate.now(ZoneId.of("Asia/Colombo"));
    Instant start = day.atStartOfDay(ZoneId.of("Asia/Colombo")).toInstant();
    Instant end = day.plusDays(1).atStartOfDay(ZoneId.of("Asia/Colombo")).toInstant();

    @BeforeEach void setup() {
        admin = actor("analytics-admin", Role.ADMIN);
        cashier = actor("analytics-cashier", Role.CASHIER);
        other = actor("analytics-other", Role.CASHIER);
        cashierActor = UserResponse.from(users.findById("analytics-cashier").orElseThrow());
        // Two lines on a discounted/taxed order catch accidental header multiplication by joins.
        sale("a", "analytics-cashier", "CASH", start, "20", "2", "1.80");
        item("a", "p1", "=Apples, \"fresh\"", 2, "5");
        item("a", "p2", "Milk", 1, "10");
        sale("b", "analytics-other", "CARD", end.minusNanos(1000), "6", "0", "0.60");
        item("b", "p3", "Bananas", 3, "2");
        sale("before", "analytics-other", "CASH", start.minusNanos(1000), "100", "0", "10");
        sale("after", "analytics-other", "CARD", end, "100", "0", "10");
        jdbc.update("INSERT INTO categories VALUES ('analytics-category','Analytics','analytics','', 'ACTIVE','','green')");
        for (int i = 0; i < 3; i++) {
            jdbc.update("INSERT INTO products (id,name,sku,category_id,price,description,status,unit,icon,color) VALUES (?,?,?,'analytics-category',1,'','ACTIVE','unit','','green')", "inventory-" + i, "Stock " + i, "STOCK-" + i);
            jdbc.update("INSERT INTO inventory (product_id,stock,min_stock) VALUES (?,?,10)", "inventory-" + i, i == 0 ? 0 : i == 1 ? 3 : 10);
        }
    }
    Cookie actor(String id, Role role) {
        var user = users.saveAndFlush(new User(id, id, id + "@test.local", "test", role, ""));
        return new Cookie(AuthCookies.NAME, tokens.issue(user).getTokenValue());
    }
    void sale(String id, String owner, String payment, Instant date, String subtotal, String discount, String tax) {
        var sub = new BigDecimal(subtotal); var disc = new BigDecimal(discount); var vat = new BigDecimal(tax);
        jdbc.update("INSERT INTO sales (id,idempotency_key,request_hash,user_id,user_name,occurred_at,payment,subtotal,discount,tax_rate,tax,total) VALUES (?,?,?, ?,?,?, ?,?,?,?,?,?)", id, UUID.randomUUID().toString(), "test-hash",
                owner, owner, date.atOffset(ZoneOffset.UTC), payment, sub, disc, new BigDecimal("10"), vat, sub.subtract(disc).add(vat));
    }
    void item(String sale, String product, String name, long quantity, String price) {
        var amount = new BigDecimal(price);
        jdbc.update("INSERT INTO sale_items VALUES (?,?,?,?,?,?,?,?)", UUID.randomUUID().toString(), sale, product, name,
                product, amount, quantity, amount.multiply(BigDecimal.valueOf(quantity)));
    }
    JsonNode report(String from, String to) throws Exception {
        var response = mvc.perform(get("/api/admin/reports").cookie(admin).param("period", "custom").param("from", from).param("to", to))
                .andExpect(status().isOk()).andReturn().getResponse();
        return json.readTree(response.getContentAsString());
    }
    @Test void reportMatchesDatabaseWithExactFinancialTotalsAndInclusiveLocalDates() throws Exception {
        var result = report(day.toString(), day.toString());
        var summary = result.path("summary");
        assertThat(summary.path("orders").asLong()).isEqualTo(2);
        assertThat(summary.path("revenue").decimalValue()).isEqualByComparingTo("26.40");
        assertThat(summary.path("subtotal").decimalValue()).isEqualByComparingTo("26");
        assertThat(summary.path("discounts").decimalValue()).isEqualByComparingTo("2");
        assertThat(summary.path("taxes").decimalValue()).isEqualByComparingTo("2.40");
        assertThat(summary.path("average").decimalValue()).isEqualByComparingTo("13.20");
        assertThat(summary.path("units").asLong()).isEqualTo(6);
        BigDecimal sql = jdbc.queryForObject("SELECT SUM(total) FROM sales WHERE occurred_at>=? AND occurred_at<?", BigDecimal.class,
                start.atOffset(ZoneOffset.UTC), end.atOffset(ZoneOffset.UTC));
        assertThat(summary.path("revenue").decimalValue()).isEqualByComparingTo(sql);
        assertThat(result.path("daily").size()).isEqualTo(1);
        assertThat(result.at("/daily/0/revenue").decimalValue()).isEqualByComparingTo(sql);
        assertThat(result.at("/payments/0/revenue").decimalValue()).isEqualByComparingTo("19.80");
        assertThat(result.at("/payments/1/revenue").decimalValue()).isEqualByComparingTo("6.60");
        assertThat(result.at("/topByQuantity/0/id").asText()).isEqualTo("p3");
        assertThat(result.at("/topByRevenue/0/id").asText()).isEqualTo("p1");
        assertThat(result.at("/cashiers/0/revenue").decimalValue()).isEqualByComparingTo("19.80");
        assertThat(result.at("/cashiers/1/revenue").decimalValue()).isEqualByComparingTo("6.60");
    }
    @Test void dashboardMatchesTodayInventoryAndPopulatesHourlyAndWeeklySeries() throws Exception {
        mvc.perform(get("/api/admin/dashboard").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.today.revenue").value(26.4)).andExpect(jsonPath("$.today.orders").value(2))
                .andExpect(jsonPath("$.inventory.products").value(3)).andExpect(jsonPath("$.inventory.lowStock").value(1))
                .andExpect(jsonPath("$.inventory.outOfStock").value(1)).andExpect(jsonPath("$.inventory.alerts.length()").value(2))
                .andExpect(jsonPath("$.activity.length()").value(24)).andExpect(jsonPath("$.activity[0].revenue").value(19.8))
                .andExpect(jsonPath("$.activity[23].revenue").value(6.6)).andExpect(jsonPath("$.weekly.length()").value(7))
                .andExpect(jsonPath("$.recent[0].id").value("b"));
        mvc.perform(get("/api/admin/dashboard").cookie(admin).param("period", "week"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.today.revenue").value(26.4));
    }
    @Test void cashierCannotChangeScopeOrAccessAdminAnalyticsOrExports() throws Exception {
        mvc.perform(get("/api/cashier/dashboard").cookie(cashier).param("cashierId", "analytics-other"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.today.revenue").value(19.8))
                .andExpect(jsonPath("$.today.orders").value(1)).andExpect(jsonPath("$.summary.units").value(3))
                .andExpect(jsonPath("$.recent.length()").value(1)).andExpect(jsonPath("$.recent[0].userId").value("analytics-cashier"))
                .andExpect(jsonPath("$.inventory").doesNotExist()).andExpect(jsonPath("$.topProducts").doesNotExist())
                .andExpect(jsonPath("$.cashiers").doesNotExist()).andExpect(jsonPath("$.payments[1].revenue").value(0))
                .andExpect(jsonPath("$.activity[23].revenue").value(0));
        mvc.perform(get("/api/cashier/dashboard").cookie(other)).andExpect(jsonPath("$.today.revenue").value(6.6));
        for (String path : List.of("/api/admin/dashboard", "/api/admin/reports", "/api/admin/reports/csv")) {
            mvc.perform(get(path).cookie(cashier)).andExpect(status().isForbidden());
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/cashier/dashboard")).andExpect(status().isUnauthorized());
        assertThatThrownBy(() -> analytics.report(cashierActor, "today", null, null)).hasMessage("Only Admin can view reports.");
        mvc.perform(post("/api/admin/reports").cookie(admin)).andExpect(status().isForbidden());
    }
    @Test void emptyPeriodsAndGapsReturnZeroesAndValidPresetDates() throws Exception {
        var empty = report(day.minusDays(4).toString(), day.minusDays(2).toString());
        assertThat(empty.at("/summary/revenue").decimalValue()).isEqualByComparingTo("0");
        assertThat(empty.at("/summary/average").decimalValue()).isEqualByComparingTo("0");
        assertThat(empty.path("daily").size()).isEqualTo(3);
        assertThat(empty.path("topByQuantity").isEmpty()).isTrue();
        for (String period : List.of("today", "week", "month")) {
            mvc.perform(get("/api/admin/reports").cookie(admin).param("period", period)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.range.to").value(day.toString())).andExpect(jsonPath("$.range.timeZone").value("Asia/Colombo"));
        }
        assertThat(analytics.range("week", null, null).from().getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(analytics.range("month", null, null).from().getDayOfMonth()).isEqualTo(1);
    }
    @Test void rejectsInvalidAndUnboundedDateRanges() throws Exception {
        for (var pair : List.of(new String[]{"period", "year"}, new String[]{"period", "custom"}, new String[]{"from", "nonsense"}, new String[]{"from", day.toString()}))
            mvc.perform(get("/api/admin/reports").cookie(admin).param(pair[0], pair[1])).andExpect(status().isBadRequest());
        for (var dates : List.of(new String[]{day.toString(), day.minusDays(1).toString()}, new String[]{day.minusDays(366).toString(), day.toString()},
                new String[]{"0000-01-01", "0000-01-02"}))
            mvc.perform(get("/api/admin/reports").cookie(admin).param("period", "custom").param("from", dates[0]).param("to", dates[1])).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/dashboard").cookie(admin).param("period", "month")).andExpect(status().isBadRequest());
    }
    @Test void csvMatchesReportEscapesNamesAndIncludesEveryReportSection() throws Exception {
        jdbc.update("UPDATE sale_items SET product_name=? WHERE product_id='p3'", "@SUM(1)\nnext");
        var response = mvc.perform(get("/api/admin/reports/csv").cookie(admin).param("period", "custom").param("from", day.toString()).param("to", day.toString()))
                .andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"freshmart-report-" + day + "-" + day + ".csv\""))
                .andReturn().getResponse();
        assertThat(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).contains(
                "\"Total revenue\",\"26.40\"", "\"Discounts\",\"2.00\"", "\"Taxes collected\",\"2.40\"",
                "\"'=Apples, \"\"fresh\"\"\"", "\"'@SUM(1)\nnext\"", "Top 10 products by quantity", "Top 10 products by revenue", "Cashier ID", "\"CARD\",\"1\",\"6.60\"");
    }
    @Test void fullyDiscountedSalesCountAndAveragesRoundHalfUp() throws Exception {
        sale("free", "analytics-cashier", "CASH", start.plusSeconds(1), "1", "1", "0");
        sale("penny", "analytics-cashier", "CASH", start.plusSeconds(2), "0.02", "0", "0");
        var result = report(day.toString(), day.toString());
        assertThat(result.at("/summary/orders").asLong()).isEqualTo(4);
        assertThat(result.at("/summary/revenue").decimalValue()).isEqualByComparingTo("26.42");
        assertThat(result.at("/summary/average").decimalValue()).isEqualByComparingTo("6.61");
        assertThat(result.at("/summary/discounts").decimalValue()).isEqualByComparingTo("3");
    }
    @Test void configuredTimezoneHandlesShortAndLongDaylightSavingDays() {
        var dstZone = ZoneId.of("America/New_York");
        var dstService = new AnalyticsService(analyticsRepository, historyRepository, dstZone.getId());
        var manager = UserResponse.from(users.findById("analytics-admin").orElseThrow());
        for (String date : List.of("2026-03-08", "2026-11-01")) {
            var local = LocalDate.parse(date);
            var from = local.atStartOfDay(dstZone).toInstant();
            var until = local.plusDays(1).atStartOfDay(dstZone).toInstant();
            assertThat(Duration.between(from, until).toHours()).isIn(23L, 25L);
            sale(date + "-before", manager.id(), "CASH", from.minusNanos(1000), "50", "0", "0");
            sale(date + "-start", manager.id(), "CASH", from, "1", "0", "0");
            sale(date + "-end", manager.id(), "CARD", until.minusNanos(1000), "2", "0", "0");
            sale(date + "-after", manager.id(), "CARD", until, "50", "0", "0");
            var result = dstService.report(manager, "custom", local, local);
            assertThat(result.summary().orders()).isEqualTo(2);
            assertThat(result.summary().revenue()).isEqualByComparingTo("3");
            assertThat(result.daily()).hasSize(1);
            assertThat(result.daily().get(0).revenue()).isEqualByComparingTo("3");
        }
    }
}
