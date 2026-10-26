# FreshMart frontend — Tasks 2–5

One responsive React application with a shared login and role-specific
workspaces, built on the existing Vite, Redux Toolkit, and Tailwind CSS setup.

## Run

From the repository root:

```sh
cd frontend
npm install
npm run dev
```

Start the backend and PostgreSQL, then open http://localhost:5173. Sign in with
`admin@freshmart.com` / `Admin@FreshMart123` or
`cashier@freshmart.com` / `Cashier@FreshMart123` (development accounts only).
Your server-assigned role selects the workspace. Use either sign-out button
to change accounts. Refresh restores authentication, while mock business data
resets. See [Task 3 authentication](../docs/authentication.md) for full setup.
Products and Categories persist in PostgreSQL; see [Task 4 catalog](../docs/catalog.md).
Inventory, stock adjustments and history also persist; see [Task 5 inventory](../docs/inventory.md).

```sh
npm run build
npm run preview
npm test
```

The production build goes to `dist/`. Preview runs on port 4173. Node.js
22.12+ is required, as in Task 1. Login requires the Spring Boot backend and
PostgreSQL. The existing Vite configuration is unchanged;
`VITE_API_BASE_URL` in `.env` supplies the authentication API address.

## Routes

| Workspace | Paths |
| --- | --- |
| Shared | `/login`, `/unauthorized` |
| Admin | `/admin/dashboard`, `/admin/pos`, `/admin/products`, `/admin/categories`, `/admin/inventory`, `/admin/sales`, `/admin/customers`, `/admin/employees`, `/admin/reports`, `/admin/settings`, `/admin/profile` |
| Cashier | `/cashier/dashboard`, `/cashier/products`, `/cashier/categories`, `/cashier/inventory`, `/cashier/pos`, `/cashier/sales-history`, `/cashier/profile` |

`/` and workspace roots redirect to the appropriate entry page. Role guards
use the verified server role. Spring Security separately enforces API
authorization. Unknown paths display a recovery page.

## Structure

- `src/components/`: reusable Sidebar, Header, Layout, Brand, cards, tables,
  fields, modal, toasts, charts, product form, and shared page views.
- `src/pages/`: all Admin, Cashier, and login route components. Shared POS,
  dashboard, profile, sales, and directory views avoid duplicated UI.
- `src/routes/AppRoutes.jsx`: single React Router tree and role guards.
- `src/data/mockData.js`: catalog, categories, people, transactions, and chart
  fixtures. The reference date is October 17, 2026; prices use USD.
- `src/store/slices/`: authenticated user, catalog/categories, cart, sales,
  and management/settings state. `catalogSlice.js` holds API Products/Categories;
  `inventorySlice.js` holds real stock, thresholds, movements and alert selectors.
  The Task 2 product mock slice remains isolated to the POS demo.
- `src/services/`: credentialed API requests, CSRF handshake, auth service, and
  Axios product/category services. Login and logout retain their existing client.
- `src/components/AuthSession.jsx`: refresh restoration and expiry handling.
- `src/hooks/useLogout.js`: shared server logout handling.
- `src/utils/format.js`: shared formatting and CSV downloads.
- `src/index.css`: Tailwind entry, theme tokens, reusable component styles,
  responsive breakpoints, and reduced-motion support.
- `public/favicon.svg`: local FreshMart icon. Grocery artwork and product
  symbols render locally with no external asset requests.

## Demo interactions

- Search, filter, and paginate tables. The header searches the product catalog.
- Admin product/category CRUD persists through the API, with duplicate name/SKU/
  barcode validation and category deletion protection. Cashiers have read-only views.
- Adjust actual stock and thresholds in Inventory; review immutable movement history.
  POS quantities still use separate demo stock and do not affect real balances.
- Add products to the cart, adjust/remove quantities, choose a payment method,
  and complete a mock checkout. New sales appear in history and reduce stock.
- View sale details; export products, inventory, sales, and reports as CSV.
- Add/edit customer and employee directory entries. Directory roles do not
  create login accounts or change the authenticated role.
- Preview name/phone edits locally (account email/ID/role stay read-only).
  Update mock store details, tax percentage, receipt footer,
  and low-stock notification preference for the current in-memory session.
- Dashboard trend charts are explicitly marked illustrative. Reports and
  payment totals are derived from mock transactions.

Product/category/inventory edits persist in PostgreSQL. Other business demos remain
temporary and reset on refresh. POS and sales services are not connected.
There are no real payments or Task 6 features. The Task 3 file inventory and
authentication details are in [docs/authentication.md](../docs/authentication.md).

## Task 2 file inventory

Paths below are relative to `frontend/`, except the root README.

| Created | Purpose |
| --- | --- |
| `README.md` | Frontend instructions, scope, and route map |
| `public/favicon.svg` | FreshMart browser icon |
| `src/components/Brand.jsx`, `GroceryIllustration.jsx` | Reusable branding and local login artwork |
| `src/components/Sidebar.jsx`, `Header.jsx`, `Layout.jsx` | Responsive shared application shell |
| `src/components/ui.jsx` | Buttons, badges, avatars, fields, cards, tables, dialogs, empty states, toasts |
| `src/components/Charts.jsx` | Reusable bar, line, and donut charts |
| `src/components/DashboardView.jsx`, `POSView.jsx`, `SalesView.jsx`, `ProfileView.jsx`, `PeopleView.jsx` | Shared page implementations |
| `src/components/ProductForm.jsx` | Add/edit product form |
| `src/data/mockData.js` | Demo records and fixtures |
| `src/hooks/useMediaQuery.js` | Responsive navigation behavior |
| `src/utils/format.js` | Formatting, stock labels, and CSV downloads |
| `src/pages/admin/POS.jsx`, `Profile.jsx` | Additional Admin route entries |
| `src/store/slices/managementSlice.js` | Customer, employee, and settings state |

| Changed / implemented | Purpose |
| --- | --- |
| Root `README.md` | Updated run instructions and Task 2 scope |
| `package.json`, `package-lock.json` | Added React Router and Lucide icons |
| `index.html` | Page metadata and favicon |
| `src/App.jsx`, `src/routes/AppRoutes.jsx` | Router, shared toast provider, role routing |
| `src/index.css` | FreshMart theme and responsive component styles |
| `src/pages/auth/Login.jsx` | One shared demo login |
| `src/pages/admin/Dashboard.jsx`, `Products.jsx`, `Categories.jsx`, `Inventory.jsx`, `Sales.jsx`, `Customers.jsx`, `Employees.jsx`, `Reports.jsx`, `Settings.jsx` | All existing Admin placeholders implemented |
| `src/pages/cashier/Dashboard.jsx`, `POS.jsx`, `SalesHistory.jsx`, `Profile.jsx` | All existing Cashier placeholders implemented |
| `src/store/store.js` | Connected Redux slices |
| `src/store/slices/authSlice.js`, `productSlice.js`, `inventorySlice.js`, `cartSlice.js`, `salesSlice.js` | Local demo state and derived inventory |
