package com.freshmart.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record AuthProperties(String jwtSecret, String jwtIssuer, String jwtAudience,
        Duration jwtTtl, boolean secureCookies, List<String> allowedOrigins) {}
