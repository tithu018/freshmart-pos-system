package com.freshmart.controller;

import com.freshmart.dto.ApiError;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> unsupportedMedia() {
        return ResponseEntity.status(415).body(new ApiError("UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> notFound() {
        return ResponseEntity.status(404).body(new ApiError("NOT_FOUND", "The requested resource was not found."));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ApiError> missingParameter() {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "A required request parameter is missing."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> unsupportedMethod(HttpRequestMethodNotSupportedException exception) {
        var response = ResponseEntity.status(405);
        if (exception.getSupportedHttpMethods() != null)
            response.allow(exception.getSupportedHttpMethods().toArray(org.springframework.http.HttpMethod[]::new));
        return response.body(new ApiError("METHOD_NOT_ALLOWED", "This action is not supported for that resource."));
    }

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
