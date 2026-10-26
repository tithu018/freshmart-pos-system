package com.freshmart.service;

import com.freshmart.dto.Analytics.Report;
import java.util.Arrays;
import java.util.stream.Collectors;

public final class AnalyticsCsv {
    private AnalyticsCsv() {}
    public static String render(Report report) {
        StringBuilder csv = new StringBuilder("\uFEFF");
        row(csv, "Metric", "Value");
        row(csv, "From", report.range().from()); row(csv, "To (inclusive)", report.range().to());
        row(csv, "Time zone", report.range().timeZone());
        var s = report.summary();
        row(csv, "Total revenue", s.revenue()); row(csv, "Transactions", s.orders());
        row(csv, "Gross subtotal", s.subtotal()); row(csv, "Discounts", s.discounts()); row(csv, "Taxes collected", s.taxes());
        row(csv, "Units sold", s.units()); row(csv, "Average sale", s.average());
        row(csv); row(csv, "Date", "Transactions", "Revenue");
        report.daily().forEach(p -> row(csv, p.label(), p.orders(), p.revenue()));
        row(csv); row(csv, "Payment", "Transactions", "Revenue");
        report.payments().forEach(p -> row(csv, p.method(), p.orders(), p.revenue()));
        row(csv); row(csv, "Top 10 products by quantity", "SKU", "Units", "Gross revenue before order discounts and tax");
        report.topByQuantity().forEach(p -> row(csv, p.name(), p.sku(), p.quantity(), p.revenue()));
        row(csv); row(csv, "Top 10 products by revenue", "SKU", "Units", "Gross revenue before order discounts and tax");
        report.topByRevenue().forEach(p -> row(csv, p.name(), p.sku(), p.quantity(), p.revenue()));
        row(csv); row(csv, "Cashier ID", "Cashier", "Transactions", "Revenue", "Discounts", "Taxes", "Average sale");
        report.cashiers().forEach(c -> row(csv, c.id(), c.name(), c.orders(), c.revenue(), c.discounts(), c.taxes(), c.average()));
        return csv.toString();
    }
    private static void row(StringBuilder csv, Object... cells) {
        csv.append(Arrays.stream(cells).map(value -> {
            String text = String.valueOf(value);
            String trimmed = text.stripLeading();
            if ((!trimmed.isEmpty() && "=+@-".indexOf(trimmed.charAt(0)) >= 0)
                    || text.startsWith("\t") || text.startsWith("\r") || text.startsWith("\n")) text = "'" + text;
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }).collect(Collectors.joining(","))).append("\r\n");
    }
}
