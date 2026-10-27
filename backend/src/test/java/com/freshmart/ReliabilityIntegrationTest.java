package com.freshmart;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.freshmart.model.*;
import com.freshmart.repository.UserRepository;
import com.freshmart.security.*;
import jakarta.servlet.http.Cookie;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "debug=true")
@AutoConfigureMockMvc
@org.springframework.test.context.ContextConfiguration(initializers = TestDatabaseSafety.class)
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class ReliabilityIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtService tokens;
    Cookie admin, cashier;

    @BeforeEach void setup() {
        for (String table : List.of("stock_movements", "sale_items", "sales", "inventory", "products", "categories", "customers", "app_users"))
            jdbc.update("DELETE FROM " + table);
        admin = session("reliability-admin", Role.ADMIN);
        cashier = session("reliability-cashier", Role.CASHIER);
    }
    Cookie session(String id, Role role) {
        return new Cookie(AuthCookies.NAME, tokens.issue(users.saveAndFlush(new User(id, id, id + "@test.local", "unused", role, ""))).getTokenValue());
    }
    ResultActions write(MockHttpServletRequestBuilder request, String body) throws Exception {
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        return mvc.perform(request.cookie(admin, csrf.getCookie("freshmart_csrf"))
                .header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }
    @Test void numericEnumsCannotSilentlySelectRolesStatusesOrPayments() throws Exception {
        write(post("/api/admin/employees"), """
                {"name":"New employee","email":"new@test.local","role":0,"enabled":true,"password":"Test-only-password123"}
                """).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        write(post("/api/categories"), "{\"name\":\"Fruit\",\"status\":0}")
                .andExpect(status().isBadRequest());
        write(post("/api/checkout"), """
                {"idempotencyKey":"00000000-0000-0000-0000-000000000001","items":[{"productId":"missing","quantity":1,"expectedUnitPrice":1}],"discount":0,"expectedTaxRate":0,"payment":0}
                """).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        assertThat(users.count()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sales", Long.class)).isZero();
    }
    @Test void nullNestedCheckoutItemsAndMalformedBodiesReturnSafeErrors() throws Exception {
        write(post("/api/checkout"), """
                {"idempotencyKey":"00000000-0000-0000-0000-000000000002","items":[null],"discount":0,"expectedTaxRate":0,"payment":"CASH"}
                """).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        for (String path : List.of("/api/admin/customers", "/api/admin/employees", "/api/products", "/api/categories", "/api/checkout")) {
            var response = write(post(path), "{malformed-secret-value").andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST")).andReturn().getResponse();
            assertThat(response.getContentAsString()).doesNotContain("malformed-secret-value", "Exception", "stackTrace", "org.");
        }
    }
    @Test void unsupportedContentTypesAndUnknownResourcesUseJsonErrors() throws Exception {
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        mvc.perform(post("/api/admin/customers").cookie(admin, csrf.getCookie("freshmart_csrf"))
                .header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText())
                .contentType(MediaType.TEXT_PLAIN).content("private-content"))
                .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
        mvc.perform(get("/api/admin/does-not-exist").cookie(admin))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        write(put("/api/admin/employees"), "{}")
                .andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }
    @Test void allAdminDirectoriesReportsAndMutationRoutesDenyCashiers() throws Exception {
        for (String path : List.of("/api/admin/employees", "/api/admin/customers", "/api/admin/customers/missing/sales", "/api/admin/reports", "/api/admin/reports/csv", "/api/admin/dashboard", "/api/inventory/movements", "/api/sales/cashiers")) {
            mvc.perform(get(path).cookie(cashier)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
    }
    @Test void invalidFiltersCannotFallThroughToUnboundedQueries() throws Exception {
        for (String path : List.of("/api/admin/employees", "/api/admin/customers", "/api/sales")) {
            mvc.perform(get(path).cookie(admin).param("page", "-1")).andExpect(status().isBadRequest());
            mvc.perform(get(path).cookie(admin).param("size", "1000000")).andExpect(status().isBadRequest());
            mvc.perform(get(path).cookie(admin).param("page", "abc")).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/admin/reports/csv").cookie(admin).param("period", "custom").param("from", "bad").param("to", "2026-10-01"))
                .andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }
    @Test void rejectedPasswordsAreNotWrittenToApplicationLogs(CapturedOutput output) throws Exception {
        String secret = "Sensitive-test-password-".repeat(4);
        write(post("/api/auth/login"), json.writeValueAsString(Map.of("email", "test@example.com", "password", secret)))
                .andExpect(status().isBadRequest());
        write(post("/api/admin/employees"), json.writeValueAsString(Map.of("name", "Test", "email", "test@example.com", "password", secret, "role", "CASHIER", "enabled", true)))
                .andExpect(status().isBadRequest());
        assertThat(output.getAll()).doesNotContain(secret);
    }
}
