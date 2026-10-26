package com.freshmart.service;

import com.freshmart.dto.*;
import com.freshmart.model.*;
import com.freshmart.repository.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@Transactional(readOnly = true)
public class SalesHistoryService {
    private final SalesHistoryRepository history;
    private final SaleRepository sales;
    private final ZoneId zone;
    private final String storeName;
    public SalesHistoryService(SalesHistoryRepository history, SaleRepository sales,
            @Value("${app.sales.time-zone:Asia/Colombo}") String zone,
            @Value("${app.sales.store-name:FreshMart}") String storeName) {
        this.history = history; this.sales = sales; this.zone = ZoneId.of(zone); this.storeName = storeName;
    }
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public SalesPage list(UserResponse actor, String q, LocalDate from, LocalDate to, PaymentMethod payment,
            String cashierId, int page, int size, String sort, String direction) {
        if (page < 0 || page > 100000 || size < 1 || size > 100 || (q != null && q.length() > 100)
                || (cashierId != null && cashierId.length() > 36)
                || !Set.of("occurredAt", "total", "userName", "id").contains(sort)
                || !Set.of("asc", "desc").contains(direction.toLowerCase(Locale.ROOT)))
            throw new CatalogException(400, "INVALID_FILTER", "Check the sales search, page, size and sort fields.");
        if ((from != null && (from.getYear() < 1 || from.getYear() > 9998))
                || (to != null && (to.getYear() < 1 || to.getYear() > 9998))
                || (from != null && to != null && from.isAfter(to)))
            throw new CatalogException(400, "INVALID_DATE_RANGE", "Enter a valid start and end date in chronological order.");
        String owner = cashierId == null || cashierId.isBlank() ? null : cashierId;
        if (actor.role() != Role.ADMIN) {
            if (owner != null && !owner.equals(actor.id()))
                throw new CatalogException(403, "FORBIDDEN", "You can only view your own sales.");
            owner = actor.id();
        }
        var filter = new SalesHistoryRepository.Filter(q == null ? "" : q.trim().toLowerCase(Locale.ROOT),
                from == null ? null : from.atStartOfDay(zone).toInstant(),
                to == null ? null : to.plusDays(1).atStartOfDay(zone).toInstant(), payment, owner);
        var summary = history.summary(filter);
        return new SalesPage(history.page(filter, page, size, sort, direction.equalsIgnoreCase("asc")), page, size,
                summary.orders(), (summary.orders() + size - 1) / size, summary, zone.getId());
    }
    public SaleDetails details(String id, UserResponse actor) {
        var sale = sales.findById(id).orElseThrow(() -> CatalogException.missing("Sale"));
        // Use the same not-found response for absent and inaccessible IDs.
        if (actor.role() != Role.ADMIN && !sale.getUserId().equals(actor.id())) throw CatalogException.missing("Sale");
        return new SaleDetails(CheckoutResponse.from(sale), storeName, zone.getId());
    }
    public List<SalesPage.Cashier> cashiers(UserResponse actor) {
        if (actor.role() != Role.ADMIN) throw new CatalogException(403, "FORBIDDEN", "Only Admin can view the cashier filter.");
        return history.cashiers();
    }
}
