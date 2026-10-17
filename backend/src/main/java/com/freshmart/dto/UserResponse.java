package com.freshmart.dto;

import com.freshmart.model.Role;
import com.freshmart.model.User;

public record UserResponse(String id, String name, String email, Role role, String phone) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.getPhone());
    }
}
