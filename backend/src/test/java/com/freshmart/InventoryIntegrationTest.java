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
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InventoryIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired InventoryService service;
    @Autowired ProductService productService;
    @Autowired CategoryService categoryService;
    @Autowired InventoryRepository inventory;
    @Autowired StockMovementRepository movements;
    @Autowired ProductRepository products;
    @Autowired CategoryRepository categories;
    @Autowired UserRepository users;
    @Autowired JwtService tokens;
    @Autowired TransactionTemplate transaction;
    Cookie admin, cashier;
    UserResponse actor;
    String productId, categoryId;

    @BeforeEach
    void setup() {
        movements.deleteAll(); products.deleteAll(); categories.deleteAll(); users.deleteAll();
        var user = users.save(new User("stock-admin", "Stock Manager", "stock-admin@test.com", "unused-test-hash", Role.ADMIN, ""));
        actor = UserResponse.from(user);
        admin = new Cookie(AuthCookies.NAME, tokens.issue(user).getTokenValue());
        var cashierUser = users.save(new User("stock-cashier", "Cashier", "stock-cashier@test.com", "unused-test-hash", Role.CASHIER, ""));
        cashier = new Cookie(AuthCookies.NAME, tokens.issue(cashierUser).getTokenValue());
        categoryId = categoryService.save(null, new CategoryRequest("Fruit", "", CatalogStatus.ACTIVE, null, null)).id();
        productId = productService.save(null, productRequest()).id();
    }
    private ProductRequest productRequest() {
        return new ProductRequest("Fresh apples", "APPLE-1", "0012345", categoryId, new BigDecimal("2.50"), "", CatalogStatus.ACTIVE, null, null, null);
    }
    private Map<String, Object> change(String type, Object quantity) {
        return new HashMap<>(Map.of("type", type, "quantity", quantity, "reason", "Delivery received"));
    }
    private ResultActions write(MockHttpServletRequestBuilder request, Cookie user, Object body) throws Exception {
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        request.cookie(user, csrf.getCookie("freshmart_csrf"))
                .header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(request);
    }
    private ResultActions adjust(String type, Object quantity) throws Exception {
        return write(post("/api/inventory/" + productId + "/movements"), admin, change(type, quantity));
    }

    @Test
    void productsHaveOneInventoryRecordAndCatalogEditsPreserveStock() throws Exception {
        assertThat(inventory.count()).isEqualTo(1);
        mvc.perform(get("/api/inventory/" + productId).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.stock").value(0)).andExpect(jsonPath("$.minStock").value(10))
                .andExpect(jsonPath("$.stockStatus").value("OUT_OF_STOCK"));
        adjust("STOCK_IN", 15).andExpect(status().isOk());
        productService.save(productId, productRequest());
        assertThat(inventory.count()).isEqualTo(1);
        assertThat(inventory.findById(productId).orElseThrow().getStock()).isEqualTo(15);
    }

    @Test
    void stockInOutAndRestockPersistBalancesAndAuthenticatedAuditFields() throws Exception {
        var body = change("STOCK_IN", 20); body.put("userId", "forged-user"); body.put("userName", "Forged");
        write(post("/api/inventory/" + productId + "/movements"), admin, body).andExpect(status().isOk()).andExpect(jsonPath("$.stock").value(20));
        adjust("STOCK_OUT", 7).andExpect(status().isOk()).andExpect(jsonPath("$.stock").value(13));
        adjust("RESTOCK", 4).andExpect(status().isOk()).andExpect(jsonPath("$.stock").value(17));
        assertThat(inventory.findById(productId).orElseThrow().getStock()).isEqualTo(17);
        var history = service.history(productId);
        assertThat(history).hasSize(3);
        assertThat(history).allSatisfy(m -> {
            assertThat(m.userId()).isEqualTo(actor.id()); assertThat(m.userName()).isEqualTo("Stock Manager");
            assertThat(m.reason()).isEqualTo("Delivery received"); assertThat(m.occurredAt()).isNotNull();
            assertThat(m.productName()).isEqualTo("Fresh apples");
        });
        assertThat(history.stream().filter(m -> m.type().equals("STOCK_OUT")).findFirst().orElseThrow().stockAfter()).isEqualTo(13);
        mvc.perform(get("/api/inventory/movements").param("productId", productId).cookie(admin)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void insufficientStockAndOverflowDoNotChangeStockOrHistory() throws Exception {
        adjust("STOCK_IN", 5).andExpect(status().isOk());
        adjust("STOCK_OUT", 6).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
        assertThat(inventory.findById(productId).orElseThrow().getStock()).isEqualTo(5);
        assertThat(movements.count()).isEqualTo(1);
        adjust("STOCK_IN", 1_000_000_000L).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STOCK_LIMIT"));
        assertThat(movements.count()).isEqualTo(1);
    }

    @Test
    void thresholdAlertsSearchFiltersAndSummaryUseCurrentInventory() throws Exception {
        adjust("STOCK_IN", 5).andExpect(status().isOk()).andExpect(jsonPath("$.stockStatus").value("LOW_STOCK"));
        write(put("/api/inventory/" + productId + "/threshold"), admin, Map.of("minStock", 5))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stockStatus").value("IN_STOCK"));
        write(put("/api/inventory/" + productId + "/threshold"), admin, Map.of("minStock", 6))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stockStatus").value("LOW_STOCK"));
        for (String q : List.of("APPLE", "fresh", "0012345"))
            mvc.perform(get("/api/inventory").param("q", q).param("categoryId", categoryId).param("status", "LOW_STOCK").cookie(cashier))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/inventory").param("status", "OUT_OF_STOCK").cookie(cashier)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/inventory/summary").cookie(cashier)).andExpect(status().isOk())
                .andExpect(jsonPath("$.units").value(5)).andExpect(jsonPath("$.value").value(12.5))
                .andExpect(jsonPath("$.lowStock").value(1)).andExpect(jsonPath("$.outOfStock").value(0));
        adjust("STOCK_OUT", 5).andExpect(status().isOk());
        write(put("/api/inventory/" + productId + "/threshold"), admin, Map.of("minStock", 0))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stockStatus").value("OUT_OF_STOCK"));
        assertThat(service.summary().outOfStock()).isEqualTo(1);
        assertThat(service.history(productId).stream().filter(m -> m.type().equals("THRESHOLD")).count()).isEqualTo(3);
    }

    @Test
    void cashierCanViewButCannotAdjustThresholdsOrReadAuditHistory() throws Exception {
        for (String path : List.of("/api/inventory", "/api/inventory/summary", "/api/inventory/" + productId)) {
            mvc.perform(get(path).cookie(cashier)).andExpect(status().isOk());
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
        for (String type : List.of("STOCK_IN", "STOCK_OUT", "RESTOCK"))
            write(post("/api/inventory/" + productId + "/movements"), cashier, change(type, 1))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        write(put("/api/inventory/" + productId + "/threshold"), cashier, Map.of("minStock", 1)).andExpect(status().isForbidden());
        mvc.perform(get("/api/inventory/movements").cookie(cashier)).andExpect(status().isForbidden());
        mvc.perform(post("/api/inventory/" + productId + "/movements").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(change("STOCK_IN", 1)))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(movements.count()).isZero();
    }

    @Test
    void invalidWholeQuantitiesReasonsTypesAndMissingProductsAreRejected() throws Exception {
        for (Object quantity : List.of(0, -1, 1_000_000_001L, 1.5, "1.5"))
            adjust("STOCK_IN", quantity).andExpect(status().isBadRequest());
        adjust("UNKNOWN", 1).andExpect(status().isBadRequest());
        var request = change("STOCK_IN", 1); request.put("reason", " ");
        write(post("/api/inventory/" + productId + "/movements"), admin, request).andExpect(status().isBadRequest());
        for (Object minimum : List.of(-1, 1.5, 1_000_000_001L))
            write(put("/api/inventory/" + productId + "/threshold"), admin, Map.of("minStock", minimum)).andExpect(status().isBadRequest());
        write(post("/api/inventory/missing/movements"), admin, change("STOCK_IN", 1)).andExpect(status().isNotFound());
        mvc.perform(get("/api/inventory").param("status", "bad").cookie(admin)).andExpect(status().isBadRequest());
        assertThat(movements.count()).isZero();
    }

    @Test
    void transactionRollbackUndoesBothBalanceAndAuditRecord() {
        assertThatThrownBy(() -> transaction.execute(status -> {
            service.adjust(productId, new StockAdjustmentRequest(StockOperation.STOCK_IN, 10L, "Rollback test"), actor);
            throw new IllegalStateException("Simulated downstream failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(inventory.findById(productId).orElseThrow().getStock()).isZero();
        assertThat(movements.count()).isZero();
    }

    @Test
    void concurrentUpdatesDoNotLoseIncrementsOrOverdraw() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            var start = new CountDownLatch(1);
            var inputs = new ArrayList<Future<?>>();
            for (int i = 0; i < 8; i++) inputs.add(pool.submit(() -> {
                start.await();
                return service.adjust(productId, new StockAdjustmentRequest(StockOperation.STOCK_IN, 1L, "Concurrent delivery"), actor);
            }));
            start.countDown();
            for (var result : inputs) result.get(20, TimeUnit.SECONDS);
            assertThat(inventory.findById(productId).orElseThrow().getStock()).isEqualTo(8);
            var outStart = new CountDownLatch(1);
            var outputs = new ArrayList<Future<Boolean>>();
            for (int i = 0; i < 2; i++) outputs.add(pool.submit(() -> {
                outStart.await();
                try {
                    service.adjust(productId, new StockAdjustmentRequest(StockOperation.STOCK_OUT, 6L, "Concurrent removal"), actor);
                    return true;
                } catch (CatalogException e) { assertThat(e.getCode()).isEqualTo("INSUFFICIENT_STOCK"); return false; }
            }));
            outStart.countDown();
            int succeeded = 0;
            for (var result : outputs) if (result.get(20, TimeUnit.SECONDS)) succeeded++;
            assertThat(succeeded).isEqualTo(1);
            assertThat(inventory.findById(productId).orElseThrow().getStock()).isEqualTo(2);
            assertThat(movements.count()).isEqualTo(9);
        } finally { pool.shutdownNow(); }
    }

    @Test
    void deletionRequiresZeroStockAndPreservesMovementHistory() throws Exception {
        adjust("STOCK_IN", 2).andExpect(status().isOk());
        write(delete("/api/products/" + productId), admin, null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PRODUCT_HAS_STOCK"));
        adjust("STOCK_OUT", 2).andExpect(status().isOk());
        write(delete("/api/products/" + productId), admin, null).andExpect(status().isNoContent());
        assertThat(inventory.existsById(productId)).isFalse();
        assertThat(service.history(productId)).hasSize(2);
    }
}
