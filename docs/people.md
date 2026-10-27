# Task 9: Employee and customer management

Task 9 connects the existing Employees, Customers and Profile pages to PostgreSQL,
using the existing FreshMart layout and green theme. The sidebar, header, inventory
calculations, payment calculations and authentication flow remain unchanged.

## Accounts and permissions

Employees are the existing `app_users` records; no parallel authentication table is
created. Admin can search/filter/paginate accounts, create Cashiers or Admins, edit
details, reset passwords and activate/deactivate accounts. Joining dates are returned
from the existing account creation timestamps.

New/reset passwords require at least 12 characters and at most 72 UTF-8 bytes and use
the existing BCrypt encoder. Responses never include passwords or hashes. Role,
email, password and status changes invalidate existing sessions via `authVersion`.
Users cannot deactivate themselves. A database guard serializes account mutations
so concurrent demotions/deactivations cannot remove the last active Admin.

Admin and Cashier can update their own name and phone. Email, role, status and account
ID are not accepted through the profile update DTO. Existing JWT cookies, CSRF tokens
and backend role checks protect these APIs.

## APIs

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/admin/employees` | Admin | List; `q`, `role`, `enabled`, `page`, `size` |
| `POST /api/admin/employees` | Admin | Create login account |
| `PUT /api/admin/employees/{id}` | Admin | Edit account, role/status or optional password |
| `GET /api/profile` | Admin/Cashier | Current account |
| `PUT /api/profile` | Admin/Cashier | Persist own name/phone |
| `GET /api/admin/customers` | Admin | List; `q`, `enabled`, `page`, `size` |
| `POST /api/admin/customers` | Admin | Create customer |
| `GET /api/admin/customers/{id}` | Admin | Customer and lifetime purchase totals |
| `PUT /api/admin/customers/{id}` | Admin | Edit or activate/deactivate customer |
| `DELETE /api/admin/customers/{id}` | Admin | Archive customer while preserving history |
| `GET /api/admin/customers/{id}/sales` | Admin | Paginated purchase history and totals |
| `GET /api/pos/customers?q=...` | Admin/Cashier | Up to 20 active customer choices |

Pages start at zero; sizes are 1–100. Search is limited to 100 characters and treats
SQL wildcard characters literally. Employee filters accept `ADMIN`/`CASHIER` and
status filters accept `true`/`false`. Forms validate required fields and lengths;
customer name/phone are required and email is optional. Customer status is required
on create/update. Blank optional email becomes null. Duplicate employee emails return
409. Invalid filters/forms return 400. Unauthorized and wrong-role requests return
401/403 using the existing security configuration.

Customer management and lifetime history follow the existing Admin-only Customers
page. Cashiers only receive customer ID/name/phone from the checkout lookup; they
cannot access employee management, customer email/spending totals or other cashiers'
sales. The existing sale ownership checks still apply to receipts and sales APIs.

## Customers and checkout

Flyway V6 adds customers, the employee mutation guard, and nullable `customer_id` and
`customer_name` sale columns. No historical amounts or existing customer-less sales
are rewritten. Customer totals are aggregated from sale headers in SQL, avoiding
duplicate totals from line joins. History uses a consistent database snapshot and
the existing store timezone for display.

The existing checkout request accepts optional `customerId`. Selecting a customer
does not affect subtotal, discount, tax, payment or stock calculations. An active
customer is checked and locked inside the checkout transaction, then the ID and name
are saved with the sale. Receipts retain that name snapshot after customer edits.
Omitting the customer keeps guest checkout and the original guest idempotency hash.
Selected customers are retained with pending checkout recovery; changing the customer
cannot reuse the same checkout key. Completed checkouts can still be replayed after
the customer is archived.

The UI uses activation/deactivation instead of destructive customer deletion. The
DELETE API also archives, retaining historical links and spending; PUT can restore
the customer. Inactive customers cannot be selected for a new sale. A stale selection
fails cleanly without saving a sale or deducting stock.

## Validation completed

- All 60 backend tests passed, including the existing authentication, catalog,
  checkout, inventory, sales and analytics suites and 9 new people integration tests.
- All 9 people integration tests also passed against PostgreSQL 17 in an isolated
  generated schema. They cover account creation/login, password hashing, revocation,
  last-Admin protection including concurrent demotions, CSRF/role restrictions,
  profile persistence, customer CRUD/archive, purchase history, guest/linked checkout,
  atomic rollback and idempotency. Linked-sale financial totals match saved headers.
- All 58 frontend tests passed; the production build passed. Tests cover API payload
  whitelisting, session clearing/stale responses, persisted profiles, optional customer
  selection and pending checkout recovery.
- Headed Playwright checks passed on an isolated PostgreSQL-backed application:
  employee creation/login, own profile edits and reload, role access, account status
  and session invalidation, customer creation/editing/status, empty and populated
  purchase history, linked and guest sales, error/retry, and mobile layout. No browser
  errors or page-level mobile overflow were observed.
- Backend packaging passed. The initial packaging attempt encountered a Windows lock
  from the old running JAR after all tests passed; stopping that process and rerunning
  packaging resolved it.
- A final read of the existing public schema confirmed its original sale remains
  subtotal 6.00, discount 1.00, tax 0.00 and total 5.00. Temporary browser servers and
  test schemas were removed; the regular development servers remain available.

Run from `backend/` with Java 17:

```powershell
.\mvnw.cmd verify
.\scripts\Test-PeoplePostgres.ps1
```

The PostgreSQL script reads the local database settings, creates a uniquely named
test schema, applies migrations, runs the nine tests and drops only that schema.
From `frontend/`, run `npm test` and `npm run build`.

Task 9 is complete with no known remaining issues. Task 10, refunds, suppliers and
multi-store features are outside this change.

## Changed files

Paths are relative to the repository root.

- `README.md`
- `backend/src/main/java/com/freshmart/config/SecurityConfig.java`
- `backend/src/main/java/com/freshmart/dto/CheckoutRequest.java`
- `backend/src/main/java/com/freshmart/dto/CheckoutResponse.java`
- `backend/src/main/java/com/freshmart/model/Sale.java`
- `backend/src/main/java/com/freshmart/model/User.java`
- `backend/src/main/java/com/freshmart/repository/SalesHistoryRepository.java`
- `backend/src/main/java/com/freshmart/repository/UserRepository.java`
- `backend/src/main/java/com/freshmart/service/SalesService.java`
- `backend/src/test/java/com/freshmart/AnalyticsIntegrationTest.java`
- `frontend/README.md`
- `frontend/src/components/POSView.jsx`
- `frontend/src/components/PeopleView.jsx`
- `frontend/src/components/ProfileView.jsx`
- `frontend/src/components/SaleDetailsModal.jsx`
- `frontend/src/data/mockData.js`
- `frontend/src/pages/Receipt.jsx`
- `frontend/src/store/slices/authSlice.js`
- `frontend/src/store/slices/cartSlice.js`
- `frontend/src/store/slices/managementSlice.js`
- `frontend/src/store/store.js`
- `frontend/tests/auth.test.js`
- `frontend/tests/checkout.test.js`
- `backend/scripts/Test-PeoplePostgres.ps1`
- `backend/src/main/java/com/freshmart/controller/CustomerController.java`
- `backend/src/main/java/com/freshmart/controller/EmployeeController.java`
- `backend/src/main/java/com/freshmart/controller/PeopleExceptionHandler.java`
- `backend/src/main/java/com/freshmart/dto/People.java`
- `backend/src/main/java/com/freshmart/model/Customer.java`
- `backend/src/main/java/com/freshmart/repository/CustomerHistoryRepository.java`
- `backend/src/main/java/com/freshmart/repository/CustomerRepository.java`
- `backend/src/main/java/com/freshmart/service/CustomerService.java`
- `backend/src/main/java/com/freshmart/service/EmployeeService.java`
- `backend/src/main/resources/db/migration/V6__people_and_sale_customers.sql`
- `backend/src/test/java/com/freshmart/PeopleIntegrationTest.java`
- `backend/src/test/resources/application-people-test.properties`
- `docs/people.md`
- `frontend/src/components/CustomerHistory.jsx`
- `frontend/src/components/POSCustomerPicker.jsx`
- `frontend/src/services/peopleService.js`
- `frontend/src/store/slices/peopleSlice.js`
- `frontend/tests/people.test.js`
