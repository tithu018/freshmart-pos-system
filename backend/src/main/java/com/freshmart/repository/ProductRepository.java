package com.freshmart.repository;

import com.freshmart.model.Product;
import java.util.List;
import org.springframework.data.jpa.repository.*;

public interface ProductRepository extends JpaRepository<Product, String>, JpaSpecificationExecutor<Product> {
    boolean existsBySkuAndIdNot(String sku, String id);
    boolean existsByBarcodeAndIdNot(String barcode, String id);
    boolean existsByCategoryId(String categoryId);
    long countByCategoryId(String categoryId);

    interface CategoryCount {
        String getCategoryId();
        long getTotal();
    }
    @Query("select p.category.id as categoryId, count(p) as total from Product p group by p.category.id")
    List<CategoryCount> countByCategory();
}
