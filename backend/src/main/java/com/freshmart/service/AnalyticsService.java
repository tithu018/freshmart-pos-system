package com.freshmart.service;

import com.freshmart.dto.Analytics.*;
import com.freshmart.dto.UserResponse;
import com.freshmart.model.Role;
import com.freshmart.repository.AnalyticsRepository;
import com.freshmart.repository.SalesHistoryRepository;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class AnalyticsService {
    private final AnalyticsRepository repository;
    private final SalesHistoryRepository history;
    private final ZoneId zone;
    public AnalyticsService(AnalyticsRepository repository, SalesHistoryRepository history,
            @Value("${app.sales.time-zone:Asia/Colombo}") String timeZone) {
        this.repository = repository; this.history = history; this.zone = ZoneId.of(timeZone);
    }
    public Range range(String period, LocalDate from, LocalDate to) {
        return range(period, from, to, LocalDate.now(zone));
    }
    private Range range(String period, LocalDate from, LocalDate to, LocalDate today) {
        if (!Set.of("today", "week", "month", "custom").contains(period)) throw invalid("Choose today, week, month or custom.");
        if (!period.equals("custom")) {
            if (from != null || to != null) throw invalid("Use the custom period with a start and end date.");
            to = today;
            from = switch (period) {
                case "week" -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                case "month" -> today.withDayOfMonth(1);
                default -> today;
            };
        }
        if (from == null || to == null || from.getYear() < 1 || to.getYear() > 9998 || from.isAfter(to)
                || ChronoUnit.DAYS.between(from, to) > 365)
            throw invalid("Choose a valid start and end date covering at most 366 days.");
        return new Range(from, to, zone.getId());
    }
    private CatalogException invalid(String message) { return new CatalogException(400, "INVALID_DATE_RANGE", message); }
    private AnalyticsRepository.Filter filter(Range range, String owner) {
        return new AnalyticsRepository.Filter(range.from().atStartOfDay(zone).toInstant(),
                range.to().plusDays(1).atStartOfDay(zone).toInstant(), owner, zone.getId());
    }
    private List<Point> series(Range range, AnalyticsRepository.Filter filter, boolean hourly) {
        Map<String, Point> values = new HashMap<>();
        repository.points(filter, hourly).forEach(p -> values.put(p.label(), p));
        List<Point> points = new ArrayList<>();
        if (hourly) {
            for (int hour = 0; hour < 24; hour++) points.add(values.getOrDefault(Integer.toString(hour),
                    new Point(Integer.toString(hour), 0, BigDecimal.ZERO)));
        } else {
            for (LocalDate day = range.from(); !day.isAfter(range.to()); day = day.plusDays(1)) {
                String label = day.toString();
                points.add(values.getOrDefault(label, new Point(label, 0, BigDecimal.ZERO)));
            }
        }
        return points;
    }
    public Report report(UserResponse actor, String period, LocalDate from, LocalDate to) {
        if (actor.role() != Role.ADMIN) throw new CatalogException(403, "FORBIDDEN", "Only Admin can view reports.");
        var range = range(period, from, to); var filter = filter(range, null);
        return new Report(range, repository.summary(filter), series(range, filter, false), repository.payments(filter),
                repository.products(filter, true), repository.products(filter, false), repository.cashiers(filter));
    }
    public Dashboard dashboard(UserResponse actor, String period) {
        if (!Set.of("today", "week").contains(period)) throw invalid("Choose today or week for the dashboard.");
        boolean admin = actor.role() == Role.ADMIN;
        String owner = admin ? null : actor.id();
        var todayRange = range("today", null, null); var todayFilter = filter(todayRange, owner);
        var selected = range(period, null, null, todayRange.to()); var selectedFilter = filter(selected, owner);
        var week = new Range(todayRange.to().minusDays(6), todayRange.to(), zone.getId());
        var today = repository.summary(todayFilter);
        return new Dashboard(selected, today, period.equals("today") ? today : repository.summary(selectedFilter),
                series(selected, selectedFilter, period.equals("today")), series(week, filter(week, owner), false),
                repository.payments(selectedFilter), history.page(new SalesHistoryRepository.Filter("", selectedFilter.from(),
                    selectedFilter.until(), null, owner), 0, 4, "occurredAt", false),
                admin ? repository.products(selectedFilter, true) : null, admin ? repository.inventory() : null);
    }
}
