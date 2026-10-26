package com.freshmart.controller;

import com.freshmart.dto.*;
import com.freshmart.security.AuthenticatedUser;
import com.freshmart.service.SalesService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CheckoutController {
    private final SalesService sales;
    public CheckoutController(SalesService sales) { this.sales = sales; }
    @GetMapping("/pos/products") public List<InventoryResponse> products(@RequestParam(required = false) String q,
            @RequestParam(required = false) String categoryId) { return sales.catalog(q, categoryId); }
    @GetMapping("/pos/config") public Map<String, BigDecimal> config() {
        return Map.of("taxRate", sales.taxRate(), "maxTotal", SalesService.MAX_TOTAL);
    }
    @PostMapping("/checkout") public CheckoutResponse checkout(@Valid @RequestBody CheckoutRequest request,
            @AuthenticationPrincipal AuthenticatedUser principal) { return sales.checkout(request, principal.user()); }
}
