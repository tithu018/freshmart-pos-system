package com.freshmart;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.freshmart.model.Role;
import com.freshmart.model.User;
import com.freshmart.repository.*;
import com.freshmart.security.AuthCookies;
import com.freshmart.security.JwtService;
import jakarta.servlet.http.Cookie;
import java.util.HashMap;
import java.util.Map;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ContextConfiguration(initializers = TestDatabaseSafety.class)
@ActiveProfiles("test")
class CatalogIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired ProductRepository products;
    @Autowired CategoryRepository categories;
    @Autowired JwtService tokens;
    Cookie admin;
    Cookie cashier;

    @BeforeEach
    void setup() {
        products.deleteAll(); categories.deleteAll(); users.deleteAll();
        admin = session("catalog-admin", Role.ADMIN);
        cashier = session("catalog-cashier", Role.CASHIER);
    }
    private Cookie session(String id, Role role) {
        var user = users.save(new User(id, id, id + "@freshmart.com", "unused-test-hash", role, ""));
        return new Cookie(AuthCookies.NAME, tokens.issue(user).getTokenValue());
    }
    private ResultActions write(MockHttpServletRequestBuilder request, Cookie user, Object body) throws Exception {
        var csrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        request.cookie(user, csrf.getCookie("freshmart_csrf"))
                .header("X-CSRF-TOKEN", json.readTree(csrf.getContentAsString()).path("token").asText());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(request);
    }
    private Map<String, Object> category(String name) {
        return new HashMap<>(Map.of("name", name, "description", "Fresh groceries", "status", "ACTIVE"));
    }
    private Map<String, Object> product(String categoryId, String sku) {
        return new HashMap<>(Map.of("name", "Fresh apples", "sku", sku, "barcode", "001234567890",
                "categoryId", categoryId, "price", "2.50", "description", "Locally grown", "status", "ACTIVE"));
    }
    private JsonNode created(MockHttpServletRequestBuilder request, Object body) throws Exception {
        var response = write(request, admin, body).andExpect(status().isCreated()).andReturn().getResponse();
        assertThat(response.getHeader("Location")).isNotBlank();
        return json.readTree(response.getContentAsString());
    }
    private String createCategory(String name) throws Exception {
        return created(post("/api/categories"), category(name)).path("id").asText();
    }

    @Test
    void adminCrudPersistsAndRenamesCategoriesWithoutBreakingAssignments() throws Exception {
        String first = createCategory("Fruit"), second = createCategory("Other");
        var request = product(first, " fru-001 ");
        String id = created(post("/api/products"), request).path("id").asText();
        assertThat(products.findById(id)).isPresent();
        mvc.perform(get("/api/products/" + id).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.sku").value("FRU-001")).andExpect(jsonPath("$.barcode").value("001234567890"))
                .andExpect(jsonPath("$.price").value(2.50)).andExpect(jsonPath("$.category").value("Fruit"));
        mvc.perform(get("/api/categories/" + first).cookie(admin)).andExpect(jsonPath("$.productCount").value(1));
        write(put("/api/categories/" + first), admin, category("Fresh Fruit")).andExpect(status().isOk());
        mvc.perform(get("/api/products/" + id).cookie(admin)).andExpect(jsonPath("$.category").value("Fresh Fruit"));
        write(delete("/api/categories/" + first), admin, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATEGORY_IN_USE"));
        request.put("categoryId", second); request.put("status", "INACTIVE"); request.put("price", "3.75");
        write(put("/api/products/" + id), admin, request).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INACTIVE")).andExpect(jsonPath("$.price").value(3.75));
        write(delete("/api/categories/" + first), admin, null).andExpect(status().isNoContent());
        write(delete("/api/products/" + id), admin, null).andExpect(status().isNoContent());
        write(delete("/api/categories/" + second), admin, null).andExpect(status().isNoContent());
        assertThat(products.count()).isZero(); assertThat(categories.count()).isZero();
    }

    @Test
    void cashierCanReadBothResourcesButCannotPerformAnyWrites() throws Exception {
        String categoryId = createCategory("Fruit");
        var payload = product(categoryId, "FRU-001");
        String productId = created(post("/api/products"), payload).path("id").asText();
        for (String path : new String[]{"/api/products", "/api/categories", "/api/products/" + productId, "/api/categories/" + categoryId})
            mvc.perform(get(path).cookie(cashier)).andExpect(status().isOk());
        for (String resource : new String[]{"products", "categories"}) {
            String path = "/api/" + resource;
            String id = resource.equals("products") ? productId : categoryId;
            Object body = resource.equals("products") ? payload : category("Changed");
            write(post(path), cashier, body).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
            write(put(path + "/" + id), cashier, body).andExpect(status().isForbidden());
            write(delete(path + "/" + id), cashier, null).andExpect(status().isForbidden());
        }
        assertThat(products.count()).isEqualTo(1); assertThat(categories.count()).isEqualTo(1);
    }

    @Test
    void anonymousRequestsAndMissingCsrfCannotModifyCatalog() throws Exception {
        mvc.perform(get("/api/products")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/categories")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/categories").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(category("Fruit")))).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(categories.count()).isZero();
    }

    @Test
    void duplicateNamesSkusAndBarcodesAreRejectedAndBlankBarcodesAreOptional() throws Exception {
        String categoryId = createCategory("Fruit");
        write(post("/api/categories"), admin, category(" fruit ")).andExpect(status().isConflict());
        var payload = product(categoryId, "FRU-001");
        created(post("/api/products"), payload);
        payload.put("sku", " fru-001 "); payload.put("barcode", "other");
        write(post("/api/products"), admin, payload).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_SKU"));
        payload.put("sku", "FRU-002"); payload.put("barcode", "001234567890");
        write(post("/api/products"), admin, payload).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_BARCODE"));
        payload.put("barcode", " "); created(post("/api/products"), payload);
        payload.put("sku", "FRU-003"); created(post("/api/products"), payload);
        assertThat(products.count()).isEqualTo(3);
    }

    @Test
    void productSearchAndCombinedFiltersWorkIncludingLiteralWildcards() throws Exception {
        String categoryId = createCategory("Fruit");
        var payload = product(categoryId, "FRU-001");
        payload.put("name", "100% fresh_apples");
        created(post("/api/products"), payload);
        for (String term : new String[]{"APPLES", "fru-001", "001234", "locally", "%", "_"})
            mvc.perform(get("/api/products").param("q", term).param("categoryId", categoryId)
                    .param("status", "ACTIVE").cookie(cashier)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/products").param("status", "INACTIVE").cookie(admin)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/products").param("categoryId", "missing").cookie(admin)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/categories").param("q", "FRUIT").cookie(cashier)).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void validationAndMissingRecordsReturnUsefulErrors() throws Exception {
        String categoryId = createCategory("Fruit");
        var payload = product(categoryId, "FRU-001");
        for (String price : new String[]{"0", "-1", "1.001", "10000000000"}) {
            payload.put("price", price);
            write(post("/api/products"), admin, payload).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        }
        payload.put("price", "1.00"); payload.put("categoryId", "missing");
        write(post("/api/products"), admin, payload).andExpect(status().isNotFound());
        payload.put("categoryId", categoryId); payload.put("status", "UNKNOWN");
        write(post("/api/products"), admin, payload).andExpect(status().isBadRequest());
        payload.put("status", "ACTIVE"); payload.put("name", " ");
        write(post("/api/products"), admin, payload).andExpect(status().isBadRequest());
        write(post("/api/categories"), admin, category(" ")).andExpect(status().isBadRequest());
        for (String path : new String[]{"/api/products/missing", "/api/categories/missing"}) {
            mvc.perform(get(path).cookie(admin)).andExpect(status().isNotFound());
            write(delete(path), admin, null).andExpect(status().isNotFound());
        }
        mvc.perform(get("/api/products").param("status", "bad").cookie(admin)).andExpect(status().isBadRequest());
        assertThat(products.count()).isZero();
    }

    @Test
    void corsAllowsFrontendPutAndDelete() throws Exception {
        for (String method : new String[]{"PUT", "DELETE"})
            mvc.perform(options("/api/products/example").header("Origin", "http://localhost:5173")
                    .header("Access-Control-Request-Method", method).header("Access-Control-Request-Headers", "Content-Type,X-CSRF-TOKEN"))
                    .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }
}
