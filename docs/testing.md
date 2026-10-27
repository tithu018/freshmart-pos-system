# Task 10: Testing, validation and reliability

Task 10 validates Tasks 1–9 and fixes reliability issues while preserving the
FreshMart design, routes, database migrations and business calculations. No new
business features or Task 11 work are included.

## Fixes

- Reject numeric enum values instead of silently treating `role: 0` as `ADMIN`,
  or accepting numeric product statuses and payment methods. Named enum values
  used by existing forms remain unchanged.
- Return a safe, retryable JSON 503 when database access fails during JWT account
  verification. This failure occurs before controller advice. Preserve the cookie
  so a temporary outage does not unnecessarily revoke the session.
- Return consistent JSON errors for unsupported content types (415), unsupported
  methods (405 with Allow header), missing parameters (400) and unknown resources
  (404). Keep existing domain-specific validation and permission responses.
- Suppress Spring's debug exception-resolver logging of rejected field values;
  oversized passwords previously appeared in these debug messages. A captured-log
  regression test runs with debug enabled and checks that submitted passwords are
  absent. Login and employee request DTOs continue to redact their string output.
- Disable Redux DevTools in production and redact login/employee-save arguments
  from development action history. The network request itself remains unchanged.
- Add a React error boundary with a reload action, preserving the existing pending
  checkout recovery mechanism instead of leaving a blank screen after a render error.
- Use general API failure messages for shared requests, including people and sales,
  rather than incorrectly calling every failure a catalog error.
- Space chart labels according to chart width so the last hourly labels do not
  overlap on mobile. Keep both endpoint labels and the existing chart design.
- Correct outdated demo text on live pages and clarify that Settings tax is a local
  preview, not the tax applied to actual checkout.

## Isolation and data preservation

Default integration tests use dedicated in-memory H2 databases. The new
`TestDatabaseSafety` initializer runs before Flyway and rejects datasource locations
outside the explicit test allowlist. It is attached to every integration suite and
has tests for unsafe production URLs and schema fallback attempts.

`backend/scripts/Test-AllPostgres.ps1` initializes a new PostgreSQL 17 cluster in a
unique ignored `backend/target/task10-pg-*` directory, bound only to 127.0.0.1 on an
available port. It creates separate `freshmart_test`, `analytics_test` and
`people_test` databases, overrides test connection settings, runs Maven verification,
then stops that cluster and removes only its validated data directory. It does not
connect to or modify the existing store database. Temporary trust authentication is
limited to this local test server; no store credentials are required.

Browser testing uses another database in the isolated cluster and separate app ports.
Store records, user accounts and the normal development servers are preserved.
Existing analytics/people schema-isolation scripts remain supported by the test guard.

## Reproduce automated checks

With Java 17 configured, from `backend/`:

```powershell
.\mvnw.cmd verify
.\scripts\Test-AllPostgres.ps1
```

The PostgreSQL script requires `psql`, `initdb`, `pg_ctl` and `createdb` from the same
PostgreSQL installation; it resolves their directory from `psql` on PATH. Its normal
invocation cleans up automatically. `-KeepDatabase` is an optional browser-testing
aid: on success it retains the temporary cluster and writes its connection metadata
to `target/task10-postgres.json`; that cluster must then be stopped and cleaned up.
If a test server cannot be confirmed stopped, the script retains its directory.

From `frontend/`:

```powershell
npm ci
npm test
npm run build
```

The frontend suite includes Node API/Redux tests plus Vitest, React Testing Library
and jsdom component tests. No browser passwords or configured backend secrets were
found in frontend source or the production bundle. Local `.env` files and build/test
output remain untracked.

## Coverage and results

Final verification on October 27, 2026:

| Check | Passed | Failed |
| --- | ---: | ---: |
| JUnit/Spring Boot on H2 | 69 | 0 |
| Same backend suite on isolated PostgreSQL 17.9 | 69 | 0 |
| Frontend API/Redux tests | 60 | 0 |
| React component tests | 18 | 0 |
| Browser workflow groups | 10 | 0 |
| Responsive page checks | 54 | 0 |

There are **147 distinct automated backend/frontend tests**, all passing. PostgreSQL
reruns the same 69 backend tests; it is not counted as 69 additional distinct tests.
Employee/customer browser checks also passed separately. Maven verification and
packaging passed on both database engines, and the Vite production build passed.
No browser runtime errors were observed. The new regression tests reproduced the
validation, error response, outage and logging defects before their fixes.

| Area | Coverage |
| --- | --- |
| Authentication/security | Both logins, invalid credentials, JWT signature/expiry/claims, cookie settings, logout revocation, CSRF handshake, CORS, role routes, Admin API restrictions, cashier sale ownership, password hashing and no secrets in responses/logs |
| Catalog | Product/category create, read, update, delete, duplicate conflicts, search/filter combinations, invalid/missing records and category-in-use protection |
| Inventory | Stock in/out/restock, thresholds, real alerts, immutable history, negative/overflow protection, rollback and concurrent updates |
| Checkout | Cash/Card, discount-before-tax rounding, server prices, atomic stock deductions, simultaneous duplicate requests, overselling, changed payload/actor conflicts and recovery after lost responses |
| Sales/receipts | Pagination/search/sorting/date/payment/cashier filters, stable snapshots, receipt ownership and print workflow |
| Analytics | Exact database totals, local date boundaries, daily/weekly/monthly/custom ranges, DST boundary tests, empty periods, product/payment/cashier breakdowns, charts and CSV |
| People | Account creation/login, activation/revocation, profile whitelist, concurrent last-Admin protection, customer CRUD/archive/restore, customer history, linked/guest checkout |
| Frontend states | Loading, errors/retries, success, empty tables, form validation, protected routes, pagination, markup escaping, safe render recovery and sensitive action redaction |
| Responsive browser checks | All 11 Admin and 7 Cashier pages at 1440×1000, 768×1024 and 390×844; 54 page checks, mobile navigation, overflow checks and visual screenshots |

Headed Playwright tested the real React/Spring Boot/PostgreSQL application. Browser
scripts and screenshots are temporary artifacts under the user's temporary directory,
not committed dependencies. Tests exercised a committed checkout whose response was
deliberately lost, then refreshed and retried: exactly one sale and stock deduction
remained. A three-item checkout at 2.50 with discount 1.00 and tax 7.5% saved subtotal
7.50, tax 0.49 and total 6.99. Reports and CSV agreed with the resulting sale headers.
Direct PostgreSQL verification of the browser fixture returned four sales, subtotal
15.00, discount 1.00, tax 1.06 and revenue 15.06, matching the report. The original
store database still had its original sale: subtotal 6.00, discount 1.00, tax 0.00
and total 5.00.

## Remaining scope

Card payments remain simulated and Settings remains a local preview, as in Tasks
1–9. These are existing scope limits, not new regressions. Browser printing was
verified through the print action and receipt view; no physical printer is required.
No refunds, suppliers, multi-store features or Task 11 work were added.

Task 10 is complete with no known application regressions. Restart an already-running
backend to load the reliability fixes; normal run commands are unchanged.

All temporary application/database services were stopped. The final normal PostgreSQL
test-script invocation successfully cleaned its own cluster. Automatic approval review
blocked the later recursive removal of three earlier temporary cluster directories;
no more specific reason was provided. Those ignored directories remain under
`backend/target/task10-pg-*`. They contain only isolated test data, are not committed,
and no longer have running servers. Normal development services were left running.

## Changed files

Paths are relative to the repository root.

- `README.md`
- `backend/scripts/Test-AllPostgres.ps1`
- `backend/src/main/java/com/freshmart/controller/ApiExceptionHandler.java`
- `backend/src/main/java/com/freshmart/security/JwtAuthenticationFilter.java`
- `backend/src/main/resources/application.properties`
- `backend/src/test/java/com/freshmart/AnalyticsIntegrationTest.java`
- `backend/src/test/java/com/freshmart/AuthIntegrationTest.java`
- `backend/src/test/java/com/freshmart/CatalogIntegrationTest.java`
- `backend/src/test/java/com/freshmart/CheckoutIntegrationTest.java`
- `backend/src/test/java/com/freshmart/InventoryIntegrationTest.java`
- `backend/src/test/java/com/freshmart/PeopleIntegrationTest.java`
- `backend/src/test/java/com/freshmart/ReliabilityIntegrationTest.java`
- `backend/src/test/java/com/freshmart/SalesHistoryIntegrationTest.java`
- `backend/src/test/java/com/freshmart/TestDatabaseSafety.java`
- `backend/src/test/java/com/freshmart/TestDatabaseSafetyTest.java`
- `backend/src/test/java/com/freshmart/security/JwtAuthenticationFilterTest.java`
- `backend/src/test/resources/application-test.properties`
- `docs/testing.md`
- `frontend/README.md`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.jsx`
- `frontend/src/components/AnalyticsCharts.jsx`
- `frontend/src/components/ErrorBoundary.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/pages/admin/Settings.jsx`
- `frontend/src/services/catalogApi.js`
- `frontend/src/store/devTools.js`
- `frontend/src/store/store.js`
- `frontend/tests/components.test.jsx`
- `frontend/tests/reliability.test.js`
- `frontend/vitest.config.js`
