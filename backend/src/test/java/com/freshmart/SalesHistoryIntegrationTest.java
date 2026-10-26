package com.freshmart;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.freshmart.dto.*;
import com.freshmart.model.*;
import com.freshmart.repository.*;
import com.freshmart.security.AuthCookies;
import com.freshmart.security.JwtService;
import com.freshmart.service.*;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SalesHistoryIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SalesService checkout;
    @Autowired InventoryService stock;
    @Autowired ProductService productService;
    @Autowired CategoryService categoryService;
    @Autowired SaleRepository sales;
    @Autowired StockMovementRepository movements;
    @Autowired ProductRepository products;
    @Autowired CategoryRepository categories;
    @Autowired UserRepository users;
    @Autowired JwtService tokens;
    @Autowired JdbcTemplate jdbc;
    Cookie admin, cashier, other;
    UserResponse manager;
    String productId, categoryId;
    CheckoutResponse a, b, c;
    @BeforeEach void setup() {
        movements.deleteAll(); sales.deleteAll(); products.deleteAll(); categories.deleteAll(); users.deleteAll();
        var adminUser = users.save(new User("history-admin", "Manager", "admin@history.test", "test", Role.ADMIN, ""));
        var cashierUser = users.save(new User("history-c1", "Cashier One", "one@history.test", "test", Role.CASHIER, ""));
        var otherUser = users.save(new User("history-c2", "Cashier Two", "two@history.test", "test", Role.CASHIER, ""));
        manager = UserResponse.from(adminUser);
        admin = cookie(adminUser); cashier = cookie(cashierUser); other = cookie(otherUser);
        categoryId = categoryService.save(null, new CategoryRequest("Fruit", "", CatalogStatus.ACTIVE, null, null)).id();
        productId = productService.save(null, product("Original Apples", "2.50")).id();
        stock.adjust(productId, new StockAdjustmentRequest(StockOperation.STOCK_IN, 30L, "Supply"), manager);
        a = sell(manager, 1, PaymentMethod.CASH, "0");
        b = sell(UserResponse.from(cashierUser), 2, PaymentMethod.CARD, "1");
        c = sell(UserResponse.from(otherUser), 3, PaymentMethod.CASH, "0");
        date(a, "2026-10-25T18:29:59Z"); date(b, "2026-10-25T18:30:00Z"); date(c, "2026-10-26T18:29:59Z");
    }
    Cookie cookie(User user) { return new Cookie(AuthCookies.NAME, tokens.issue(user).getTokenValue()); }
    ProductRequest product(String name, String price) {
        return new ProductRequest(name, "HISTORY-APPLE", "HISTORY123", categoryId, new BigDecimal(price), "", CatalogStatus.ACTIVE, null, null, null);
    }
    CheckoutResponse sell(UserResponse actor, long quantity, PaymentMethod payment, String discount) {
        return checkout.checkout(new CheckoutRequest(UUID.randomUUID().toString(),
                List.of(new CheckoutRequest.Item(productId, quantity, new BigDecimal("2.50"))),
                new BigDecimal(discount), checkout.taxRate(), payment), actor);
    }
    void date(CheckoutResponse sale, String instant) {
        jdbc.update("UPDATE sales SET occurred_at=? WHERE id=?", Timestamp.from(Instant.parse(instant)), sale.id());
    }
    @Test void adminHistoryPaginatesInDatabaseWithFullFilteredSummaryAndStableSort() throws Exception {
        mvc.perform(get("/api/sales").cookie(admin).param("size", "2")).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2)).andExpect(jsonPath("$.content[0].id").value(c.id()))
                .andExpect(jsonPath("$.content[0].quantity").value(3)).andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.summary.revenue").value(14))
                .andExpect(jsonPath("$.summary.units").value(6)).andExpect(jsonPath("$.summary.average").value(4.67));
        mvc.perform(get("/api/sales").cookie(admin).param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].id").value(a.id()));
        mvc.perform(get("/api/sales").cookie(admin).param("sort", "total").param("direction", "asc"))
                .andExpect(jsonPath("$.content[0].id").value(a.id()));
        date(a, "2026-10-25T18:30:00Z");
        var result = mvc.perform(get("/api/sales").cookie(admin).param("direction", "asc")).andReturn().getResponse();
        var ids = List.of(a.id(), b.id()).stream().sorted().toList();
        assertThat(json.readTree(result.getContentAsString()).path("content").get(0).path("id").asText()).isEqualTo(ids.get(0));
    }
    @Test void searchDatesPaymentAndCashierComposeWithInclusiveShopDateBoundaries() throws Exception {
        mvc.perform(get("/api/sales").cookie(admin).param("from", "2026-10-26").param("to", "2026-10-26"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.summary.revenue").value(11.5)).andExpect(jsonPath("$.summary.cash").value(1))
                .andExpect(jsonPath("$.summary.card").value(1)).andExpect(jsonPath("$.timeZone").value("Asia/Colombo"));
        mvc.perform(get("/api/sales").cookie(admin).param("from", "2026-10-26").param("to", "2026-10-26")
                .param("payment", "CARD").param("cashierId", "history-c1").param("q", b.id().substring(0, 8).toUpperCase()))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(b.id()));
        mvc.perform(get("/api/sales").cookie(admin).param("q", "%")).andExpect(jsonPath("$.totalElements").value(0));
    }
    @Test void cashierCanOnlyReadTheirOwnListSummaryAndDetail() throws Exception {
        mvc.perform(get("/api/sales").cookie(cashier)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.summary.revenue").value(4))
                .andExpect(jsonPath("$.content[0].userId").value("history-c1"));
        mvc.perform(get("/api/sales").cookie(cashier).param("cashierId", "history-c2")).andExpect(status().isForbidden());
        mvc.perform(get("/api/sales").cookie(cashier).param("q", c.id())).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/sales/" + b.id()).cookie(cashier)).andExpect(status().isOk()).andExpect(jsonPath("$.sale.id").value(b.id()));
        for (String id : List.of(a.id(), c.id(), "missing"))
            mvc.perform(get("/api/sales/" + id).cookie(cashier)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(get("/api/sales/" + b.id()).cookie(other)).andExpect(status().isNotFound());
    }
    @Test void detailsPreserveSnapshotsAfterCatalogUpdatesDeletionAndNeverExposeIdempotencyData() throws Exception {
        productService.save(productId, product("Renamed Apples", "99.00"));
        stock.adjust(productId, new StockAdjustmentRequest(StockOperation.STOCK_OUT, 24L, "Remove remainder"), manager);
        productService.delete(productId);
        mvc.perform(get("/api/sales/" + b.id()).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.storeName").value("FreshMart"))
                .andExpect(jsonPath("$.sale.items[0].name").value("Original Apples"))
                .andExpect(jsonPath("$.sale.items[0].price").value(2.5)).andExpect(jsonPath("$.sale.items[0].quantity").value(2))
                .andExpect(jsonPath("$.sale.subtotal").value(5)).andExpect(jsonPath("$.sale.discount").value(1))
                .andExpect(jsonPath("$.sale.tax").value(0)).andExpect(jsonPath("$.sale.total").value(4))
                .andExpect(jsonPath("$.sale.requestHash").doesNotExist()).andExpect(jsonPath("$.sale.idempotencyKey").doesNotExist());
    }
    @Test void adminCashierOptionsUseHistoricalSnapshotsAndAreNotExposedToCashiers() throws Exception {
        users.deleteById("history-c2");
        mvc.perform(get("/api/sales/cashiers").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3)).andExpect(jsonPath("$[1].name").value("Cashier Two"));
        mvc.perform(get("/api/sales/cashiers").cookie(cashier)).andExpect(status().isForbidden());
    }
    @Test void invalidFiltersAreRejectedAndOutOfRangePagesHaveEmptyContent() throws Exception {
        for (var pair : List.of(new String[]{"page", "-1"}, new String[]{"size", "101"}, new String[]{"size", "0"},
                new String[]{"sort", "requestHash"}, new String[]{"direction", "bad"}, new String[]{"from", "bad"}, new String[]{"payment", "DEBIT"}))
            mvc.perform(get("/api/sales").cookie(admin).param(pair[0], pair[1])).andExpect(status().isBadRequest());
        mvc.perform(get("/api/sales").cookie(admin).param("from", "2026-10-27").param("to", "2026-10-25")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/sales").cookie(admin).param("page", "9"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0)).andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/sales").cookie(admin).param("q", "no-such-sale"))
                .andExpect(jsonPath("$.summary.orders").value(0)).andExpect(jsonPath("$.summary.revenue").value(0));
    }
    @Test void salesRequireAuthenticationAndCannotBeModifiedEvenByAdmin() throws Exception {
        for (String path : List.of("/api/sales", "/api/sales/" + a.id(), "/api/sales/cashiers"))
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        for (var request : List.of(put("/api/sales/" + a.id()), delete("/api/sales/" + a.id()), post("/api/sales")))
            mvc.perform(request.cookie(admin, csrf.getCookie("freshmart_csrf"))
                    .header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"total\":0}")).andExpect(status().isForbidden());
        assertThat(sales.count()).isEqualTo(3);
        assertThat(sales.findById(a.id()).orElseThrow().getTotal()).isEqualByComparingTo("2.50");
    }
}
