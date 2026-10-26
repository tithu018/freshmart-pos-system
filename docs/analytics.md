# Task 8: Dashboard analytics and sales reports

Dashboard and Reports retain the FreshMart green theme, page structure, shared cards,
tables, navigation and header. Their mock sales/chart imports have been removed.
No checkout, inventory-write, authentication, JWT or CSRF behavior was changed.

## APIs and permissions

All endpoints are credentialed GET requests using the existing HttpOnly JWT cookie.
Existing `/api/admin/**` and `/api/cashier/**` security rules apply without modification.

| Endpoint | Access | Parameters |
| --- | --- | --- |
| `/api/admin/dashboard` | ADMIN | `period=today` (default) or `week` |
| `/api/cashier/dashboard` | CASHIER | `period=today` (default) or `week` |
| `/api/admin/reports` | ADMIN | `period=today`, `week`, `month`, or `custom` |
| `/api/admin/reports/csv` | ADMIN | Same report parameters; UTF-8 CSV attachment |

Custom reports require both `from=YYYY-MM-DD` and `to=YYYY-MM-DD`. Dates are inclusive,
must be chronological, and may span at most 366 calendar dates. Presets reject explicit
dates. Invalid filters return 400; missing authentication returns 401; wrong roles return
403. The report service also checks the Admin role. Cashier queries always bind the
authenticated user's ID; caller-supplied IDs cannot change the scope. Their dashboard
omits product rankings, inventory and cashier comparisons.

Dashboard cards always show today's revenue/transactions. The selector controls the
sales overview, payment split, recent transactions and product ranking/personal summary.
The revenue trend shows the last seven local dates. Admin inventory counts include all
catalog products, consistent with Inventory: low means `0 < stock < min_stock`, and
out of stock means `stock = 0`, including a zero threshold. Alerts show the first five
by stock, name and ID, with a link to the complete inventory page.

## Time and money

`STORE_TIME_ZONE` / `app.sales.time-zone` is shared with sales history and receipts;
the default is `Asia/Colombo`. Today is resolved on the server. Weeks start Monday;
weekly/monthly presets run through today. Date filters use `[local start of first day,
local start of day after last day)` converted to instants. Database timezone conversion
uses the same zone for hourly/daily chart buckets. This handles 23/25-hour daylight-saving
days; repeated local hours share one hourly bucket. Responses include the dates and zone.
Missing chart buckets are returned as zeroes.

Financial calculations use PostgreSQL numeric sums and Java BigDecimal:

- Revenue is the sum of saved `Sale.total` (subtotal minus discount plus tax).
- Discounts and taxes are summed from saved headers, not recalculated at current rates.
- Average sale is revenue / transaction count, rounded HALF_UP to two decimal places.
- Product rankings use historical `SaleItem` snapshots and gross line totals before
  order discounts/tax. Separate top-ten rankings are available for quantity and revenue;
  ties are deterministic. Products remain in reports after catalog changes/deletion.
- Cash/Card and cashier revenue are sums of saved sale totals. A cashier row includes
  any operator with sales, including Admin and former users, using historical IDs/names.
- Fully discounted zero-total sales still count as transactions.

Header sums and item sums are queried separately to avoid multiplying totals for orders
with multiple lines. Queries aggregate in SQL and use the existing date, user/date and
sale-item indexes. Only grouped results, four recent sales and five alerts are loaded.
Each response is read within a repeatable-read transaction for consistent summaries.
No database migration or additional frontend dependency is required.

## Frontend and CSV

Axios uses the existing credentialed client. Redux tracks dashboard, report and export
requests independently, ignores superseded responses, and clears analytics on session
expiry/logout. Pages refresh on entry, filter changes and window focus. Loading, error,
retry and empty states are included. Custom dates are applied explicitly; the displayed
date range identifies the currently loaded report. Export uses those exact dates even
if midnight passes after loading. Report contents can reflect newer committed sales at
export time, because the export is a new database snapshot.

Charts resize with their cards, offer exact values in tooltips and an accessible chart-data
table, and scroll for long ranges. Payment shares are based on revenue and also list
transaction counts. CSV includes date/timezone metadata, financial summary, daily series,
payment totals, both top-ten product rankings and all cashier rows. Cells are quoted,
quotes escaped, and formula-like text neutralized, including multiline names.

## Verification

From `frontend`: `npm test` and `npm run build`.
From `backend`: `.\mvnw.cmd verify` (Java 17).

`AnalyticsIntegrationTest` has eight integration tests covering exact money reconciliation,
multi-line orders, inclusive date boundaries, zero-filled charts, inventory counts,
Admin/Cashier/JWT/CSRF permissions, presets/custom validation, CSV contents/escaping,
zero-total sales, HALF_UP rounding, and daylight-saving boundaries.

To run those same tests against local PostgreSQL without altering existing store data:

```powershell
cd backend
.\scripts\Test-AnalyticsPostgres.ps1
```

The script reads local `.env`/environment connection settings, creates a uniquely named
test schema, applies existing Flyway migrations there, runs rollback-isolated fixtures,
and removes only that schema. It requires `psql` and schema creation permission.
Output is in `backend/target/task8-postgres.log`. The ordinary test profile uses H2.

Verified on October 26, 2026:

- PostgreSQL 17: eight analytics integration tests passed. Existing store data also
  reconciled to the live UI and CSV: one transaction, $6.00 subtotal, $1.00 discount,
  $0.00 tax, $5.00 revenue and three units.
- Browser checks: Admin and Cashier dashboards; daily/weekly/monthly/custom filters;
  chart series, product ranking selector, CSV download, invalid dates, empty periods,
  simulated API error/retry, desktop and mobile overflow checks; no browser errors.
- Full backend regression: 51 tests passed, zero failures/errors, and `mvnw verify`
  produced the executable JAR. This includes all existing Tasks 3–7 test suites.
- Frontend: 48 tests passed, zero failures, and the Vite production build succeeded.
- PostgreSQL test schema cleanup completed; existing store records were unchanged.

## Changed files

- `README.md`
- `frontend/README.md`
- `docs/analytics.md`
- `backend/scripts/Test-AnalyticsPostgres.ps1`
- `backend/src/main/java/com/freshmart/controller/AnalyticsController.java`
- `backend/src/main/java/com/freshmart/controller/SalesExceptionHandler.java`
- `backend/src/main/java/com/freshmart/dto/Analytics.java`
- `backend/src/main/java/com/freshmart/repository/AnalyticsRepository.java`
- `backend/src/main/java/com/freshmart/service/AnalyticsCsv.java`
- `backend/src/main/java/com/freshmart/service/AnalyticsService.java`
- `backend/src/test/java/com/freshmart/AnalyticsIntegrationTest.java`
- `backend/src/test/resources/application-analytics-test.properties`
- `frontend/src/components/AnalyticsCharts.jsx`
- `frontend/src/components/DashboardView.jsx`
- `frontend/src/data/mockData.js`
- `frontend/src/pages/admin/Reports.jsx`
- `frontend/src/services/analyticsService.js`
- `frontend/src/store/slices/analyticsSlice.js`
- `frontend/src/store/store.js`
- `frontend/src/utils/analytics.js`
- `frontend/tests/analytics.test.js`

Task 9, refunds, suppliers and multi-store support remain outside this implementation.
