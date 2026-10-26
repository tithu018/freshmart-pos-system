package com.freshmart.controller;

import com.freshmart.dto.Analytics.*;
import com.freshmart.security.AuthenticatedUser;
import com.freshmart.service.*;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class AnalyticsController {
    private final AnalyticsService analytics;
    public AnalyticsController(AnalyticsService analytics) { this.analytics = analytics; }
    @GetMapping({"/api/admin/dashboard", "/api/cashier/dashboard"})
    public Dashboard dashboard(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(defaultValue = "today") String period) {
        return analytics.dashboard(principal.user(), period);
    }
    @GetMapping("/api/admin/reports")
    public Report report(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(defaultValue = "today") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return analytics.report(principal.user(), period, from, to);
    }
    @GetMapping(value = "/api/admin/reports/csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<String> csv(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(defaultValue = "today") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        var report = analytics.report(principal.user(), period, from, to);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"freshmart-report-" + report.range().from() + "-" + report.range().to() + ".csv\"")
                .body(AnalyticsCsv.render(report));
    }
}
