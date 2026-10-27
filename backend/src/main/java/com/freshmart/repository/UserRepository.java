package com.freshmart.repository;

import com.freshmart.model.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, String>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByEmailAndIdNot(String email, String id);
    long countByRoleAndEnabled(com.freshmart.model.Role role, boolean enabled);
    long countByEnabled(boolean enabled);
    long countByRole(com.freshmart.model.Role role);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.authVersion = u.authVersion + 1 where u.id = :id")
    int revokeSessions(@Param("id") String id);
}
