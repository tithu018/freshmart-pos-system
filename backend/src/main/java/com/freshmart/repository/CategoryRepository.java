package com.freshmart.repository;

import com.freshmart.model.Category;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, String> {
    List<Category> findAllByOrderByNameAsc();
    boolean existsByNameKeyAndIdNot(String nameKey, String id);
}
