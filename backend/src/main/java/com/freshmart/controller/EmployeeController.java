package com.freshmart.controller;

import com.freshmart.dto.*;
import com.freshmart.dto.People.*;
import com.freshmart.model.Role;
import com.freshmart.security.AuthenticatedUser;
import com.freshmart.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class EmployeeController {
    private final EmployeeService employees;
    public EmployeeController(EmployeeService employees) { this.employees = employees; }
    @GetMapping("/api/admin/employees")
    public People.Page<Employee> list(@AuthenticationPrincipal AuthenticatedUser actor,
            @RequestParam(required=false) String q, @RequestParam(required=false) Role role, @RequestParam(required=false) Boolean enabled,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="10") int size) {
        return employees.list(actor.user(), q, role, enabled, page, size);
    }
    @PostMapping("/api/admin/employees") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public Employee create(@AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody EmployeeRequest request) { return employees.save(null, request, actor.user()); }
    @PutMapping("/api/admin/employees/{id}")
    public Employee update(@PathVariable String id, @AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody EmployeeRequest request) { return employees.save(id, request, actor.user()); }
    @GetMapping("/api/profile")
    public UserResponse profile(@AuthenticationPrincipal AuthenticatedUser actor) { return employees.profile(actor.user()); }
    @PutMapping("/api/profile")
    public UserResponse profile(@AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody ProfileRequest request) { return employees.profile(actor.user(), request); }
}
