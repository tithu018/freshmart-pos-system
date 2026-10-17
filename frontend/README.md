# FreshMart frontend — Task 2

One responsive React application with a shared login and role-specific
workspaces, built on the existing Vite, Redux Toolkit, and Tailwind CSS setup.

## Run

From the repository root:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Choose Admin or Cashier and use the prefilled
details. Any valid email and nonempty password are accepted; credentials are
not verified, stored, or transmitted. Use the sidebar sign-out button to try
the other role. Refreshing resets the demo and returns you to login.

```sh
npm run build
npm run preview
```

The production build goes to `dist/`. Preview runs on port 4173. Node.js
22.12+ is required, as in Task 1. No backend or database is required. The
existing `.env` and Vite configuration are unchanged and the API URL is unused.

## Routes

| Workspace | Paths |
| --- | --- |
| Shared | `/login` |
| Admin | `/admin/dashboard`, `/admin/pos`, `/admin/products`, `/admin/categories`, `/admin/inventory`, `/admin/sales`, `/admin/customers`, `/admin/employees`, `/admin/reports`, `/admin/settings`, `/admin/profile` |
| Cashier | `/cashier/dashboard`, `/cashier/pos`, `/cashier/sales-history`, `/cashier/profile` |

`/` and workspace roots redirect to the appropriate entry page. Role guards
demonstrate page/menu visibility only and must not be treated as authentication
or server-side authorization. Unknown paths display a recovery page.

## Structure

- `src/components/`: reusable Sidebar, Header, Layout, Brand, cards, tables,
  fields, modal, toasts, charts, product form, and shared page views.
- `src/pages/`: all Admin, Cashier, and login route components. Shared POS,
  dashboard, profile, sales, and directory views avoid duplicated UI.
- `src/routes/AppRoutes.jsx`: single React Router tree and demo role guards.
- `src/data/mockData.js`: catalog, categories, people, transactions, and chart
  fixtures. The reference date is October 17, 2026; prices use USD.
- `src/store/slices/`: demo role/profile, catalog/categories, cart, sales,
  and management/settings state. Inventory derives from the catalog to keep
  counts consistent. No backend services are imported or called.
- `src/utils/format.js`: shared formatting and CSV downloads.
- `src/index.css`: Tailwind entry, theme tokens, reusable component styles,
  responsive breakpoints, and reduced-motion support.
- `public/favicon.svg`: local FreshMart icon. Grocery artwork and product
  symbols render locally with no external asset requests.

## Demo interactions

- Search, filter, and paginate tables. The header searches the product catalog.
- Add/edit products and categories, with duplicate name/SKU checks. Category
  renames update products in the same category.
- Adjust stock in Inventory; POS quantities respect available stock.
- Add products to the cart, adjust/remove quantities, choose a payment method,
  and complete a mock checkout. New sales appear in history and reduce stock.
- View sale details; export products, inventory, sales, and reports as CSV.
- Add/edit customer and employee directory entries. Directory roles do not
  create login accounts or change the current demo role.
- Update profile information, store details, tax percentage, receipt footer,
  and low-stock notification preference for the current in-memory session.
- Dashboard trend charts are explicitly marked illustrative. Reports and
  payment totals are derived from mock transactions.

All edits are temporary and reset on refresh. No real authentication,
payments, database operations, backend integration, or next-task work is included.

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
