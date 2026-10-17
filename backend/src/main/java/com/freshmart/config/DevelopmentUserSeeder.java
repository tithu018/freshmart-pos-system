package com.freshmart.config;

import com.freshmart.model.Role;
import com.freshmart.model.User;
import com.freshmart.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev")
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DevelopmentUserSeeder implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String adminPassword;
    private final String cashierPassword;

    public DevelopmentUserSeeder(UserRepository users, PasswordEncoder passwords,
            @Value("${app.seed.admin-password}") String adminPassword,
            @Value("${app.seed.cashier-password}") String cashierPassword) {
        this.users = users;
        this.passwords = passwords;
        this.adminPassword = adminPassword;
        this.cashierPassword = cashierPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        seed("EMP-001", "Alex Morgan", "admin@freshmart.com", adminPassword, Role.ADMIN, "+94 77 234 8900");
        seed("EMP-002", "Sarah Kim", "cashier@freshmart.com", cashierPassword, Role.CASHIER, "+94 76 456 8900");
    }

    private void seed(String id, String name, String email, String password, Role role, String phone) {
        if (users.existsByEmail(email)) return;
        if (password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("Development account passwords must contain at least 12 characters and at most 72 UTF-8 bytes.");
        }
        users.save(new User(id, name, email, passwords.encode(password), role, phone));
    }
}
