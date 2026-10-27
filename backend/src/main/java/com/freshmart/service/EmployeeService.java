package com.freshmart.service;

import com.freshmart.dto.*;
import com.freshmart.dto.People.*;
import com.freshmart.model.*;
import com.freshmart.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true)
public class EmployeeService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    public EmployeeService(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc) {
        this.users = users; this.passwords = passwords; this.jdbc = jdbc;
    }
    public static String search(String q, int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100 || (q != null && q.length() > 100))
            throw new CatalogException(400, "INVALID_FILTER", "Use a search up to 100 characters, a valid page and a size from 1 to 100.");
        return "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
    private User require(String id) { return users.findById(id).orElseThrow(() -> CatalogException.missing("Employee")); }
    private void admin(UserResponse actor) {
        User current = require(actor.id());
        if (!current.isEnabled() || current.getRole() != Role.ADMIN) throw new CatalogException(403, "FORBIDDEN", "Only Admin can manage employees.");
    }
    public People.Page<Employee> list(UserResponse actor, String q, Role role, Boolean enabled, int page, int size) {
        admin(actor); String pattern = search(q, page, size);
        var results = users.findAll((root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern, '\\'), cb.like(cb.lower(root.get("email")), pattern, '\\'), cb.like(root.get("phone"), pattern, '\\')));
            if (role != null) predicates.add(cb.equal(root.get("role"), role));
            if (enabled != null) predicates.add(cb.equal(root.get("enabled"), enabled));
            return cb.and(predicates.toArray(Predicate[]::new));
        }, PageRequest.of(page, size, Sort.by("name", "id")));
        return new People.Page<>(results.map(Employee::from).getContent(), page, size, results.getTotalElements(),
                new Summary(users.count(), users.countByEnabled(true), users.countByRole(Role.CASHIER), BigDecimal.ZERO));
    }
    @Transactional
    public Employee save(String id, EmployeeRequest request, UserResponse actor) {
        // Serialize account changes so concurrent demotions cannot remove all active Admins.
        jdbc.queryForObject("SELECT id FROM employee_management_guard WHERE id=1 FOR UPDATE", Integer.class);
        admin(actor);
        String name = request.name().trim(), email = request.email().trim().toLowerCase(Locale.ROOT);
        String phone = request.phone() == null ? "" : request.phone().trim();
        String password = request.password();
        boolean changingPassword = password != null && !password.isEmpty();
        if ((id == null || changingPassword) && (password == null || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72))
            throw new CatalogException(400, "INVALID_PASSWORD", "Use a password of at least 12 characters and at most 72 UTF-8 bytes.");
        String userId = id == null ? UUID.randomUUID().toString() : id;
        if (users.existsByEmailAndIdNot(email, userId)) throw new CatalogException(409, "DUPLICATE_EMAIL", "An employee with this email already exists.");
        var user = id == null ? new User(userId, name, email, passwords.encode(password), request.role(), phone) : require(id);
        if (id != null && id.equals(actor.id()) && !request.enabled())
            throw new CatalogException(409, "SELF_DEACTIVATION", "You cannot deactivate your own account.");
        if (id != null && user.isEnabled() && user.getRole() == Role.ADMIN
                && (!request.enabled() || request.role() != Role.ADMIN) && users.countByRoleAndEnabled(Role.ADMIN, true) <= 1)
            throw new CatalogException(409, "LAST_ADMIN", "At least one active Admin must remain.");
        user.updateAccount(name, email, phone, request.role(), request.enabled(), id != null && changingPassword ? passwords.encode(password) : null);
        return Employee.from(users.saveAndFlush(user));
    }
    public UserResponse profile(UserResponse actor) { return UserResponse.from(require(actor.id())); }
    @Transactional
    public UserResponse profile(UserResponse actor, ProfileRequest request) {
        jdbc.queryForObject("SELECT id FROM employee_management_guard WHERE id=1 FOR UPDATE", Integer.class);
        User user = require(actor.id());
        if (!user.isEnabled()) throw new CatalogException(401, "UNAUTHENTICATED", "Please sign in again.");
        user.updateProfile(request.name().trim(), request.phone() == null ? "" : request.phone().trim());
        return UserResponse.from(users.saveAndFlush(user));
    }
}
