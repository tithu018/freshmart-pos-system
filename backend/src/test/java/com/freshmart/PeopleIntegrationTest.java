package com.freshmart;

import com.fasterxml.jackson.databind.*;
import com.freshmart.dto.*;
import com.freshmart.dto.People.*;
import com.freshmart.model.*;
import com.freshmart.repository.*;
import com.freshmart.security.*;
import com.freshmart.service.*;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ContextConfiguration(initializers = TestDatabaseSafety.class)
@ActiveProfiles({"test", "people-test"})
class PeopleIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired SaleRepository sales;
    @Autowired CustomerRepository customers;
    @Autowired EmployeeService employees;
    @Autowired CustomerService customerService;
    @Autowired ProductService productService;
    @Autowired CategoryService categories;
    @Autowired InventoryService inventory;
    @Autowired SalesService checkout;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService tokens;
    Cookie admin, cashier;
    UserResponse manager, operator;
    String productId;
    static final String PASSWORD = "People-Test-Password123";
    @BeforeEach void setup() {
        // Dedicated test database/schema; never run this profile on the store's public schema.
        for (String table : List.of("stock_movements", "sale_items", "sales", "inventory", "products", "categories", "customers", "app_users")) jdbc.update("DELETE FROM " + table);
        var a = users.saveAndFlush(new User("people-admin", "Manager", "admin@people.test", passwords.encode(PASSWORD), Role.ADMIN, ""));
        var c = users.saveAndFlush(new User("people-cashier", "Cashier", "cashier@people.test", passwords.encode(PASSWORD), Role.CASHIER, ""));
        manager = UserResponse.from(a); operator = UserResponse.from(c); admin = cookie(a); cashier = cookie(c);
        var category = categories.save(null, new CategoryRequest("Fruit", "", CatalogStatus.ACTIVE, null, null));
        productId = productService.save(null, new ProductRequest("Apples", "PEOPLE-APPLE", null, category.id(), new BigDecimal("2.50"), "", CatalogStatus.ACTIVE, null, null, null)).id();
        inventory.adjust(productId, new StockAdjustmentRequest(StockOperation.STOCK_IN, 50L, "Test supply"), manager);
    }
    Cookie cookie(User user) { return new Cookie(AuthCookies.NAME, tokens.issue(user).getTokenValue()); }
    ResultActions write(MockHttpServletRequestBuilder request, Object body, Cookie user) throws Exception {
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        if (user != null) request.cookie(user);
        request.cookie(csrf.getCookie("freshmart_csrf")).header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(request);
    }
    Map<String,Object> employee(String email, String role, boolean enabled) {
        return new HashMap<>(Map.of("name", "New Employee", "email", email, "phone", "0771234567", "role", role, "enabled", enabled));
    }
    Cookie login(String email) throws Exception {
        return write(post("/api/auth/login"), Map.of("email", email, "password", PASSWORD), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.password").doesNotExist()).andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andReturn().getResponse().getCookie(AuthCookies.NAME);
    }
    People.Customer customer(String name) { return customerService.save(null, new CustomerRequest(name, "0771234567", null, true)); }
    CheckoutRequest order(String key, String customerId) {
        return new CheckoutRequest(key, List.of(new CheckoutRequest.Item(productId, 3L, new BigDecimal("2.50"))), new BigDecimal("1"), new BigDecimal("7.50"), PaymentMethod.CASH, customerId);
    }
    @Test void createEmployeeUsesExistingUsersHashingAndRealLogin() throws Exception {
        var request = employee("NEW@people.test", "CASHIER", true); request.put("password", PASSWORD);
        var response = write(post("/api/admin/employees"), request, admin).andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("CASHIER")).andExpect(jsonPath("$.joinedAt").isNotEmpty())
                .andExpect(jsonPath("$.password").doesNotExist()).andExpect(jsonPath("$.passwordHash").doesNotExist()).andReturn().getResponse();
        String id = json.readTree(response.getContentAsString()).path("id").asText();
        var saved = users.findById(id).orElseThrow();
        assertThat(users.count()).isEqualTo(3);
        assertThat(saved.getPasswordHash()).isNotEqualTo(PASSWORD);
        assertThat(passwords.matches(PASSWORD, saved.getPasswordHash())).isTrue();
        var session = login("new@people.test");
        mvc.perform(get("/api/cashier/dashboard").cookie(session)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/employees").cookie(session)).andExpect(status().isForbidden());
        write(post("/api/admin/employees"), request, admin).andExpect(status().isConflict());
        request.put("email", "another@people.test"); request.put("password", "short");
        write(post("/api/admin/employees"), request, admin).andExpect(status().isBadRequest());
        request.put("password", "é".repeat(40));
        write(post("/api/admin/employees"), request, admin).andExpect(status().isBadRequest());
    }
    @Test void activationRoleEmailAndPasswordChangesInvalidatePreviouslyIssuedSessions() throws Exception {
        var previous = login(operator.email());
        var request = employee(operator.email(), "CASHIER", false);
        write(put("/api/admin/employees/" + operator.id()), request, admin).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(previous)).andExpect(status().isUnauthorized());
        write(post("/api/auth/login"), Map.of("email", operator.email(), "password", PASSWORD), null).andExpect(status().isUnauthorized());
        request.put("enabled", true);
        write(put("/api/admin/employees/" + operator.id()), request, admin).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(previous)).andExpect(status().isUnauthorized());
        var active = login(operator.email());
        request.put("role", "ADMIN");
        write(put("/api/admin/employees/" + operator.id()), request, admin).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(active)).andExpect(status().isUnauthorized());
        var promoted = login(operator.email());
        mvc.perform(get("/api/admin/employees").cookie(promoted)).andExpect(status().isOk());
        request.put("email", "changed@people.test"); request.put("password", "Changed-Password123");
        write(put("/api/admin/employees/" + operator.id()), request, admin).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(promoted)).andExpect(status().isUnauthorized());
        write(post("/api/auth/login"), Map.of("email", "changed@people.test", "password", "Changed-Password123"), null).andExpect(status().isOk());
    }
    @Test void selfDeactivationAndLastAdminDemotionAreRejected() throws Exception {
        write(put("/api/admin/employees/" + manager.id()), employee(manager.email(), "ADMIN", false), admin)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SELF_DEACTIVATION"));
        write(put("/api/admin/employees/" + manager.id()), employee(manager.email(), "CASHIER", true), admin)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_ADMIN"));
        assertThat(users.countByRoleAndEnabled(Role.ADMIN, true)).isEqualTo(1);
        write(delete("/api/admin/employees/" + manager.id()), null, admin).andExpect(status().isMethodNotAllowed());
    }
    @Test void concurrentAdminDemotionsLeaveAnActiveAdministrator() throws Exception {
        var other = users.saveAndFlush(new User("second-admin", "Second", "second@people.test", passwords.encode(PASSWORD), Role.ADMIN, ""));
        var actors = List.of(manager, UserResponse.from(other));
        var executor = Executors.newFixedThreadPool(2); var start = new CountDownLatch(1);
        try {
            var tasks = actors.stream().map(actor -> executor.submit(() -> {
                start.await();
                try { employees.save(actor.id(), new EmployeeRequest(actor.name(), actor.email(), "", Role.CASHIER, true, null), actor); return "saved"; }
                catch (CatalogException expected) { return expected.getCode(); }
            })).toList();
            start.countDown();
            var outcomes = new ArrayList<String>();
            for (var task : tasks) outcomes.add(task.get(15, TimeUnit.SECONDS));
            assertThat(outcomes).containsExactlyInAnyOrder("saved", "LAST_ADMIN");
            assertThat(users.countByRoleAndEnabled(Role.ADMIN, true)).isEqualTo(1);
        } finally { executor.shutdownNow(); }
    }
    @Test void profilesPersistOnlyAllowedFieldsWithoutChangingLoginOrRole() throws Exception {
        write(put("/api/profile"), Map.of("name", "Updated Cashier", "phone", "0777654321", "role", "ADMIN", "enabled", false, "email", "hacker@test.com"), cashier)
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated Cashier"))
                .andExpect(jsonPath("$.role").value("CASHIER")).andExpect(jsonPath("$.email").value(operator.email()));
        mvc.perform(get("/api/profile").cookie(cashier)).andExpect(jsonPath("$.phone").value("0777654321"));
        mvc.perform(get("/api/auth/me").cookie(cashier)).andExpect(status().isOk()).andExpect(jsonPath("$.user.name").value("Updated Cashier"));
        assertThat(users.findById(operator.id()).orElseThrow().isEnabled()).isTrue();
        login(operator.email());
        write(put("/api/profile"), Map.of("name", " ", "phone", "123"), cashier).andExpect(status().isBadRequest());
    }
    @Test void employeeSearchStatusRolePaginationAndPermissionChecksWork() throws Exception {
        mvc.perform(get("/api/admin/employees").cookie(admin).param("role", "CASHIER").param("q", "cashier").param("enabled", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(operator.id()));
        mvc.perform(get("/api/admin/employees").cookie(admin).param("size", "1")).andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/admin/employees").cookie(admin).param("q", "%")).andExpect(jsonPath("$.totalElements").value(0));
        for (String path : List.of("/api/admin/employees", "/api/admin/customers")) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).cookie(cashier)).andExpect(status().isForbidden());
            write(post(path), Map.of(), cashier).andExpect(status().isForbidden());
            mvc.perform(post(path).cookie(admin).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        }
        for (var filter : List.of(new String[]{"size", "101"}, new String[]{"page", "-1"}, new String[]{"role", "OWNER"}, new String[]{"enabled", "invalid"}))
            mvc.perform(get("/api/admin/employees").cookie(admin).param(filter[0], filter[1])).andExpect(status().isBadRequest());
    }
    @Test void customerCrudOptionalEmailSearchArchiveAndRestore() throws Exception {
        var response = write(post("/api/admin/customers"), Map.of("name", "First Customer", "phone", "0771234567", "enabled", true), admin)
                .andExpect(status().isCreated()).andExpect(jsonPath("$.visits").value(0)).andExpect(jsonPath("$.spent").value(0)).andReturn().getResponse();
        var id = json.readTree(response.getContentAsString()).path("id").asText();
        write(put("/api/admin/customers/" + id), Map.of("name", "Updated Customer", "phone", "0777654321", "email", "customer@test.com", "enabled", true), admin).andExpect(status().isOk());
        mvc.perform(get("/api/admin/customers/" + id).cookie(admin)).andExpect(jsonPath("$.email").value("customer@test.com"));
        mvc.perform(get("/api/admin/customers").cookie(admin).param("q", "7654321")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/pos/customers").cookie(cashier).param("q", "updated")).andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].spent").doesNotExist()).andExpect(jsonPath("$[0].email").doesNotExist());
        write(delete("/api/admin/customers/" + id), null, admin).andExpect(status().isNoContent());
        mvc.perform(get("/api/pos/customers").cookie(cashier)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/admin/customers").cookie(admin).param("enabled", "false")).andExpect(jsonPath("$.totalElements").value(1));
        write(put("/api/admin/customers/" + id), Map.of("name", "Restored", "phone", "0777654321", "enabled", true), admin).andExpect(status().isOk());
        mvc.perform(get("/api/pos/customers").cookie(cashier)).andExpect(jsonPath("$.length()").value(1));
        write(post("/api/admin/customers"), Map.of("name", "Bad", "phone", "letters", "enabled", true), admin).andExpect(status().isBadRequest());
        write(post("/api/admin/customers"), Map.of("name", "Bad", "phone", "0777654321", "email", "invalid", "enabled", true), admin).andExpect(status().isBadRequest());
    }
    @Test void customerCheckoutHistoryAndGuestCheckoutPreserveMoneyInventoryAndSnapshots() throws Exception {
        var customer = customer("Original Customer");
        var linked = checkout.checkout(order(UUID.randomUUID().toString(), customer.id()), operator);
        var guest = checkout.checkout(order(UUID.randomUUID().toString(), null), manager);
        assertThat(linked.total()).isEqualByComparingTo("6.99"); assertThat(guest.total()).isEqualByComparingTo(linked.total());
        assertThat(guest.customerId()).isNull(); assertThat(linked.customerId()).isEqualTo(customer.id());
        assertThat(jdbc.queryForObject("SELECT stock FROM inventory WHERE product_id=?", Long.class, productId)).isEqualTo(44);
        customerService.save(customer.id(), new CustomerRequest("Renamed", "0771111111", null, true));
        customerService.archive(customer.id());
        mvc.perform(get("/api/admin/customers/" + customer.id() + "/sales").cookie(admin).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.summary.revenue").value(6.99))
                .andExpect(jsonPath("$.content[0].id").value(linked.id()));
        mvc.perform(get("/api/admin/customers/" + customer.id()).cookie(admin)).andExpect(jsonPath("$.visits").value(1)).andExpect(jsonPath("$.spent").value(6.99));
        mvc.perform(get("/api/sales/" + linked.id()).cookie(cashier)).andExpect(jsonPath("$.sale.customerName").value("Original Customer"));
        mvc.perform(get("/api/admin/customers/" + customer.id() + "/sales").cookie(cashier)).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT SUM(total) FROM sales", BigDecimal.class)).isEqualByComparingTo("13.98");
    }
    @Test void customerValidationIsAtomicAndIdempotencyIncludesCustomerWithoutBreakingReplay() throws Exception {
        var first = customer("One"); var second = customer("Two");
        String key = UUID.randomUUID().toString(); var request = order(key, first.id());
        var sale = checkout.checkout(request, operator);
        customerService.archive(first.id());
        assertThat(checkout.checkout(request, operator).id()).isEqualTo(sale.id());
        assertThatThrownBy(() -> checkout.checkout(order(key, second.id()), operator)).isInstanceOf(CatalogException.class).hasMessageContaining("different order");
        assertThatThrownBy(() -> checkout.checkout(order(key, null), operator)).isInstanceOf(CatalogException.class).hasMessageContaining("different order");
        for (String id : List.of(first.id(), "missing")) {
            assertThatThrownBy(() -> checkout.checkout(order(UUID.randomUUID().toString(), id), operator)).isInstanceOf(CatalogException.class);
        }
        assertThat(sales.count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT stock FROM inventory WHERE product_id=?", Long.class, productId)).isEqualTo(47);
        // Original guest payload and fingerprint survive the optional field addition.
        var guest = new CheckoutRequest(UUID.randomUUID().toString(), request.items(), request.discount(), request.expectedTaxRate(), request.payment());
        var completed = checkout.checkout(guest, manager);
        assertThat(checkout.checkout(guest, manager).id()).isEqualTo(completed.id());
    }
}
