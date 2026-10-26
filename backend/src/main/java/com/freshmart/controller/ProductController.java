package com.freshmart.controller;

import com.freshmart.dto.*;
import com.freshmart.model.CatalogStatus;
import com.freshmart.service.ProductService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductService products;
    public ProductController(ProductService products) { this.products = products; }
    @GetMapping public List<ProductResponse> list(@RequestParam(required = false) String q,
            @RequestParam(required = false) String categoryId, @RequestParam(required = false) CatalogStatus status) {
        return products.list(q, categoryId, status);
    }
    @GetMapping("/{id}") public ProductResponse get(@PathVariable String id) { return products.get(id); }
    @PostMapping public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        var result = products.save(null, request);
        return ResponseEntity.created(URI.create("/api/products/" + result.id())).body(result);
    }
    @PutMapping("/{id}") public ProductResponse update(@PathVariable String id, @Valid @RequestBody ProductRequest request) {
        return products.save(id, request);
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String id) {
        products.delete(id); return ResponseEntity.noContent().build();
    }
}
