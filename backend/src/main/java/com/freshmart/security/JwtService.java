package com.freshmart.security;

import com.freshmart.config.AuthProperties;
import com.freshmart.model.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final AuthProperties properties;
    private final JwtEncoder encoder;
    private final JwtDecoder decoder;

    public JwtService(AuthProperties properties) {
        this.properties = properties;
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(properties.jwtSecret());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new IllegalStateException("JWT_SECRET must be a Base64-encoded random key of at least 32 bytes.");
        }
        if (bytes.length < 32) {
            throw new IllegalStateException("Set JWT_SECRET to at least 32 random bytes encoded as Base64.");
        }
        if (properties.jwtTtl() == null || properties.jwtTtl().isNegative()
                || properties.jwtTtl().isZero() || properties.jwtTtl().compareTo(Duration.ofHours(24)) > 0) {
            throw new IllegalStateException("JWT_TTL must be greater than zero and no more than 24 hours.");
        }
        var key = new SecretKeySpec(bytes, "HmacSHA256");
        encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        var jwtDecoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        jwtDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(properties.jwtIssuer())));
        decoder = jwtDecoder;
    }

    public Jwt issue(User user) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder()
                .issuer(properties.jwtIssuer()).audience(List.of(properties.jwtAudience()))
                .subject(user.getId()).issuedAt(now).notBefore(now)
                .expiresAt(now.plus(properties.jwtTtl())).id(UUID.randomUUID().toString())
                .claim("role", user.getRole().name()).claim("version", user.getAuthVersion()).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims));
    }

    public Jwt verify(String token) {
        Jwt jwt = decoder.decode(token);
        if (jwt.getExpiresAt() == null || jwt.getSubject() == null || jwt.getIssuedAt() == null
                || jwt.getAudience() == null || !jwt.getAudience().contains(properties.jwtAudience())
                || !(jwt.getClaim("version") instanceof Number) || jwt.getClaimAsString("role") == null) {
            throw new BadJwtException("Invalid token claims");
        }
        return jwt;
    }
}
