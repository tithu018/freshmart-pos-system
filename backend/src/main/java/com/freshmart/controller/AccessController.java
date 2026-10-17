package com.freshmart.controller;

import com.freshmart.dto.UserResponse;
import com.freshmart.security.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Role access checks only; no dashboard, POS, or sales business logic. */
@RestController
public class AccessController {
    @GetMapping("/api/admin/access")
    public UserResponse admin(@AuthenticationPrincipal AuthenticatedUser principal) { return principal.user(); }

    @GetMapping("/api/cashier/access")
    public UserResponse cashier(@AuthenticationPrincipal AuthenticatedUser principal) { return principal.user(); }
}
