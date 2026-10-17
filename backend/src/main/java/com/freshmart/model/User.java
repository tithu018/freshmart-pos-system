package com.freshmart.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Locale;

@Entity
@Table(name = "app_users")
public class User {
    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "full_name", nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    @Column(length = 40)
    private String phone;

    @Column(nullable = false)
    private boolean enabled = true;

    @JsonIgnore
    @Column(name = "auth_version", nullable = false)
    private long authVersion;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected User() {}

    public User(String id, String name, String email, String passwordHash, Role role, String phone) {
        this.id = id;
        this.name = name;
        this.email = email.trim().toLowerCase(Locale.ROOT);
        this.passwordHash = passwordHash;
        this.role = role;
        this.phone = phone;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public String getPhone() { return phone; }
    public boolean isEnabled() { return enabled; }
    public long getAuthVersion() { return authVersion; }
}
