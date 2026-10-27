package com.freshmart.controller;

import com.freshmart.dto.*;
import com.freshmart.dto.People.*;
import com.freshmart.service.CustomerService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
public class CustomerController {
    private final CustomerService customers;
    public CustomerController(CustomerService customers) { this.customers = customers; }
    @GetMapping("/api/admin/customers")
    public People.Page<Customer> list(@RequestParam(required=false) String q, @RequestParam(required=false) Boolean enabled,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="10") int size) { return customers.list(q, enabled, page, size); }
    @GetMapping("/api/admin/customers/{id}") public Customer get(@PathVariable String id) { return customers.get(id); }
    @PostMapping("/api/admin/customers") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public Customer create(@Valid @RequestBody CustomerRequest request) { return customers.save(null, request); }
    @PutMapping("/api/admin/customers/{id}") public Customer update(@PathVariable String id, @Valid @RequestBody CustomerRequest request) { return customers.save(id, request); }
    @DeleteMapping("/api/admin/customers/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void archive(@PathVariable String id) { customers.archive(id); }
    @GetMapping("/api/admin/customers/{id}/sales") public SalesPage history(@PathVariable String id,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="10") int size) { return customers.history(id, page, size); }
    @GetMapping("/api/pos/customers") public List<CustomerOption> lookup(@RequestParam(required=false) String q) { return customers.lookup(q); }
}
