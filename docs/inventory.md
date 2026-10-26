# Task 5: Inventory Management

Inventory now uses PostgreSQL, the existing Spring Boot API, Redux Toolkit and
the existing Axios cookie/CSRF client. The existing Inventory page layout,
summary cards, tables, dialogs and responsive styles are retained.

## Run and test manually

Start PostgreSQL and run these commands in separate terminals:

```powershell
# From backend/; use your installed Java 17 directory.
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
.\mvnw.cmd spring-boot:run
```

```sh
# From frontend/
npm ci
npm run dev
```

Flyway applies V3 automatically. Every existing product receives one inventory
record with stock 0 and minimum stock 10. New products receive the same defaults
within the product creation transaction. Existing users, products and categories
are preserved. No mock stock quantities are imported.

1. Open `http://localhost:5173/login`. Sign in as `admin@freshmart.com` with
   `Admin@FreshMart123` (development credentials).
2. Create a category/product if needed, then open Inventory. All catalog products,
   including inactive ones, appear. Use Adjust → Stock In to add 20 units with
   a reason. Stock Out 16 units should leave 4, triggering the default low-stock alert.
3. Try removing 5 more units: the API refuses the request and retains 4 units.
4. Use the threshold button to set a minimum of 3. Four units now count as In Stock.
   Restock adds the entered quantity; it does not replace the current balance.
5. Refresh to confirm persistence. Search by product name/SKU/barcode, select a
   category, and filter by In Stock, Low Stock, Out of Stock or Needs Attention.
6. Open the product's history or Stock history for all products. Inspect movement
   type, quantity, before/after balance, reason, timestamp and user. Threshold changes
   are also audited. History can be searched and filtered by type.
7. Sign in as `cashier@freshmart.com` with `Cashier@FreshMart123`. Open
   `/cashier/inventory`: quantities, filters and summaries are available, but adjustment,
   threshold and history controls are absent. API writes and history return 403.

Header/sidebar stock alerts and the dashboard stock alert table now use actual
inventory. They refresh on route changes and browser focus, and update after stock
changes. Catalog saves/deletes trigger inventory reloads. The Inventory page shows
loading, success, validation, network-error and retry feedback.

## Data and consistency

- `inventory.product_id` is both the primary key and product foreign key. There can
  be only one stock balance per product; no duplicate stock fields are added to products.
- A transaction locks that inventory row before reading the balance, validates the
  delta, updates stock and inserts a movement. The lock stays held through commit or
  rollback, serializing adjustments across concurrent requests and application instances.
- Quantities are whole numbers. Adjustments require a positive quantity and nonblank
  reason. Stock and thresholds range from 0 to 1,000,000,000. Decimal quantities are
  rejected rather than truncated. Database CHECK constraints also prevent negative stock.
- Each movement records a server timestamp and the authenticated user's ID/name;
  client-supplied actor fields have no effect. There are no movement edit/delete APIs.
- Product/user names and IDs in history are audit snapshots, deliberately independent
  of foreign keys so they survive later renames or deletion. Products with positive
  stock cannot be deleted. Remove stock with a reason first; deletion at zero removes
  the inventory row while retaining its history. Task 4 category deletion rules remain.
- Stock 0 is Out of Stock even if the threshold is 0. Positive stock below the threshold
  is Low Stock; a quantity equal to the threshold is In Stock. Needs Attention combines
  low-stock and out-of-stock products.
- Inventory value uses current selling price, not accounting cost. Backend totals use
  decimal arithmetic. Cards cover the entire catalog rather than only filtered rows.

The locking implementation follows [Spring Data JPA locking](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html)
and [PostgreSQL row locking](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS).

## REST API

The existing JWT HttpOnly cookie is required. Writes additionally use the existing
CSRF handshake (`GET /api/auth/csrf`, then `X-CSRF-TOKEN` plus the cookie).

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| GET | `/api/inventory` | ADMIN, CASHIER | All inventory; optional `q`, `categoryId`, `status` |
| GET | `/api/inventory/{productId}` | ADMIN, CASHIER | One product's current balance |
| GET | `/api/inventory/summary` | ADMIN, CASHIER | Product count, units, value, low/out counts |
| GET | `/api/inventory/movements` | ADMIN | All history; optional `productId`, including deleted products |
| POST | `/api/inventory/{productId}/movements` | ADMIN | Adjust stock and return the committed balance |
| PUT | `/api/inventory/{productId}/threshold` | ADMIN | Set minimum stock and return the balance |

Status query values: `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`.
Movement types: `STOCK_IN`, `STOCK_OUT`, `RESTOCK`.

```json
{
  "type": "STOCK_IN",
  "quantity": 20,
  "reason": "Supplier delivery received"
}
```

Threshold body:

```json
{ "minStock": 10 }
```

API errors use the existing `{ "code", "message" }` format: 400 invalid input,
401 missing/expired session, 403 permissions/CSRF, 404 missing inventory product,
409 insufficient stock/stock limit/concurrent conflict, and 503 database unavailability.
Lists are unpaginated on the server; the existing frontend table paginates locally.

## Scope and future POS integration

Authentication, JWTs, login/logout and user records are unchanged. Only inventory
endpoint permissions are added to Spring Security. Inventory mock data is removed
from Inventory and stock alerts. Existing POS/sales demonstrations remain isolated
and do not change real inventory. No checkout, sales API or Task 6 work is included.

Future POS services should call the transactional inventory service, not write
balances directly. An enclosing sale transaction can roll back both its stock change
and movement. Multi-product operations should acquire locks in consistent product-ID
order. Automatic retry of stock writes after an uncertain network outcome is not
implemented; inspect history/current stock before resubmitting. Request idempotency
and checkout integration belong to that future implementation.

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

The isolated backend tests exercise schema creation, initial inventory, Stock In/Out/
Restock, thresholds, low/out status, summaries, search/filtering, validation, permissions,
CSRF, audit identity, transaction rollback, concurrent increments/competing removals,
and catalog deletion compatibility. Authentication and catalog regression tests also run.
Frontend tests cover API-only data, summary/alert calculations, delta requests, errors,
threshold changes, stale response ordering, history selection and session expiry.

Live PostgreSQL/browser checks additionally verify migration backfill for an existing
product, persistence after refresh, forms, audit tables, Admin/Cashier behavior,
simultaneous HTTP stock updates, network retry and desktop/mobile layouts.

## Verification results — 26 October 2026

- Backend: all 27 tests passed (11 authentication, 7 catalog, 9 inventory), with
  no failures, errors or skipped tests. The Spring Boot executable JAR built successfully.
  Packaging was rerun after stopping the old server because Windows had locked its JAR;
  the successful packaging run reused the already-passed test results.
- Frontend: all 22 tests passed and the Vite production build succeeded.
- Live Chromium with PostgreSQL 17: Admin and Cashier login, stock listing, Stock In,
  Stock Out, Restock, threshold editing, alerts, combined filters, summaries, movement
  history, refresh persistence, denied overdraw, permission checks and network retry passed.
  No JavaScript/React errors or HTTP 5xx responses occurred. Desktop and mobile layouts
  were inspected using the existing styles.
- Live concurrency with independent authenticated HTTP clients: eight simultaneous
  additions increased stock from 10 to 18. Two competing withdrawals of 12 returned
  200 and 409, leaving 6 units. The database recorded exactly one successful withdrawal.
  The test clients use the existing CSRF handshake and retry only rejected CSRF checks;
  sharing one rotating cookie jar between clients was unsuitable for this test.
- Direct PostgreSQL queries confirmed Flyway V1–V3 succeeded, the expected 14 audit
  records persisted with the correct quantities, balances and authenticated user, and
  no negative stock existed. Zero-stock product deletion removed its inventory row while
  retaining history. Temporary test products, categories and their audit records were
  cleaned up after verification.
- No outstanding Task 5 defects were found. Server-side pagination and request
  idempotency are not implemented; these are the scaling/future-integration limitations
  described above, not required Task 5 features. No POS, Sales or Task 6 logic was added.

## Files changed

Modified (19):

- [backend/src/main/java/com/freshmart/config/SecurityConfig.java](../backend/src/main/java/com/freshmart/config/SecurityConfig.java)
- [backend/src/main/java/com/freshmart/controller/InventoryController.java](../backend/src/main/java/com/freshmart/controller/InventoryController.java)
- [backend/src/main/java/com/freshmart/model/Inventory.java](../backend/src/main/java/com/freshmart/model/Inventory.java)
- [backend/src/main/java/com/freshmart/service/InventoryService.java](../backend/src/main/java/com/freshmart/service/InventoryService.java)
- [backend/src/main/java/com/freshmart/service/ProductService.java](../backend/src/main/java/com/freshmart/service/ProductService.java)
- [database/README.md](../database/README.md)
- [docs/api-documentation.md](../docs/api-documentation.md)
- [docs/catalog.md](../docs/catalog.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/src/components/DashboardView.jsx](../frontend/src/components/DashboardView.jsx)
- [frontend/src/components/Header.jsx](../frontend/src/components/Header.jsx)
- [frontend/src/components/Layout.jsx](../frontend/src/components/Layout.jsx)
- [frontend/src/components/Sidebar.jsx](../frontend/src/components/Sidebar.jsx)
- [frontend/src/pages/admin/Inventory.jsx](../frontend/src/pages/admin/Inventory.jsx)
- [frontend/src/routes/AppRoutes.jsx](../frontend/src/routes/AppRoutes.jsx)
- [frontend/src/services/inventoryService.js](../frontend/src/services/inventoryService.js)
- [frontend/src/store/slices/inventorySlice.js](../frontend/src/store/slices/inventorySlice.js)
- [frontend/src/store/store.js](../frontend/src/store/store.js)
- [README.md](../README.md)

Created (18):

- [backend/src/main/java/com/freshmart/controller/InventoryExceptionHandler.java](../backend/src/main/java/com/freshmart/controller/InventoryExceptionHandler.java)
- [backend/src/main/java/com/freshmart/dto/InventoryResponse.java](../backend/src/main/java/com/freshmart/dto/InventoryResponse.java)
- [backend/src/main/java/com/freshmart/dto/InventorySummary.java](../backend/src/main/java/com/freshmart/dto/InventorySummary.java)
- [backend/src/main/java/com/freshmart/dto/StockAdjustmentRequest.java](../backend/src/main/java/com/freshmart/dto/StockAdjustmentRequest.java)
- [backend/src/main/java/com/freshmart/dto/StockMovementResponse.java](../backend/src/main/java/com/freshmart/dto/StockMovementResponse.java)
- [backend/src/main/java/com/freshmart/dto/StockThresholdRequest.java](../backend/src/main/java/com/freshmart/dto/StockThresholdRequest.java)
- [backend/src/main/java/com/freshmart/dto/WholeQuantityDeserializer.java](../backend/src/main/java/com/freshmart/dto/WholeQuantityDeserializer.java)
- [backend/src/main/java/com/freshmart/model/StockMovement.java](../backend/src/main/java/com/freshmart/model/StockMovement.java)
- [backend/src/main/java/com/freshmart/model/StockOperation.java](../backend/src/main/java/com/freshmart/model/StockOperation.java)
- [backend/src/main/java/com/freshmart/model/StockStatus.java](../backend/src/main/java/com/freshmart/model/StockStatus.java)
- [backend/src/main/java/com/freshmart/repository/InventoryRepository.java](../backend/src/main/java/com/freshmart/repository/InventoryRepository.java)
- [backend/src/main/java/com/freshmart/repository/StockMovementRepository.java](../backend/src/main/java/com/freshmart/repository/StockMovementRepository.java)
- [backend/src/main/resources/db/migration/V3__create_inventory.sql](../backend/src/main/resources/db/migration/V3__create_inventory.sql)
- [backend/src/test/java/com/freshmart/InventoryIntegrationTest.java](../backend/src/test/java/com/freshmart/InventoryIntegrationTest.java)
- [docs/inventory.md](../docs/inventory.md)
- [frontend/src/components/StockAdjustmentForm.jsx](../frontend/src/components/StockAdjustmentForm.jsx)
- [frontend/src/components/StockHistory.jsx](../frontend/src/components/StockHistory.jsx)
- [frontend/tests/inventory.test.js](../frontend/tests/inventory.test.js)
