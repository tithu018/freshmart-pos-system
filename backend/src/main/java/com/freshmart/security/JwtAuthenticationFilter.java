package com.freshmart.security;

import com.freshmart.dto.UserResponse;
import com.freshmart.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.filter.OncePerRequestFilter;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService tokens;
    private final UserRepository users;
    private final AuthCookies cookies;

    public JwtAuthenticationFilter(JwtService tokens, UserRepository users, AuthCookies cookies) {
        this.tokens = tokens;
        this.users = users;
        this.cookies = cookies;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // An expired or revoked cookie must not prevent signing in again.
        return request.getServletPath().equals("/api/auth/login")
                || request.getServletPath().equals("/api/auth/csrf");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String token = request.getCookies() == null ? null : Arrays.stream(request.getCookies())
                .filter(cookie -> AuthCookies.NAME.equals(cookie.getName())).map(Cookie::getValue)
                .findFirst().orElse(null);
        if (token != null) {
            try {
                var jwt = tokens.verify(token);
                var user = users.findById(jwt.getSubject()).orElse(null);
                Number version = jwt.getClaim("version");
                if (user != null && user.isEnabled() && user.getAuthVersion() == version.longValue()
                        && user.getRole().name().equals(jwt.getClaimAsString("role"))) {
                    var principal = new AuthenticatedUser(UserResponse.from(user), jwt.getExpiresAt());
                    var authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } else {
                    cookies.clear(response);
                }
            } catch (JwtException | IllegalArgumentException exception) {
                SecurityContextHolder.clearContext();
                cookies.clear(response);
            }
        }
        chain.doFilter(request, response);
    }
}
