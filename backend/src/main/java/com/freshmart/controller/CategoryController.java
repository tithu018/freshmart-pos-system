package com.freshmart.controller;

import com.freshmart.dto.*;
import com.freshmart.service.CategoryService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    private final CategoryService categories;
    public CategoryController(CategoryService categories) { this.categories = categories; }
    @GetMapping public List<CategoryResponse> list(@RequestParam(required = false) String q) { return categories.list(q); }
    @GetMapping("/{id}") public CategoryResponse get(@PathVariable String id) { return categories.get(id); }
    @PostMapping public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryRequest request) {
        var result = categories.save(null, request);
        return ResponseEntity.created(URI.create("/api/categories/" + result.id())).body(result);
    }
    @PutMapping("/{id}") public CategoryResponse update(@PathVariable String id, @Valid @RequestBody CategoryRequest request) {
        return categories.save(id, request);
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String id) {
        categories.delete(id); return ResponseEntity.noContent().build();
    }
}
