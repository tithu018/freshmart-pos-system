# Task 4: Product and Category Management

Products and Categories now use Spring Boot, PostgreSQL, Redux Toolkit and Axios.
The existing page styles, table components, dialogs and navigation layout are retained.
Authentication still uses Task 3's login, HttpOnly JWT cookie and CSRF handshake.
Security configuration only adds catalog permissions and PUT/DELETE CORS support.

## Run

Start PostgreSQL, then start the backend from `backend/`:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
.\mvnw.cmd spring-boot:run
```

Use the Java 17 installation on your machine. Existing `.env` settings still apply.
Flyway applies `V2__create_catalog.sql` automatically without changing users or V1.
No manual SQL or mock catalog seeds are required. New catalog tables start empty.

From `frontend/`:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173/login`.

| Account | Development password | Catalog pages |
| --- | --- | --- |
| `admin@freshmart.com` | `Admin@FreshMart123` | `/admin/products`, `/admin/categories` |
| `cashier@freshmart.com` | `Cashier@FreshMart123` | `/cashier/products`, `/cashier/categories` |

## Manual checks

1. Sign in as Admin, open Categories, and add a category. Edit its name or description.
2. Open Products and add a product with name, SKU, category and price. Barcode and
   description are optional. Leading zeros in barcodes are retained. Unit and symbol
   preserve the existing catalog presentation.
3. Refresh the page to confirm persistence. Use View to see all product details.
4. Edit price, category or Active/Inactive status. Search by name, SKU, barcode or
   description and combine category/status filters. Export uses the filtered records.
5. Try a duplicate SKU, duplicate barcode or category name. The form stays open with
   the API error. Category names and SKUs are unique regardless of letter case.
6. Try deleting an assigned category: deletion is refused. Reassign or delete all
   its products first, then delete the unused category. Both deletes require confirmation.
7. Sign in as Cashier. Products and Categories are visible with search and product
   details, but no add/edit/delete controls. Direct API writes return 403, and Admin
   page URLs remain inaccessible.
8. Disconnect the API and open a catalog page to check the loading/error/retry states.

## REST API

Both roles can GET these resources. Only ADMIN can POST, PUT or DELETE them.
All requests require the existing authentication cookie. Writes also require a CSRF
token from `GET /api/auth/csrf`, sent in `X-CSRF-TOKEN`, with its cookie retained.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/products` | List; optional `q`, `categoryId`, `status=ACTIVE\|INACTIVE` |
| GET | `/api/products/{id}` | View product |
| POST | `/api/products` | Create, returns 201 and Location |
| PUT | `/api/products/{id}` | Replace editable fields, returns 200 |
| DELETE | `/api/products/{id}` | Delete, returns 204 |
| GET | `/api/categories` | List with product counts; optional `q` |
| GET | `/api/categories/{id}` | View category with product count |
| POST | `/api/categories` | Create, returns 201 and Location |
| PUT | `/api/categories/{id}` | Replace editable fields, returns 200 |
| DELETE | `/api/categories/{id}` | Delete only if unused, returns 204 |

Category create/update body:

```json
{
  "name": "Fruit",
  "description": "Fresh fruit",
  "status": "ACTIVE",
  "icon": "📦",
  "color": "green"
}
```

Product create/update body (use an actual category ID):

```json
{
  "name": "Fresh Apples",
  "sku": "FRU-001",
  "barcode": "001234567890",
  "categoryId": "category-uuid-from-api",
  "price": 2.50,
  "description": "Locally grown",
  "status": "ACTIVE",
  "unit": "each",
  "icon": "🍎",
  "color": "green"
}
```

Name/SKU are trimmed; SKU is stored uppercase. Blank barcodes become null, so
multiple products may omit a barcode. Prices are positive, at most 9,999,999,999.99,
with at most two decimal places; PostgreSQL uses NUMERIC rather than floating point.
Product name/SKU/barcode/description limits are 80/30/64/1000 characters. Category
name/description limits are 50/120 characters. Unit defaults to `each`; icon/color
default to `📦`/`green` if omitted. Both statuses are visible to Cashiers; status
does not implement stock or checkout behavior.

Errors use `{ "code": "...", "message": "..." }`: 400 validation/malformed input,
401 missing/expired session, 403 role/CSRF denial, 404 missing record, 409 duplicate
SKU/barcode/category or category in use, and 503 database unavailability.
Database constraints also enforce uniqueness and category references during
concurrent requests. Category renames retain product assignment by ID.

## Implementation boundaries

The new `catalog` Redux slice contains API data only. The existing `products` mock
slice remains limited to Task 2's dashboard, inventory and POS demonstrations.
This prevents catalog changes from creating stock updates, checkout or sales.
There are no inventory columns or stock controls in the catalog API/forms.
No Task 5 functionality is included.

The frontend loads the catalog from the API and filters it locally for immediate
table updates. The API also supports filtering for other clients. Lists are
unpaginated on the server; the existing table paginates in the browser.

Axios requests use credentials, timeouts and the existing CSRF token endpoint;
see the [Axios request configuration](https://axios-http.com/docs/req_config).
Catalog 401 responses dispatch the existing session-expired action. Login and
logout services, JWT implementation, user schema and authentication tests are unchanged.

## Automated verification

```powershell
# backend/
.\mvnw.cmd verify
```

```sh
# frontend/
npm test
npm run build
```

The backend tests use isolated H2 with the actual Flyway migrations and security
filters. They cover CRUD, assignments, category rename/delete rules, duplicate
values, input validation, filters, both roles, CSRF and CORS. Existing authentication
tests also run. Frontend tests cover API-only state, Axios cookies/CSRF, mutations,
counts, rename propagation, server errors, stale responses and expired sessions.

Live browser checks use the PostgreSQL-backed server and temporary uniquely named
records, then remove those records. They cover both logins, catalog CRUD, refresh,
filtering, role restrictions, category-in-use feedback, network retry and mobile layout.

Verified on October 26, 2026: backend `verify` passed all 18 tests (11 authentication,
7 catalog), frontend passed all 14 tests and the production build, and live PostgreSQL
browser checks passed without JavaScript/React errors or server 5xx responses.

## Exact project file changes

### Created

- [backend/src/main/java/com/freshmart/controller/CatalogExceptionHandler.java](../backend/src/main/java/com/freshmart/controller/CatalogExceptionHandler.java)
- [backend/src/main/java/com/freshmart/controller/CategoryController.java](../backend/src/main/java/com/freshmart/controller/CategoryController.java)
- [backend/src/main/java/com/freshmart/dto/CategoryRequest.java](../backend/src/main/java/com/freshmart/dto/CategoryRequest.java)
- [backend/src/main/java/com/freshmart/dto/CategoryResponse.java](../backend/src/main/java/com/freshmart/dto/CategoryResponse.java)
- [backend/src/main/java/com/freshmart/dto/ProductRequest.java](../backend/src/main/java/com/freshmart/dto/ProductRequest.java)
- [backend/src/main/java/com/freshmart/dto/ProductResponse.java](../backend/src/main/java/com/freshmart/dto/ProductResponse.java)
- [backend/src/main/java/com/freshmart/model/CatalogStatus.java](../backend/src/main/java/com/freshmart/model/CatalogStatus.java)
- [backend/src/main/java/com/freshmart/repository/CategoryRepository.java](../backend/src/main/java/com/freshmart/repository/CategoryRepository.java)
- [backend/src/main/java/com/freshmart/service/CatalogException.java](../backend/src/main/java/com/freshmart/service/CatalogException.java)
- [backend/src/main/java/com/freshmart/service/CategoryService.java](../backend/src/main/java/com/freshmart/service/CategoryService.java)
- [backend/src/main/resources/db/migration/V2__create_catalog.sql](../backend/src/main/resources/db/migration/V2__create_catalog.sql)
- [backend/src/test/java/com/freshmart/CatalogIntegrationTest.java](../backend/src/test/java/com/freshmart/CatalogIntegrationTest.java)
- [docs/catalog.md](../docs/catalog.md)
- [frontend/src/components/CatalogDeleteDialog.jsx](../frontend/src/components/CatalogDeleteDialog.jsx)
- [frontend/src/components/CatalogFeedback.jsx](../frontend/src/components/CatalogFeedback.jsx)
- [frontend/src/hooks/useCatalog.js](../frontend/src/hooks/useCatalog.js)
- [frontend/src/services/catalogApi.js](../frontend/src/services/catalogApi.js)
- [frontend/src/services/categoryService.js](../frontend/src/services/categoryService.js)
- [frontend/src/store/slices/catalogSlice.js](../frontend/src/store/slices/catalogSlice.js)
- [frontend/tests/catalog.test.js](../frontend/tests/catalog.test.js)

### Modified

- [README.md](../README.md)
- [backend/src/main/java/com/freshmart/config/SecurityConfig.java](../backend/src/main/java/com/freshmart/config/SecurityConfig.java)
- [backend/src/main/java/com/freshmart/controller/ProductController.java](../backend/src/main/java/com/freshmart/controller/ProductController.java)
- [backend/src/main/java/com/freshmart/model/Category.java](../backend/src/main/java/com/freshmart/model/Category.java)
- [backend/src/main/java/com/freshmart/model/Product.java](../backend/src/main/java/com/freshmart/model/Product.java)
- [backend/src/main/java/com/freshmart/repository/ProductRepository.java](../backend/src/main/java/com/freshmart/repository/ProductRepository.java)
- [backend/src/main/java/com/freshmart/service/ProductService.java](../backend/src/main/java/com/freshmart/service/ProductService.java)
- [database/README.md](../database/README.md)
- [docs/api-documentation.md](../docs/api-documentation.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/package-lock.json](../frontend/package-lock.json)
- [frontend/package.json](../frontend/package.json)
- [frontend/src/components/Layout.jsx](../frontend/src/components/Layout.jsx)
- [frontend/src/components/ProductForm.jsx](../frontend/src/components/ProductForm.jsx)
- [frontend/src/components/Sidebar.jsx](../frontend/src/components/Sidebar.jsx)
- [frontend/src/pages/admin/Categories.jsx](../frontend/src/pages/admin/Categories.jsx)
- [frontend/src/pages/admin/Products.jsx](../frontend/src/pages/admin/Products.jsx)
- [frontend/src/routes/AppRoutes.jsx](../frontend/src/routes/AppRoutes.jsx)
- [frontend/src/services/productService.js](../frontend/src/services/productService.js)
- [frontend/src/store/store.js](../frontend/src/store/store.js)
