package com.freshmart.service;

import com.freshmart.dto.*;
import com.freshmart.dto.People.*;
import com.freshmart.repository.*;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@Transactional(readOnly=true)
public class CustomerService {
    private final CustomerRepository customers;
    private final CustomerHistoryRepository directory;
    private final SalesHistoryRepository sales;
    private final String zone;
    public CustomerService(CustomerRepository customers, CustomerHistoryRepository directory, SalesHistoryRepository sales,
            @Value("${app.sales.time-zone:Asia/Colombo}") String zone) {
        this.customers = customers; this.directory = directory; this.sales = sales; this.zone = zone;
    }
    public People.Page<People.Customer> list(String q, Boolean enabled, int page, int size) {
        return directory.list(EmployeeService.search(q, page, size), enabled, page, size);
    }
    public List<CustomerOption> lookup(String q) { return directory.lookup(EmployeeService.search(q, 0, 20)); }
    public People.Customer get(String id) {
        if (!customers.existsById(id)) throw CatalogException.missing("Customer");
        return directory.get(id);
    }
    @Transactional
    public People.Customer save(String id, CustomerRequest request) {
        var customer = id == null ? new com.freshmart.model.Customer(request) : customers.lockById(id).orElseThrow(() -> CatalogException.missing("Customer"));
        customer.update(request); customers.saveAndFlush(customer);
        return directory.get(customer.getId());
    }
    @Transactional
    public void archive(String id) {
        var customer = customers.lockById(id).orElseThrow(() -> CatalogException.missing("Customer"));
        customer.deactivate(); customers.flush();
    }
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public SalesPage history(String id, int page, int size) {
        get(id); EmployeeService.search(null, page, size);
        var filter = new SalesHistoryRepository.Filter("", null, null, null, null, id);
        var summary = sales.summary(filter);
        return new SalesPage(sales.page(filter, page, size, "occurredAt", false), page, size, summary.orders(),
                (summary.orders() + size - 1) / size, summary, zone);
    }
}
