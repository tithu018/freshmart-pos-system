package com.freshmart.controller;

import com.freshmart.dto.ApiError;
import com.freshmart.service.CatalogException;
import org.springframework.core.annotation.Order;
import org.springframework.dao.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@Order(-1)
@RestControllerAdvice(assignableTypes = CheckoutController.class)
public class CheckoutExceptionHandler {
    @ExceptionHandler(CatalogException.class)
    ResponseEntity<ApiError> domain(CatalogException e) { return ResponseEntity.status(e.getStatus()).body(new ApiError(e.getCode(), e.getMessage())); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream().map(f -> f.getField() + ": " + f.getDefaultMessage()).sorted().findFirst().orElse("Check the submitted order.");
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", message));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> malformed() { return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "Enter valid products, whole quantities, amounts and a Cash or Card payment.")); }
    @ExceptionHandler({ConcurrencyFailureException.class, DataIntegrityViolationException.class})
    ResponseEntity<ApiError> conflict() { return ResponseEntity.status(409).body(new ApiError("CHECKOUT_CONFLICT", "The checkout could not be saved. Review the order and retry.")); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> unavailable() { return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE", "Checkout is temporarily unavailable. Retry the same order to confirm its result.")); }
}
