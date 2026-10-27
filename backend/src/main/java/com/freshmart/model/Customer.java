package com.freshmart.model;

import com.freshmart.dto.People.CustomerRequest;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name="customers")
public class Customer {
    @Id @Column(length=36) private String id = UUID.randomUUID().toString();
    @Column(nullable=false, length=100) private String name;
    @Column(nullable=false, length=40) private String phone;
    @Column(length=254) private String email;
    @Column(nullable=false) private boolean enabled;
    @Column(name="created_at", nullable=false) private Instant createdAt = Instant.now();
    protected Customer() {}
    public Customer(CustomerRequest request) { update(request); }
    public void update(CustomerRequest request) {
        name = request.name().trim(); phone = request.phone().trim();
        email = request.email() == null || request.email().isBlank() ? null : request.email().trim().toLowerCase(Locale.ROOT);
        enabled = request.enabled();
    }
    public String getId() { return id; }
    public String getName() { return name; }
    public boolean isEnabled() { return enabled; }
    public void deactivate() { enabled = false; }
}
