package com.freshmart.controller;

import com.freshmart.dto.ApiError;
import com.freshmart.service.CatalogException;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Order(-1)
@RestControllerAdvice(assignableTypes = {ProductController.class, CategoryController.class})
public class CatalogExceptionHandler {
    @ExceptionHandler(CatalogException.class)
    ResponseEntity<ApiError> catalog(CatalogException error) {
        return ResponseEntity.status(error.getStatus()).body(new ApiError(error.getCode(), error.getMessage()));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException error) {
        String message = error.getBindingResult().getFieldErrors().stream()
                .map(field -> field.getField() + ": " + field.getDefaultMessage()).sorted().findFirst()
                .orElse("Check the submitted fields.");
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", message));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> malformed() {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "Check the request fields. Status must be ACTIVE or INACTIVE."));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> conflict() {
        return ResponseEntity.status(409).body(new ApiError("CATALOG_CONFLICT",
                "The record conflicts with existing data or is in use. Refresh and check the category, SKU, and barcode."));
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> unavailable() {
        return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE", "The catalog is temporarily unavailable. Please try again."));
    }
}
