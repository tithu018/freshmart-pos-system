package com.freshmart.dto;

import java.time.Instant;

public record AuthResponse(UserResponse user, Instant expiresAt) {}
