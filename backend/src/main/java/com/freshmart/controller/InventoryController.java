package com.freshmart.controller;

import com.freshmart.dto.*;
import com.freshmart.model.StockStatus;
import com.freshmart.security.AuthenticatedUser;
import com.freshmart.service.InventoryService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    private final InventoryService inventory;
    public InventoryController(InventoryService inventory) { this.inventory = inventory; }
    @GetMapping public List<InventoryResponse> list(@RequestParam(required = false) String q,
            @RequestParam(required = false) String categoryId, @RequestParam(required = false) StockStatus status) {
        return inventory.list(q, categoryId, status);
    }
    @GetMapping("/summary") public InventorySummary summary() { return inventory.summary(); }
    @GetMapping("/movements") public List<StockMovementResponse> history(@RequestParam(required = false) String productId) {
        return inventory.history(productId);
    }
    @GetMapping("/{id}") public InventoryResponse get(@PathVariable String id) { return inventory.get(id); }
    @PostMapping("/{id}/movements") public InventoryResponse adjust(@PathVariable String id,
            @Valid @RequestBody StockAdjustmentRequest request, @AuthenticationPrincipal AuthenticatedUser principal) {
        return inventory.adjust(id, request, principal.user());
    }
    @PutMapping("/{id}/threshold") public InventoryResponse threshold(@PathVariable String id,
            @Valid @RequestBody StockThresholdRequest request, @AuthenticationPrincipal AuthenticatedUser principal) {
        return inventory.threshold(id, request, principal.user());
    }
}
