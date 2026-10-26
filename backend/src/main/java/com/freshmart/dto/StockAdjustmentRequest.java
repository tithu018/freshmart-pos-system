package com.freshmart.dto;

import com.freshmart.model.StockOperation;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.*;

public record StockAdjustmentRequest(@NotNull StockOperation type,
        @JsonDeserialize(using = WholeQuantityDeserializer.class) @NotNull @Min(1) @Max(1_000_000_000L) Long quantity,
        @NotBlank @Size(max = 250) String reason) {
    public StockAdjustmentRequest { reason = reason == null ? null : reason.trim(); }
}
