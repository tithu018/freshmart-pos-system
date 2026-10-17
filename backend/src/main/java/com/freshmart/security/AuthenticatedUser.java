package com.freshmart.security;

import com.freshmart.dto.UserResponse;
import java.time.Instant;

public record AuthenticatedUser(UserResponse user, Instant expiresAt) {}
