package com.freshmart.controller;

import com.freshmart.dto.ApiError;
import com.freshmart.service.CatalogException;
import org.springframework.core.annotation.Order;
import org.springframework.dao.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Order(-1)
@RestControllerAdvice(assignableTypes={EmployeeController.class, CustomerController.class})
public class PeopleExceptionHandler {
    @ExceptionHandler(CatalogException.class) ResponseEntity<ApiError> domain(CatalogException e) { return ResponseEntity.status(e.getStatus()).body(new ApiError(e.getCode(), e.getMessage())); }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<ApiError> validation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream().map(f -> f.getField() + ": " + f.getDefaultMessage()).sorted().findFirst().orElse("Check the submitted details.");
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", message));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> malformed() { return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "Check the fields, role, status and page number.")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> conflict() { return ResponseEntity.status(409).body(new ApiError("PEOPLE_CONFLICT", "These details conflict with an existing record. Check the email and try again.")); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> unavailable() { return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE", "People records are temporarily unavailable. Please try again.")); }
}
