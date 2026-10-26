package com.freshmart.repository;

import com.freshmart.model.Sale;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleRepository extends JpaRepository<Sale, String> {
    Optional<Sale> findByIdempotencyKey(String idempotencyKey);
}
