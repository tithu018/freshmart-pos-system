package com.freshmart.controller;

import com.freshmart.dto.*;
import com.freshmart.model.PaymentMethod;
import com.freshmart.security.AuthenticatedUser;
import com.freshmart.service.SalesHistoryService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sales")
public class SalesController {
    private final SalesHistoryService history;
    public SalesController(SalesHistoryService history) { this.history = history; }
    @GetMapping public SalesPage list(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PaymentMethod payment, @RequestParam(required = false) String cashierId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "occurredAt") String sort, @RequestParam(defaultValue = "desc") String direction) {
        return history.list(principal.user(), q, from, to, payment, cashierId, page, size, sort, direction);
    }
    @GetMapping("/cashiers") public List<SalesPage.Cashier> cashiers(@AuthenticationPrincipal AuthenticatedUser principal) {
        return history.cashiers(principal.user());
    }
    @GetMapping("/{id}") public SaleDetails details(@PathVariable String id, @AuthenticationPrincipal AuthenticatedUser principal) {
        return history.details(id, principal.user());
    }
}
