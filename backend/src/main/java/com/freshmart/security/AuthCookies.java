package com.freshmart.security;

import com.freshmart.config.AuthProperties;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookies {
    public static final String NAME = "freshmart_access";
    private final AuthProperties properties;

    public AuthCookies(AuthProperties properties) { this.properties = properties; }

    public void set(HttpServletResponse response, String token) {
        write(response, token, properties.jwtTtl());
    }

    public void clear(HttpServletResponse response) { write(response, "", Duration.ZERO); }

    private void write(HttpServletResponse response, String token, Duration ttl) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(NAME, token)
                .httpOnly(true).secure(properties.secureCookies()).sameSite("Lax")
                .path("/api").maxAge(ttl).build().toString());
    }
}
