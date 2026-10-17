package com.freshmart.controller;

import com.freshmart.dto.AuthResponse;
import com.freshmart.dto.LoginRequest;
import com.freshmart.dto.UserResponse;
import com.freshmart.security.AuthCookies;
import com.freshmart.security.AuthenticatedUser;
import com.freshmart.security.JwtService;
import com.freshmart.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final JwtService tokens;
    private final AuthCookies cookies;
    private final CookieCsrfTokenRepository csrf;

    public AuthController(AuthService auth, JwtService tokens, AuthCookies cookies, CookieCsrfTokenRepository csrf) {
        this.auth = auth;
        this.tokens = tokens;
        this.cookies = cookies;
        this.csrf = csrf;
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest credentials,
            HttpServletRequest request, HttpServletResponse response) {
        var user = auth.authenticate(credentials);
        var jwt = tokens.issue(user);
        csrf.saveToken(null, request, response);
        cookies.set(response, jwt.getTokenValue());
        return new AuthResponse(UserResponse.from(user), jwt.getExpiresAt());
    }

    @GetMapping("/me")
    public AuthResponse me(@AuthenticationPrincipal AuthenticatedUser principal) {
        return new AuthResponse(principal.user(), principal.expiresAt());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthenticatedUser principal,
            HttpServletRequest request, HttpServletResponse response) {
        auth.logout(principal.user().id());
        cookies.clear(response);
        csrf.saveToken(null, request, response);
        return ResponseEntity.noContent().build();
    }
}
