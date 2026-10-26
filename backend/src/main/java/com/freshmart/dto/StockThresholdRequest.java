package com.freshmart.dto;

import jakarta.validation.constraints.*;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

public record StockThresholdRequest(@JsonDeserialize(using = WholeQuantityDeserializer.class)
        @NotNull @Min(0) @Max(1_000_000_000L) Long minStock) {}
