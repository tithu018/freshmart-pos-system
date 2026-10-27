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
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.checkout.tax-rate=7.50")
@AutoConfigureMockMvc
@org.springframework.test.context.ContextConfiguration(initializers = TestDatabaseSafety.class)
@ActiveProfiles("test")
class CheckoutIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SalesService service;
    @Autowired InventoryService stock;
    @Autowired ProductService productService;
    @Autowired CategoryService categoryService;
    @Autowired SaleRepository sales;
    @Autowired InventoryRepository inventory;
    @Autowired StockMovementRepository movements;
    @Autowired ProductRepository products;
    @Autowired CategoryRepository categories;
    @Autowired UserRepository users;
    @Autowired JwtService tokens;
    Cookie admin, cashier;
    UserResponse actor;
    String categoryId, first, second;

    @BeforeEach void setup() {
        movements.deleteAll(); sales.deleteAll(); products.deleteAll(); categories.deleteAll(); users.deleteAll();
        var manager = users.save(new User("checkout-admin", "Manager", "admin@checkout.test", "test", Role.ADMIN, ""));
        var operator = users.save(new User("checkout-cashier", "Cashier", "cashier@checkout.test", "test", Role.CASHIER, ""));
        actor = UserResponse.from(operator);
        admin = new Cookie(AuthCookies.NAME, tokens.issue(manager).getTokenValue());
        cashier = new Cookie(AuthCookies.NAME, tokens.issue(operator).getTokenValue());
        categoryId = categoryService.save(null, new CategoryRequest("Fruit", "", CatalogStatus.ACTIVE, null, null)).id();
        var ids = new ArrayList<String>();
        ids.add(productService.save(null, product("Apples", "APPLE", "123456", CatalogStatus.ACTIVE, "2.50")).id());
        ids.add(productService.save(null, product("Pears", "PEAR", "987654", CatalogStatus.ACTIVE, "2.50")).id());
        Collections.sort(ids); first = ids.get(0); second = ids.get(1);
        for (String id : ids) stock.adjust(id, new StockAdjustmentRequest(StockOperation.STOCK_IN, 10L, "Test supply"), actor);
    }
    ProductRequest product(String name, String sku, String barcode, CatalogStatus status, String price) {
        return new ProductRequest(name, sku, barcode, categoryId, new BigDecimal(price), "", status, null, null, null);
    }
    CheckoutRequest order(String key, String id, long quantity) {
        return new CheckoutRequest(key, List.of(new CheckoutRequest.Item(id, quantity, new BigDecimal("2.50"))),
                new BigDecimal("1.00"), new BigDecimal("7.50"), PaymentMethod.CASH);
    }
    String key() { return UUID.randomUUID().toString(); }
    ResultActions checkout(Object body, Cookie user) throws Exception {
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        return mvc.perform(post("/api/checkout").cookie(user, csrf.getCookie("freshmart_csrf"))
                .header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    long balance(String id) { return inventory.findById(id).orElseThrow().getStock(); }

    @Test void cashCheckoutCalculatesDiscountBeforeTaxAndLinksStockToSale() throws Exception {
        var response = checkout(order(key(), first, 3), cashier).andExpect(status().isOk())
                .andExpect(jsonPath("$.subtotal").value(7.5)).andExpect(jsonPath("$.discount").value(1))
                .andExpect(jsonPath("$.tax").value(0.49)).andExpect(jsonPath("$.total").value(6.99))
                .andExpect(jsonPath("$.userId").value(actor.id())).andReturn().getResponse();
        String saleId = json.readTree(response.getContentAsString()).path("id").asText();
        assertThat(sales.count()).isEqualTo(1); assertThat(balance(first)).isEqualTo(7);
        var movement = stock.history(first).stream().filter(m -> m.saleId() != null).findFirst().orElseThrow();
        assertThat(movement.saleId()).isEqualTo(saleId); assertThat(movement.quantity()).isEqualTo(3);
        assertThat(movement.userId()).isEqualTo(actor.id());
    }
    @Test void adminCanCheckoutWithSimulatedCardAndCashierCanSearchActualCatalog() throws Exception {
        var order = order(key(), first, 1);
        checkout(new CheckoutRequest(order.idempotencyKey(), order.items(), BigDecimal.ZERO, order.expectedTaxRate(), PaymentMethod.CARD), admin)
                .andExpect(status().isOk()).andExpect(jsonPath("$.payment").value("CARD"));
        for (String q : List.of("apples", "APPLE", "123456"))
            mvc.perform(get("/api/pos/products").param("q", q).cookie(cashier)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/pos/config").cookie(cashier)).andExpect(status().isOk()).andExpect(jsonPath("$.taxRate").value(7.5));
    }
    @Test void insufficientSecondItemRollsBackFirstItemSaleAndMovementsAndKeyCanRetry() throws Exception {
        var request = new CheckoutRequest(key(), List.of(new CheckoutRequest.Item(first, 2L, new BigDecimal("2.50")),
                new CheckoutRequest.Item(second, 11L, new BigDecimal("2.50"))), BigDecimal.ZERO, new BigDecimal("7.50"), PaymentMethod.CASH);
        checkout(request, cashier).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
        assertThat(balance(first)).isEqualTo(10); assertThat(balance(second)).isEqualTo(10);
        assertThat(sales.count()).isZero(); assertThat(movements.count()).isEqualTo(2);
        stock.adjust(second, new StockAdjustmentRequest(StockOperation.RESTOCK, 1L, "Supply"), actor);
        checkout(request, cashier).andExpect(status().isOk());
        assertThat(balance(first)).isEqualTo(8); assertThat(balance(second)).isZero();
    }
    @Test void replayReturnsOriginalSaleEvenAfterCatalogChangesAndCannotChangePayloadOrActor() throws Exception {
        var request = order(key(), first, 2);
        var original = checkout(request, cashier).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var p = productService.get(first);
        productService.save(first, product(p.name(), p.sku(), p.barcode(), CatalogStatus.INACTIVE, "9.99"));
        checkout(request, cashier).andExpect(status().isOk()).andExpect(content().json(original));
        checkout(order(request.idempotencyKey(), first, 3), cashier).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
        checkout(request, admin).andExpect(status().isConflict());
        assertThat(sales.count()).isEqualTo(1); assertThat(balance(first)).isEqualTo(8);
    }
    @Test void simultaneousDuplicatesCreateExactlyOneSaleAndDeduction() throws Exception {
        var request = order(key(), first, 3);
        var pool = Executors.newFixedThreadPool(4);
        try {
            var start = new CountDownLatch(1); var tasks = new ArrayList<Future<CheckoutResponse>>();
            for (int i = 0; i < 4; i++) tasks.add(pool.submit(() -> { start.await(); return service.checkout(request, actor); }));
            start.countDown(); var ids = new HashSet<String>();
            for (var task : tasks) ids.add(task.get(20, TimeUnit.SECONDS).id());
            assertThat(ids).hasSize(1); assertThat(sales.count()).isEqualTo(1);
            assertThat(balance(first)).isEqualTo(7); assertThat(movements.count()).isEqualTo(3);
        } finally { pool.shutdownNow(); }
    }
    @Test void competingOrdersCannotOversell() throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        try {
            var start = new CountDownLatch(1); var tasks = new ArrayList<Future<Boolean>>();
            for (int i = 0; i < 2; i++) tasks.add(pool.submit(() -> {
                start.await();
                try { service.checkout(order(key(), first, 7), actor); return true; }
                catch (CatalogException e) { assertThat(e.getCode()).isEqualTo("INSUFFICIENT_STOCK"); return false; }
            }));
            start.countDown(); int successes = 0;
            for (var task : tasks) if (task.get(20, TimeUnit.SECONDS)) successes++;
            assertThat(successes).isEqualTo(1); assertThat(balance(first)).isEqualTo(3); assertThat(sales.count()).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void invalidInputsAndDiscountAfterDeductionsLeaveNoPartialChanges() throws Exception {
        var request = order(key(), first, 1);
        checkout(new CheckoutRequest(key(), request.items(), new BigDecimal("9"), request.expectedTaxRate(), PaymentMethod.CASH), cashier)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_DISCOUNT"));
        checkout(new CheckoutRequest(key(), List.of(request.items().get(0), request.items().get(0)), BigDecimal.ZERO, request.expectedTaxRate(), PaymentMethod.CASH), cashier)
                .andExpect(status().isBadRequest());
        for (Object quantity : List.of(0, -1, 1.5, 1000001)) {
            var body = json.valueToTree(request); ((com.fasterxml.jackson.databind.node.ObjectNode) body.path("items").get(0)).set("quantity", json.valueToTree(quantity));
            checkout(body, cashier).andExpect(status().isBadRequest());
        }
        assertThat(balance(first)).isEqualTo(10); assertThat(sales.count()).isZero(); assertThat(movements.count()).isEqualTo(2);
    }
    @Test void changedPricesTaxInactiveAndMissingProductsAreRejected() throws Exception {
        var request = order(key(), first, 1);
        checkout(new CheckoutRequest(key(), request.items(), BigDecimal.ZERO, BigDecimal.ZERO, PaymentMethod.CASH), cashier)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TAX_CHANGED"));
        var p = productService.get(first);
        productService.save(first, product(p.name(), p.sku(), p.barcode(), CatalogStatus.ACTIVE, "3.00"));
        checkout(request, cashier).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PRICE_CHANGED"));
        productService.save(first, product(p.name(), p.sku(), p.barcode(), CatalogStatus.INACTIVE, "2.50"));
        checkout(request, cashier).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PRODUCT_UNAVAILABLE"));
        checkout(order(key(), "missing", 1), cashier).andExpect(status().isNotFound());
        assertThat(sales.count()).isZero(); assertThat(balance(first)).isEqualTo(10);
    }
    @Test void authenticationAndCsrfAreRequired() throws Exception {
        mvc.perform(get("/api/pos/products")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/checkout").cookie(cashier).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(order(key(), first, 1))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        mvc.perform(post("/api/checkout").cookie(csrf.getCookie("freshmart_csrf"))
                .header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(order(key(), first, 1))))
                .andExpect(status().isUnauthorized());
        assertThat(sales.count()).isZero();
    }
}
