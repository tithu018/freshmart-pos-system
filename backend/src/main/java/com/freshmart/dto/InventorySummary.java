package com.freshmart.dto;

import com.freshmart.model.StockStatus;
import java.math.BigDecimal;
import java.util.List;

public record InventorySummary(long products, long units, BigDecimal value, long lowStock, long outOfStock) {
    public static InventorySummary from(List<InventoryResponse> items) {
        return new InventorySummary(items.size(), items.stream().mapToLong(InventoryResponse::stock).sum(),
                items.stream().map(i -> i.price().multiply(BigDecimal.valueOf(i.stock()))).reduce(BigDecimal.ZERO, BigDecimal::add),
                items.stream().filter(i -> i.stockStatus() == StockStatus.LOW_STOCK).count(),
                items.stream().filter(i -> i.stockStatus() == StockStatus.OUT_OF_STOCK).count());
    }
}
