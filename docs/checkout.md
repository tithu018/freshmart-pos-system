# Task 6: POS billing and checkout

The existing Admin and Cashier POS pages now use actual catalog prices and inventory.
The FreshMart layout, CSS, product cards, quantity controls and modal styles are retained.
JWT login/logout and CSRF protection are unchanged. Only the new endpoint permissions
are added. No payment gateway, full Sales History, Reports, advanced receipt or Task 7
features are implemented. Existing Sales/Reports demo pages do not display these sales yet.

## Run and test

Start PostgreSQL, then start the backend from `backend/` with Java 17:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
.\mvnw.cmd spring-boot:run
```

Start the frontend from `frontend/` with `npm run dev`. Open `http://localhost:5173`.
Flyway automatically applies V4 on startup; V1–V3 and their records are retained.

1. Sign in as `admin@freshmart.com` / `Admin@FreshMart123` (development credentials).
   Create an active product/category if needed, then add stock in Inventory.
2. Open `/admin/pos`. Search by name, SKU or barcode, or select a category. Inactive
   products are excluded; zero-stock products are shown but cannot be added.
3. Add products, increase/decrease quantities, remove a line and clear the cart.
   Enter a fixed discount amount. The order shows subtotal, discount, tax and total.
4. Click Checkout. Select Cash (confirm it was received) or Card (simulated, no card
   details and no charge). Complete the sale and inspect the server confirmation.
5. Open Inventory or refresh: stock must be reduced and stock history shows the sale ID
   in the movement reason. The API also exposes `saleId` on movement records.
6. Sign in as `cashier@freshmart.com` / `Cashier@FreshMart123`. Repeat at `/cashier/pos`.
   Both roles can sell, while manual inventory adjustments remain Admin-only.
7. To test stale stock, have another session remove stock after adding to the cart.
   Checkout rejects an insufficient order and leaves all other items, movements and sale
   records unchanged. Review the refreshed stock and adjust the cart.
8. If a checkout response is lost, use Retry checkout. The cart is frozen until the result
   is known. Refreshing the same tab restores the pending request for the same signed-in
   user; retries return the original sale without another deduction.

## Totals and product validation

- Prices are read from the database, never trusted from client totals. The submitted
  expected unit prices and tax rate detect stale screens: a changed value returns 409
  so the user can review the refreshed order before submitting again.
- Discount is a fixed amount, between zero and subtotal. Tax is applied to the subtotal
  minus discount and rounded once to two decimal places using HALF_UP. Grand total is
  subtotal minus discount plus tax. Cash and simulated Card use the same calculations.
- `CHECKOUT_TAX_RATE` in backend environment/configuration controls the percentage.
  The default remains **0%**, matching the existing setting. Supported range: 0–100,
  up to two decimals. Restart the backend after changing it. The local demo Settings
  page does not override this authoritative value.
- Up to 100 distinct products, whole quantities of 1–1,000,000 per line, and subtotal/
  total up to 1,000,000,000 are supported. Monetary inputs allow at most two decimals.
  Duplicate product lines, inactive/missing products, invalid discounts and insufficient
  stock are rejected. Existing product category assignment rules remain unchanged.

## API

Use the existing HttpOnly JWT cookie. POST requires `GET /api/auth/csrf` followed by
its `X-CSRF-TOKEN` header and cookie. All three endpoints allow ADMIN and CASHIER.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/pos/products` | Active products with actual stock; optional `q` and `categoryId` |
| GET | `/api/pos/config` | Current tax percentage and maximum total |
| POST | `/api/checkout` | Commit a sale, or replay its prior successful result |

Example body (use an actual product ID and current price/rate):

```json
{
  "idempotencyKey": "54a74bc4-bf50-4210-bd7e-34f0115ad31c",
  "items": [{ "productId": "product-uuid", "quantity": 2, "expectedUnitPrice": 2.50 }],
  "discount": 1.00,
  "expectedTaxRate": 0,
  "payment": "CASH"
}
```

Payment values are `CASH` and `CARD`. Success returns 200 with the persisted sale ID,
timestamp, authenticated user, product/price/quantity snapshots, subtotal, discount,
tax percentage, tax and grand total. Initial checkout and replay return the same data.
Client-supplied totals or actor fields never determine the sale.

Errors retain `{code, message}`: 400 validation, 401 expired/missing authentication,
403 CSRF/access, 404 missing inventory, 409 insufficient stock/stale price or tax/
idempotency conflict, and 503 database unavailability. No sale history/list/delete API
is exposed by this task.

## Transactions and duplicate prevention

V4 creates `sales` and `sale_items`, plus a nullable sale foreign key on stock movements.
Sale product/user details are snapshots, so historical records survive later catalog
or account changes. Existing manual movements keep a null sale ID.

Checkout reserves a globally unique UUID idempotency key in the sale transaction before
changing stock. It locks inventory rows in sorted product-ID order and calls the existing
InventoryService deduction logic. The balance check, deduction, sale lines and linked
movement inserts all commit together. Any failure rolls everything back, including the
key reservation. The existing database constraints still prevent negative stock.

Concurrent inserts of the same key serialize on the database uniqueness constraint.
The losing request rolls back its transaction, then reads the committed sale in a fresh
transaction. Replay is permitted only for the same authenticated user and normalized
payload (product order is irrelevant). Different contents or another actor receive 409.
Successful keys have no expiry. Failed transactions leave no completed key behind.

The browser stores an in-flight key and immutable order snapshot in session storage,
scoped by authenticated user. A timeout/network/server error retains it and prevents
editing the uncertain order. A retry uses the exact same request; a definitive validation
failure releases the cart for correction. Session expiry clears visible data but retains
that user's pending request for recovery after signing back in. No credentials or card
data are stored. Session storage must be available before a checkout can be submitted.
CSRF/access rejection during a retry also retains the original request, because it
cannot resolve whether an earlier submission committed.
Closing the tab or clearing browser storage loses this recovery pointer; the API remains
idempotent when the original key is supplied. Ordinary unsubmitted carts remain in memory.

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

Checkout integration tests cover cash/card, server totals and rounding, authorization/
CSRF, validation, linked movements, rollback after an earlier line deduction, stale
prices/tax, sequential and simultaneous duplicate keys, and competing orders. The full
suite also runs existing authentication, catalog and inventory regression tests.
Frontend tests cover cart operations, totals, server confirmation, duplicate-click
suppression, unknown-outcome retries, refresh recovery, session expiry and storage errors.

## Verification results — 26 October 2026

- `mvnw.cmd verify`: **36 tests passed**, no failures/errors/skips; executable Spring Boot
  package built successfully. This includes all 27 existing authentication, catalog and
  inventory tests, plus 9 checkout integration tests. Nonzero tax (7.5%) and rounding
  are exercised in the isolated checkout tests without changing the local default tax.
- `npm test`: **34 tests passed**. `npm run build`: successful. `git diff --check`: clean.
- Visible Chromium against the actual PostgreSQL-backed server: name/SKU/barcode search,
  active catalog filtering, add/increase/decrease/remove cart items, discount/totals,
  Admin Cash, Cashier simulated Card, confirmation and stock refresh all passed.
  Cashier manual inventory adjustments still return 403.
- Live rollback: an order whose second product exceeded stock returned 409. Both
  balances and movement counts stayed unchanged, and SQL confirmed no failed sale row.
- Live concurrency: four simultaneous requests with one key returned the same sale ID
  and deducted stock once. Competing orders for limited stock returned 200 and 409;
  no balance became negative. Changing the payload under a used key returned 409.
- Lost-response recovery: the server committed a sale, then the browser response was
  deliberately discarded. After refreshing the tab, retry submitted the same key/body,
  returned the original confirmation and left stock unchanged.
- Direct PostgreSQL queries verified V1–V4 migrations, five test sale headers with
  correct Cash/Card methods, actor IDs, totals and one linked movement per sale. Stock
  matched the successful sales; failed orders created no sale records. Generated test
  sales, products, category and movements were removed after verification.
- Desktop/mobile layouts were inspected. No JavaScript/React errors or HTTP 5xx
  responses occurred during the live tests. The POS footer now correctly identifies
  completed sales as saved. Existing CSS and authentication logic are unchanged.

No known Task 6 defects remain. Explicit limitations: Card is simulated; full Sales
History/Reports remain demos; ordinary draft carts are in memory; pending recovery
requires the same tab's session storage. These are outside the requested scope.

## Files changed

Modified (17):

- [backend/.env.example](../backend/.env.example)
- [backend/src/main/java/com/freshmart/config/SecurityConfig.java](../backend/src/main/java/com/freshmart/config/SecurityConfig.java)
- [backend/src/main/java/com/freshmart/dto/StockMovementResponse.java](../backend/src/main/java/com/freshmart/dto/StockMovementResponse.java)
- [backend/src/main/java/com/freshmart/model/Sale.java](../backend/src/main/java/com/freshmart/model/Sale.java)
- [backend/src/main/java/com/freshmart/model/StockMovement.java](../backend/src/main/java/com/freshmart/model/StockMovement.java)
- [backend/src/main/java/com/freshmart/repository/SaleRepository.java](../backend/src/main/java/com/freshmart/repository/SaleRepository.java)
- [backend/src/main/java/com/freshmart/service/InventoryService.java](../backend/src/main/java/com/freshmart/service/InventoryService.java)
- [backend/src/main/java/com/freshmart/service/SalesService.java](../backend/src/main/java/com/freshmart/service/SalesService.java)
- [backend/src/main/resources/application.properties](../backend/src/main/resources/application.properties)
- [database/README.md](../database/README.md)
- [docs/api-documentation.md](../docs/api-documentation.md)
- [docs/inventory.md](../docs/inventory.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/src/components/Layout.jsx](../frontend/src/components/Layout.jsx)
- [frontend/src/components/POSView.jsx](../frontend/src/components/POSView.jsx)
- [frontend/src/store/slices/cartSlice.js](../frontend/src/store/slices/cartSlice.js)
- [README.md](../README.md)

Created (11):

- [backend/src/main/java/com/freshmart/controller/CheckoutController.java](../backend/src/main/java/com/freshmart/controller/CheckoutController.java)
- [backend/src/main/java/com/freshmart/controller/CheckoutExceptionHandler.java](../backend/src/main/java/com/freshmart/controller/CheckoutExceptionHandler.java)
- [backend/src/main/java/com/freshmart/dto/CheckoutRequest.java](../backend/src/main/java/com/freshmart/dto/CheckoutRequest.java)
- [backend/src/main/java/com/freshmart/dto/CheckoutResponse.java](../backend/src/main/java/com/freshmart/dto/CheckoutResponse.java)
- [backend/src/main/java/com/freshmart/model/PaymentMethod.java](../backend/src/main/java/com/freshmart/model/PaymentMethod.java)
- [backend/src/main/java/com/freshmart/model/SaleItem.java](../backend/src/main/java/com/freshmart/model/SaleItem.java)
- [backend/src/main/resources/db/migration/V4__create_checkout.sql](../backend/src/main/resources/db/migration/V4__create_checkout.sql)
- [backend/src/test/java/com/freshmart/CheckoutIntegrationTest.java](../backend/src/test/java/com/freshmart/CheckoutIntegrationTest.java)
- [docs/checkout.md](../docs/checkout.md)
- [frontend/src/services/checkoutService.js](../frontend/src/services/checkoutService.js)
- [frontend/tests/checkout.test.js](../frontend/tests/checkout.test.js)
