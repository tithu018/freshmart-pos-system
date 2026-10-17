package com.freshmart.service;

import com.freshmart.dto.LoginRequest;
import com.freshmart.model.User;
import com.freshmart.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        // Unknown accounts still incur a BCrypt check; errors never reveal account existence.
        dummyHash = passwords.encode("freshmart-internal-timing-check");
    }

    @Transactional(readOnly = true)
    public User authenticate(LoginRequest request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadCredentialsException("Invalid email or password.");
        }
        var user = users.findByEmail(request.email().trim().toLowerCase(Locale.ROOT)).orElse(null);
        boolean matches = passwords.matches(request.password(), user == null ? dummyHash : user.getPasswordHash());
        if (!matches || user == null || !user.isEnabled()) {
            throw new BadCredentialsException("Invalid email or password.");
        }
        return user;
    }

    @Transactional
    public void logout(String userId) {
        // Invalidate every JWT previously issued for this account, including copied cookies.
        users.revokeSessions(userId);
    }
}
