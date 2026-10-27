package com.freshmart.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.freshmart.model.Role;
import com.freshmart.model.User;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class People {
    private People() {}
    public record EmployeeRequest(@NotBlank @Size(max=100) String name,
            @NotBlank @Email @Size(max=254) String email, @Size(max=40) String phone,
            @NotNull Role role, @NotNull Boolean enabled,
            @JsonProperty(access=JsonProperty.Access.WRITE_ONLY) @Size(max=72) String password) {
        public EmployeeRequest {
            name = name == null ? null : name.trim();
            email = email == null ? null : email.trim();
            phone = phone == null ? "" : phone.trim();
        }
        @Override public String toString() { return "EmployeeRequest[role=" + role + ", enabled=" + enabled + ", password=<redacted>]"; }
    }
    public record ProfileRequest(@NotBlank @Size(max=100) String name, @Size(max=40) String phone) {}
    public record Employee(String id, String name, String email, String phone, Role role, boolean enabled, Instant joinedAt) {
        public static Employee from(User u) { return new Employee(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getRole(), u.isEnabled(), u.getCreatedAt()); }
    }
    public record CustomerRequest(@NotBlank @Size(max=100) String name,
            @NotBlank @Size(max=40) @Pattern(regexp="(?=(?:\\D*\\d){5,})[+0-9() .-]+", message="Enter a valid phone number.") String phone,
            @Email @Size(max=254) String email, @NotNull Boolean enabled) {
        public CustomerRequest {
            name = name == null ? null : name.trim(); phone = phone == null ? null : phone.trim();
            email = email == null || email.isBlank() ? null : email.trim();
        }
    }
    public record Customer(String id, String name, String phone, String email, boolean enabled,
            Instant joinedAt, long visits, BigDecimal spent) {}
    public record CustomerOption(String id, String name, String phone) {}
    public record Summary(long total, long active, long cashiers, BigDecimal spending) {}
    public record Page<T>(List<T> content, int page, int size, long totalElements, Summary summary) {}
}
