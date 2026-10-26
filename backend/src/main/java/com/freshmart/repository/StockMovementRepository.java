package com.freshmart.repository;

import com.freshmart.model.StockMovement;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMovementRepository extends JpaRepository<StockMovement, String> {
    List<StockMovement> findAllByOrderByOccurredAtDescIdDesc();
    List<StockMovement> findByProductIdOrderByOccurredAtDescIdDesc(String productId);
}
