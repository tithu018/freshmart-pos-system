package com.freshmart;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.freshmart.config.AuthProperties;
import com.freshmart.model.Role;
import com.freshmart.model.User;
import com.freshmart.repository.UserRepository;
import com.freshmart.security.AuthCookies;
import com.freshmart.security.JwtService;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthIntegrationTest {
    private static final String PASSWORD = "Integration@Test123";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService tokens;
    @Autowired AuthProperties properties;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void setup() {
        users.deleteAll();
        String hash = passwords.encode(PASSWORD);
        users.save(new User("EMP-001", "Admin Test", "admin@freshmart.com", hash, Role.ADMIN, ""));
        users.save(new User("EMP-002", "Cashier Test", "cashier@freshmart.com", hash, Role.CASHIER, ""));
    }

    private MvcResult login(String email, String password) throws Exception {
        return mvc.perform(postWithCsrf("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", password))))
                .andReturn();
    }

    private MockHttpServletRequestBuilder postWithCsrf(String path) throws Exception {
        var result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        var token = json.readTree(result.getResponse().getContentAsString()).path("token").asText();
        return post(path).cookie(result.getResponse().getCookie("freshmart_csrf")).header("X-CSRF-TOKEN", token);
    }

    private Cookie access(String email) throws Exception {
        var result = login(email, PASSWORD);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return result.getResponse().getCookie(AuthCookies.NAME);
    }

    @Test
    void loginIssuesHttpOnlyJwtAndDoesNotExposePasswordOrToken() throws Exception {
        var result = login("ADMIN@FRESHMART.COM", PASSWORD);
        var response = result.getResponse();
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getContentAsString()).doesNotContain("password", "accessToken", "$2");
        var body = json.readTree(response.getContentAsString());
        assertThat(body.path("user").path("role").asText()).isEqualTo("ADMIN");
        assertThat(body.path("expiresAt").asText()).isNotBlank();
        Cookie cookie = response.getCookie(AuthCookies.NAME);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/api");
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
        assertThat(tokens.verify(cookie.getValue()).getSubject()).isEqualTo("EMP-001");
        assertThat(users.findById("EMP-001").orElseThrow().getPasswordHash()).startsWith("$2").isNotEqualTo(PASSWORD);
    }

    @Test
    void bothRolesCanReadTheirOwnSessionAndOnlyTheirOwnWorkspace() throws Exception {
        Cookie admin = access("admin@freshmart.com"), cashier = access("cashier@freshmart.com");
        mvc.perform(get("/api/auth/me").cookie(admin)).andExpect(status().isOk()).andExpect(jsonPath("$.user.role").value("ADMIN"));
        mvc.perform(get("/api/admin/access").cookie(admin)).andExpect(status().isOk());
        mvc.perform(get("/api/cashier/access").cookie(admin)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(get("/api/auth/me").cookie(cashier)).andExpect(status().isOk()).andExpect(jsonPath("$.user.role").value("CASHIER"));
        mvc.perform(get("/api/cashier/access").cookie(cashier)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/access").cookie(cashier)).andExpect(status().isForbidden());
    }

    @Test
    void unknownAndWrongPasswordProduceTheSameError() throws Exception {
        var wrongPassword = login("admin@freshmart.com", "not-the-password");
        var unknown = login("unknown@freshmart.com", PASSWORD);
        assertThat(wrongPassword.getResponse().getStatus()).isEqualTo(401);
        assertThat(unknown.getResponse().getStatus()).isEqualTo(401);
        assertThat(wrongPassword.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString());
    }

    @Test
    void rolesInLoginPayloadCannotGrantPermissions() throws Exception {
        var result = mvc.perform(postWithCsrf("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", "cashier@freshmart.com", "password", PASSWORD, "role", "ADMIN"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.role").value("CASHIER")).andReturn();
        mvc.perform(get("/api/admin/access").cookie(result.getResponse().getCookie(AuthCookies.NAME))).andExpect(status().isForbidden());
    }

    @Test
    void missingMalformedAndTamperedTokensAreUnauthorized() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/access")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(new Cookie(AuthCookies.NAME, "invalid.jwt.token")))
                .andExpect(status().isUnauthorized()).andExpect(cookie().maxAge(AuthCookies.NAME, 0));
        String valid = access("admin@freshmart.com").getValue();
        String[] parts = valid.split("\\.");
        parts[1] = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"sub\":\"EMP-002\",\"role\":\"ADMIN\"}".getBytes());
        mvc.perform(get("/api/auth/me").cookie(new Cookie(AuthCookies.NAME, String.join(".", parts))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredWrongAudienceAndMissingExpiryTokensAreRejected() throws Exception {
        for (String kind : List.of("expired", "audience", "expiry")) {
            var now = Instant.now();
            var claims = JwtClaimsSet.builder().subject("EMP-001").issuer(properties.jwtIssuer())
                    .issuedAt(now.minusSeconds(120)).claim("role", "ADMIN").claim("version", 0L)
                    .audience(List.of(kind.equals("audience") ? "other-app" : properties.jwtAudience()));
            if (!kind.equals("expiry")) claims.expiresAt(kind.equals("expired") ? now.minusSeconds(5) : now.plusSeconds(60));
            var encoder = new NimbusJwtEncoder(new ImmutableSecret<>(new SecretKeySpec(Base64.getDecoder().decode(properties.jwtSecret()), "HmacSHA256")));
            String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims.build())).getTokenValue();
            mvc.perform(get("/api/auth/me").cookie(new Cookie(AuthCookies.NAME, token))).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void logoutClearsCookieAndRevokesEveryPreviouslyIssuedToken() throws Exception {
        Cookie first = access("admin@freshmart.com"), second = access("admin@freshmart.com");
        mvc.perform(postWithCsrf("/api/auth/logout").cookie(first)).andExpect(status().isNoContent())
                .andExpect(cookie().maxAge(AuthCookies.NAME, 0));
        mvc.perform(get("/api/auth/me").cookie(first)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(second)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(access("admin@freshmart.com"))).andExpect(status().isOk());
    }

    @Test
    void disablingChangingRoleOrDeletingUserInvalidatesTheirToken() throws Exception {
        Cookie cookie = access("admin@freshmart.com");
        jdbc.update("UPDATE app_users SET enabled = FALSE WHERE id = 'EMP-001'");
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        assertThat(login("admin@freshmart.com", PASSWORD).getResponse().getStatus()).isEqualTo(401);
        jdbc.update("UPDATE app_users SET enabled = TRUE, role = 'CASHIER' WHERE id = 'EMP-001'");
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        Cookie current = access("admin@freshmart.com");
        users.deleteById("EMP-001");
        mvc.perform(get("/api/auth/me").cookie(current)).andExpect(status().isUnauthorized());
    }

    @Test
    void loginAndLogoutRequireCsrfAndRealCsrfHandshakeWorks() throws Exception {
        String credentials = json.writeValueAsString(Map.of("email", "admin@freshmart.com", "password", PASSWORD));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(credentials))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        var csrfResult = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        String token = json.readTree(csrfResult.getResponse().getContentAsString()).path("token").asText();
        var csrfCookie = csrfResult.getResponse().getCookie("freshmart_csrf");
        var result = mvc.perform(post("/api/auth/login").cookie(csrfCookie).header("X-CSRF-TOKEN", token)
                        .contentType(MediaType.APPLICATION_JSON).content(credentials)).andExpect(status().isOk()).andReturn();
        mvc.perform(post("/api/auth/logout").cookie(result.getResponse().getCookie(AuthCookies.NAME)))
                .andExpect(status().isForbidden());
    }

    @Test
    void corsAllowsConfiguredFrontendAndRejectsOtherOrigins() throws Exception {
        mvc.perform(options("/api/auth/login").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "Content-Type,X-CSRF-TOKEN"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(options("/api/auth/login").header("Origin", "https://untrusted.example")
                .header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden());
    }

    @Test
    void invalidBodiesAreCleanlyRejected() throws Exception {
        assertThat(login("invalid-email", "").getResponse().getStatus()).isEqualTo(400);
        assertThat(login("admin@freshmart.com", "é".repeat(50)).getResponse().getStatus()).isEqualTo(401);
        mvc.perform(postWithCsrf("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{bad-json"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}
