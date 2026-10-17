package com.freshmart.controller;

import com.freshmart.dto.ApiError;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<ApiError> invalidCredentials() {
        return ResponseEntity.status(401).body(new ApiError("INVALID_CREDENTIALS", "Invalid email or password."));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<ApiError> invalidRequest() {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "Enter a valid email and password (up to 72 characters)."));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> unavailable() {
        return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again."));
    }
}
