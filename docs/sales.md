# Task 7: Sales history and printable receipts

Admin Sales, Cashier Sales History and recent dashboard transactions now read the
existing PostgreSQL `sales` and `sale_items` created by checkout. No sale records are
copied or seeded. Flyway V5 adds indexes for date, cashier and payment queries.
Authentication and checkout logic are unchanged; the POS confirmation adds a receipt
link without changing how checkout works.

## Run and test manually

Start PostgreSQL and the backend from `backend/` with Java 17, then the frontend from
`frontend/`:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
.\mvnw.cmd spring-boot:run
```

```sh
npm run dev
```

Open `http://localhost:5173`. Development credentials:

- Admin: `admin@freshmart.com` / `Admin@FreshMart123`
- Cashier: `cashier@freshmart.com` / `Cashier@FreshMart123`

1. Complete a Cash or simulated Card checkout with actual stock. Existing completed
   checkouts also appear automatically.
2. As Admin, open `/admin/sales`. Check all transactions and their cashiers. Search
   by a full or partial Sale ID. Combine start/end dates, payment and cashier filters.
   Sort by date or total, change page size, and navigate pages. Summary cards cover all
   matching records, not just the visible page. Export page downloads the displayed rows.
3. Open a Sale ID or its eye button. Details show historical product name, SKU,
   quantity, unit price, line amount, subtotal, discount, tax, total and payment.
4. Select Print Receipt. A protected receipt preview opens in a new tab. Select its
   Print Receipt button to open the browser print dialog; choose your printer or Save
   as PDF. The printout excludes navigation, controls and the application dashboard.
5. As Cashier, open `/cashier/sales-history`. Only that user's transactions, totals,
   details and receipts are available. Another owner's ID returns the same 404 as a
   nonexistent sale; the receipt page shows an error and disables printing.
6. Visit either dashboard. Recent Transactions and summary cards use real sales for
   Today or This week (Monday through today). Selecting a recent ID opens its details.
7. Refresh or navigate away/back after checkout to verify persistence. Data also refreshes
   on browser focus. Temporarily disconnect the backend to check error/retry states.

## API and permissions

All endpoints require the existing authenticated JWT cookie. They are GET requests;
no new CSRF behavior is introduced. No completed-sale edit, delete or refund endpoint
exists. POST/PUT/DELETE on sales routes are denied, including for Admin.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/sales` | Admin: all sales; Cashier: own sales only |
| GET | `/api/sales/{id}` | Admin or the authenticated owner of that sale |
| GET | `/api/sales/cashiers` | Admin only; historical cashier IDs/names for the filter |

List parameters:

| Parameter | Meaning / default |
| --- | --- |
| `q` | Case-insensitive literal substring of Sale ID; max 100 characters |
| `from`, `to` | ISO `YYYY-MM-DD` dates, both inclusive in the shop timezone |
| `payment` | `CASH` or `CARD` |
| `cashierId` | Exact historical user ID; Cashier may only supply their own ID |
| `page` | Zero-based page, default 0; supported 0–100,000 |
| `size` | Default 10, range 1–100 |
| `sort` | `occurredAt` (default), `total`, `userName` or `id` |
| `direction` | `desc` (default) or `asc` |

Every sort includes Sale ID as a deterministic tie breaker. Page rows and filtered
aggregates are queried in the database within one read-only repeatable-read snapshot.
Line quantities are aggregated only for the requested page; collection joins do not
turn pagination into an in-memory operation. Summary queries aggregate all matches.

The list response contains `content`, `page`, `size`, `totalElements`, `totalPages`,
`summary` (orders, revenue, average, units, Cash/Card counts), and `timeZone`.
Each row includes ID, timestamp, user ID/name, payment, total and quantity.
Details return `{sale, storeName, timeZone}`; `sale` reuses the existing checkout
response fields. Internal idempotency keys and request hashes are never returned.

Cashier ownership is enforced inside the backend queries, including aggregates and
recent results. A forged `cashierId` receives 403. Details check ownership before
loading/exposing line snapshots. The cashier selector includes historical operators,
even if an account was later removed; it is not a live employee-directory API.

Errors use `{code, message}`: 400 invalid filters, 401 missing/expired session,
403 prohibited owner filter/access, 404 absent or inaccessible sale, 503 database
unavailability. The frontend clears old details while a new record loads and ignores
stale responses after filter changes, modal closure or session expiry.

## Receipts and historical correctness

Receipts use the sale's saved product names, SKUs, quantities, unit prices, discount,
tax and total. Later product edits/deletion never alter these fields. The cashier's
name is also a snapshot. The branding uses `STORE_NAME` (default `FreshMart`); dates
and filters use `STORE_TIME_ZONE` (default `Asia/Colombo`). Restart the backend after
changing these settings. Both are optional entries in `backend/.env.example`.

The receipt is a clean 80 mm supermarket layout with wrapped product names, shop name,
Sale ID, date/time/timezone, cashier, payment, item quantities/prices, subtotal, discount,
tax and grand total. Print styles remove screen controls and borders, repeat column
headings across pages and avoid splitting individual item rows. Browser-selected paper
size is respected. Currency remains USD to match Tasks 1–6. Card is clearly marked as
simulated; no payment gateway or card data is involved.

The same protected receipt route is linked from transaction details and checkout
confirmation. It reloads the authorized server record rather than accepting client
totals in a URL. React renders all names as text; no receipt HTML is built from raw
product strings. A printer is not required to preview or save a PDF.

## Scope

The existing green page layout, cards, tables, dialogs and responsive theme remain.
The shared table adds optional server pagination; previous local pagination behavior
is retained. Sales mocks are removed from history and recent transactions. The Reports
page keeps its existing demo data in isolation, and illustrative dashboard trend charts
remain labeled as such. No full Reports, refunds, payment integration or Task 8 work
is included. The per-page CSV export is explicitly labeled; bulk exports are not added.

## Automated checks

```powershell
# backend/
.\mvnw.cmd verify
```

```sh
# frontend/
npm test
npm run build
```

Backend tests cover Admin and two different Cashiers, list/detail/aggregate ownership,
filter combinations, shop date boundaries, pagination/sort ordering, immutable snapshots,
deleted products/operators, invalid filters and denied mutations. Existing authentication,
catalog, inventory and checkout regression tests also run. Frontend tests cover API query
parameters, server summary values, stale responses, receipt access errors, session expiry,
dashboard/history independence and date formatting.

## Verification results — 26 October 2026

- Backend `mvnw.cmd verify`: **43 tests passed**, no failures/errors/skips, and the
  Spring Boot executable package built successfully. This includes all 36 previous
  tests plus 7 sales history integration tests.
- Frontend `npm test`: **42 tests passed**, including the previous 34 tests. Production
  build and `git diff --check` succeeded.
- Visible Chromium/PostgreSQL checks passed: Admin history, server page navigation,
  page size and sorting, combined Sale ID/date/payment/cashier filters, empty states,
  historical details, recent dashboard transactions, Cashier-only records, blocked
  other-owner detail/receipt access, and network error/retry feedback.
- A new checkout completed through the existing POS UI appeared in history and remained
  after refresh. Its confirmation linked to the correct receipt. Changing the current
  product name and price did not change older transaction details or receipts.
- Direct PostgreSQL queries confirmed 14 generated test sales (6 Admin, 8 Cashier),
  27 saved item lines, expected historical prices and totals, successful V1–V5 migrations,
  and the new indexes. Generated fixtures were removed after verification; the existing
  non-test sale was preserved.
- Receipt testing invoked the browser print action and generated an actual Chromium
  PDF. Extracted PDF text included the sale snapshots and totals, with no application
  navigation or Print controls. Visual inspection confirmed white print backgrounds,
  wrapped item names and readable labels. An isolated 60-line presentation fixture
  produced six pages with repeating table headings and all items present; it did not
  insert synthetic sales into the database. Desktop and mobile layouts were checked.
- No JavaScript/React errors or HTTP 5xx responses occurred during live testing.
  Checkout, inventory transaction and authentication implementations were unchanged.

Task 7 is complete with no known defects in the requested scope. Hardware printers
were not tested; browser printing and PDF output were verified. Full Reports,
refunds, real payments and Task 8 remain outside scope.

## Files changed

Modified (18):

- [backend/.env.example](../backend/.env.example)
- [backend/src/main/java/com/freshmart/config/SecurityConfig.java](../backend/src/main/java/com/freshmart/config/SecurityConfig.java)
- [backend/src/main/java/com/freshmart/controller/SalesController.java](../backend/src/main/java/com/freshmart/controller/SalesController.java)
- [backend/src/main/resources/application.properties](../backend/src/main/resources/application.properties)
- [database/README.md](../database/README.md)
- [docs/api-documentation.md](../docs/api-documentation.md)
- [docs/checkout.md](../docs/checkout.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/src/components/DashboardView.jsx](../frontend/src/components/DashboardView.jsx)
- [frontend/src/components/Layout.jsx](../frontend/src/components/Layout.jsx)
- [frontend/src/components/POSView.jsx](../frontend/src/components/POSView.jsx)
- [frontend/src/components/SalesView.jsx](../frontend/src/components/SalesView.jsx)
- [frontend/src/components/ui.jsx](../frontend/src/components/ui.jsx)
- [frontend/src/pages/admin/Reports.jsx](../frontend/src/pages/admin/Reports.jsx)
- [frontend/src/routes/AppRoutes.jsx](../frontend/src/routes/AppRoutes.jsx)
- [frontend/src/services/salesService.js](../frontend/src/services/salesService.js)
- [frontend/src/store/slices/salesSlice.js](../frontend/src/store/slices/salesSlice.js)
- [README.md](../README.md)

Created (13):

- [backend/src/main/java/com/freshmart/controller/SalesExceptionHandler.java](../backend/src/main/java/com/freshmart/controller/SalesExceptionHandler.java)
- [backend/src/main/java/com/freshmart/dto/SaleDetails.java](../backend/src/main/java/com/freshmart/dto/SaleDetails.java)
- [backend/src/main/java/com/freshmart/dto/SalesPage.java](../backend/src/main/java/com/freshmart/dto/SalesPage.java)
- [backend/src/main/java/com/freshmart/repository/SalesHistoryRepository.java](../backend/src/main/java/com/freshmart/repository/SalesHistoryRepository.java)
- [backend/src/main/java/com/freshmart/service/SalesHistoryService.java](../backend/src/main/java/com/freshmart/service/SalesHistoryService.java)
- [backend/src/main/resources/db/migration/V5__sales_history_indexes.sql](../backend/src/main/resources/db/migration/V5__sales_history_indexes.sql)
- [backend/src/test/java/com/freshmart/SalesHistoryIntegrationTest.java](../backend/src/test/java/com/freshmart/SalesHistoryIntegrationTest.java)
- [docs/sales.md](../docs/sales.md)
- [frontend/src/components/SaleDetailsModal.jsx](../frontend/src/components/SaleDetailsModal.jsx)
- [frontend/src/pages/receipt.css](../frontend/src/pages/receipt.css)
- [frontend/src/pages/Receipt.jsx](../frontend/src/pages/Receipt.jsx)
- [frontend/src/utils/sales.js](../frontend/src/utils/sales.js)
- [frontend/tests/sales.test.js](../frontend/tests/sales.test.js)
