package com.freshmart.repository;

import com.freshmart.model.Inventory;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface InventoryRepository extends JpaRepository<Inventory, String> {
    @Query("select i from Inventory i join fetch i.product p join fetch p.category order by p.name, p.id")
    List<Inventory> findCatalog();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inventory i where i.productId = :id")
    Optional<Inventory> lockByProductId(@Param("id") String id);
}
