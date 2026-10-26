package com.freshmart.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.freshmart.model.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public record CheckoutRequest(
        @NotNull @Pattern(regexp = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}") String idempotencyKey,
        @NotNull @Size(min = 1, max = 100) List<@NotNull @Valid Item> items,
        @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal discount,
        @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal expectedTaxRate,
        @NotNull PaymentMethod payment) {
    public record Item(@NotBlank @Size(max = 36) String productId,
            @NotNull @Min(1) @Max(1000000) @JsonDeserialize(using = WholeQuantityDeserializer.class) Long quantity,
            @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal expectedUnitPrice) {}
}
