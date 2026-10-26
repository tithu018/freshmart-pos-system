package com.freshmart.repository;

import com.freshmart.dto.SalesPage;
import com.freshmart.model.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class SalesHistoryRepository {
    private final EntityManager em;
    public SalesHistoryRepository(EntityManager em) { this.em = em; }
    public record Filter(String query, Instant from, Instant until, PaymentMethod payment, String cashierId) {}

    private Predicate[] where(From<?, Sale> sale, CriteriaBuilder cb, Filter filter) {
        var predicates = new ArrayList<Predicate>();
        if (!filter.query().isEmpty()) {
            String pattern = "%" + filter.query().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            predicates.add(cb.like(cb.lower(sale.get("id")), pattern, '\\'));
        }
        if (filter.from() != null) predicates.add(cb.greaterThanOrEqualTo(sale.get("occurredAt"), filter.from()));
        if (filter.until() != null) predicates.add(cb.lessThan(sale.get("occurredAt"), filter.until()));
        if (filter.payment() != null) predicates.add(cb.equal(sale.get("payment"), filter.payment()));
        if (filter.cashierId() != null) predicates.add(cb.equal(sale.get("userId"), filter.cashierId()));
        return predicates.toArray(Predicate[]::new);
    }
    public List<SalesPage.Row> page(Filter filter, int page, int size, String sort, boolean ascending) {
        var cb = em.getCriteriaBuilder(); var query = cb.createQuery(Sale.class); var sale = query.from(Sale.class);
        query.select(sale).where(where(sale, cb, filter));
        query.orderBy(ascending ? cb.asc(sale.get(sort)) : cb.desc(sale.get(sort)),
                ascending ? cb.asc(sale.get("id")) : cb.desc(sale.get("id")));
        var records = em.createQuery(query).setFirstResult(page * size).setMaxResults(size).getResultList();
        if (records.isEmpty()) return List.of();
        // Aggregate only the visible page's quantities; never fetch all line collections to paginate.
        var counts = em.createQuery("select i.sale.id, sum(i.quantity) from SaleItem i where i.sale.id in :ids group by i.sale.id", Object[].class)
                .setParameter("ids", records.stream().map(Sale::getId).toList()).getResultList();
        Map<String, Long> quantities = new HashMap<>();
        for (var row : counts) quantities.put((String) row[0], ((Number) row[1]).longValue());
        return records.stream().map(s -> SalesPage.Row.from(s, quantities.getOrDefault(s.getId(), 0L))).toList();
    }
    public SalesPage.Summary summary(Filter filter) {
        var cb = em.getCriteriaBuilder(); var query = cb.createTupleQuery(); var sale = query.from(Sale.class);
        query.multiselect(cb.count(sale), cb.coalesce(cb.sum(sale.<BigDecimal>get("total")), BigDecimal.ZERO),
                cb.coalesce(cb.sum(cb.<Long>selectCase().when(cb.equal(sale.get("payment"), PaymentMethod.CASH), 1L).otherwise(0L)), 0L),
                cb.coalesce(cb.sum(cb.<Long>selectCase().when(cb.equal(sale.get("payment"), PaymentMethod.CARD), 1L).otherwise(0L)), 0L))
                .where(where(sale, cb, filter));
        Tuple values = em.createQuery(query).getSingleResult();
        long orders = ((Number) values.get(0)).longValue(); BigDecimal revenue = (BigDecimal) values.get(1);
        var unitQuery = cb.createQuery(Long.class); var line = unitQuery.from(SaleItem.class);
        unitQuery.select(cb.coalesce(cb.sum(line.<Long>get("quantity")), 0L))
                .where(where(line.join("sale"), cb, filter));
        long units = em.createQuery(unitQuery).getSingleResult();
        return new SalesPage.Summary(orders, revenue, orders == 0 ? BigDecimal.ZERO
                : revenue.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP), units,
                ((Number) values.get(2)).longValue(), ((Number) values.get(3)).longValue());
    }
    public List<SalesPage.Cashier> cashiers() {
        // Historical snapshots also retain operators whose accounts have been removed.
        return em.createQuery("select s.userId, max(s.userName) from Sale s group by s.userId order by max(s.userName), s.userId", Object[].class)
                .getResultList().stream().map(row -> new SalesPage.Cashier((String) row[0], (String) row[1])).toList();
    }
}
