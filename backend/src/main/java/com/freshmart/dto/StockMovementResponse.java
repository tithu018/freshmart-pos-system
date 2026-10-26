package com.freshmart.dto;

import com.freshmart.model.StockMovement;
import java.time.Instant;

public record StockMovementResponse(String id, String productId, String productName, String sku, String type,
        long quantity, long stockBefore, long stockAfter, long thresholdBefore, long thresholdAfter,
        String reason, Instant occurredAt, String userId, String userName, String saleId) {
    public static StockMovementResponse from(StockMovement m) {
        return new StockMovementResponse(m.getId(), m.getProductId(), m.getProductName(), m.getSku(), m.getType(),
                m.getQuantity(), m.getStockBefore(), m.getStockAfter(), m.getThresholdBefore(), m.getThresholdAfter(),
                m.getReason(), m.getOccurredAt(), m.getUserId(), m.getUserName(), m.getSaleId());
    }
}
