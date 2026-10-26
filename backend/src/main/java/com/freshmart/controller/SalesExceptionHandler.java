package com.freshmart.controller;

import com.freshmart.dto.ApiError;
import com.freshmart.service.CatalogException;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Order(-1)
@RestControllerAdvice(assignableTypes = SalesController.class)
public class SalesExceptionHandler {
    @ExceptionHandler(CatalogException.class)
    ResponseEntity<ApiError> domain(CatalogException e) { return ResponseEntity.status(e.getStatus()).body(new ApiError(e.getCode(), e.getMessage())); }
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> malformed() { return ResponseEntity.badRequest().body(new ApiError("INVALID_FILTER", "Use valid dates, page numbers and CASH or CARD payment filters.")); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> unavailable() { return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE", "Sales are temporarily unavailable. Please try again.")); }
}
