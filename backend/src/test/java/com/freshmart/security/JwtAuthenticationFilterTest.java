package com.freshmart.security;

import com.freshmart.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.*;
import org.springframework.security.oauth2.jwt.Jwt;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {
    @Test void databaseOutageReturnsRetryableJsonWithoutRevokingTheCookieOrLeakingDetails() throws Exception {
        var tokens = mock(JwtService.class);
        var users = mock(UserRepository.class);
        var cookies = mock(AuthCookies.class);
        when(tokens.verify("test-cookie")).thenReturn(Jwt.withTokenValue("test-cookie").header("alg", "HS256")
                .subject("employee").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60))
                .claim("role", "ADMIN").claim("version", 0L).build());
        when(users.findById("employee")).thenThrow(new DataAccessResourceFailureException("private database connection details"));
        var request = new MockHttpServletRequest("GET", "/api/admin/employees");
        request.setServletPath("/api/admin/employees");
        request.setCookies(new Cookie(AuthCookies.NAME, "test-cookie"));
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        new JwtAuthenticationFilter(tokens, users, cookies).doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("SERVICE_UNAVAILABLE").doesNotContain("private", "test-cookie", "Exception");
        assertThat(chain.getRequest()).isNull();
        verifyNoInteractions(cookies);
    }
}
