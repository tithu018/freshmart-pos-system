# FreshMart POS System

A supermarket POS and inventory management system for admin and cashier users.
Task 1 provides the development setup. Task 2 adds a responsive frontend demo
with separate Admin and Cashier workspaces inside one React application.
Task 3 connects the shared login to PostgreSQL-backed JWT authentication and
enforces Admin/Cashier access without changing the business UI.
Task 4 adds PostgreSQL-backed Products and Categories with Admin management
and Cashier read-only access. See [catalog setup, APIs, and testing](docs/catalog.md).
Task 5 adds persistent inventory, stock movements, thresholds and real stock alerts.
See [inventory setup, APIs, and testing](docs/inventory.md).
Task 6 connects POS billing to transactional checkout, sale records and inventory.
See [checkout setup, APIs, recovery and testing](docs/checkout.md).
Task 7 adds real sales history, ownership checks, recent transactions and printable receipts.
See [sales history, receipts and testing](docs/sales.md).
Task 8 connects Admin/Cashier dashboards and Admin reports to database aggregations,
with real charts, date filtering and CSV exports. See [analytics and testing](docs/analytics.md).
Task 9 adds employee account management, persisted profiles, customers, purchase history,
and optional customer selection at checkout. See [people management and testing](docs/people.md).
Task 10 verifies Tasks 1–9, hardens validation and error handling, and adds isolated
PostgreSQL and React component tests. See [test results and reproduction](docs/testing.md).
Task 11 adds Docker, Compose and GitHub Actions tests/builds with GHCR image
publishing. See [Docker setup, CI and verification](docs/docker.md).
Task 12 defines Terraform modules for AWS networking, EKS and private RDS on the
`devops` branch. See [infrastructure, validation and planning](devops/terraform/README.md).
The configuration has not been applied; no AWS resources have been created.

## Run with Docker

Start Docker Desktop (Linux containers). From the repository root in PowerShell:

```powershell
.\devops\docker\Initialize-DockerEnvironment.ps1
docker compose up --build -d
```

The first command is a one-time setup that creates an ignored root `.env` with
random secrets. Open <http://localhost:3000> once `docker compose ps` shows all
services healthy. Use the initial account passwords from that file. Docker uses
its own persistent database volume and preserves your native development data.
See [the Docker guide](docs/docker.md) for configuration and shutdown commands.

## Requirements

- Node.js 22.12 or newer and npm.
- JDK 17, with `JAVA_HOME` pointing to the JDK installation directory.
- PostgreSQL (verified with version 17).

Maven is downloaded automatically by the included Maven Wrapper on first use.
An internet connection is needed for the first dependency installation.

## Frontend

React, Redux Toolkit, and Tailwind CSS are configured with Vite. From the project
root, run these commands in a terminal:

```sh
cd frontend
npm install
npm run dev
```

Start the backend and PostgreSQL first, then open <http://localhost:5173>.
The shared login verifies your email/password and opens your database-assigned
workspace. Development accounts are `admin@freshmart.com` / `Admin@FreshMart123`
and `cashier@freshmart.com` / `Cashier@FreshMart123`.
See [authentication setup and testing](docs/authentication.md) for details.

Admin pages: Dashboard, Point of Sale, Products, Categories, Inventory, Sales,
Customers, Employees, Reports, Settings, and My Profile. Cashier pages:
Dashboard, Products, Categories, Inventory, Point of Sale, Sales History, and My Profile. Cashier sales history
shows only that cashier's saved transactions. Both the frontend and backend
restrict access to the assigned role. Wrong-role routes show an access-denied page.

You can search and filter tables, add/edit catalog and directory records,
adjust inventory, export CSVs, edit your profile, and save store preferences.
Add real products to a POS order and complete checkout with Cash or a simulated
Card payment. Sale records and stock deductions persist together in PostgreSQL.
There is no real card charge. Products, Categories, Inventory and Checkout are persistent;
Sales History and recent dashboard transactions read those same checkout records.
Receipts can be viewed and printed by Admin or the sale's Cashier. Dashboard and report
analytics use the saved sales and inventory records. Employees, Customers and profile
updates also persist in PostgreSQL. Store Settings remains a local preview.
Authentication persists through an HttpOnly JWT
cookie and is restored into Redux on refresh. Mock business data uses
October 17, 2026 as its reference date and USD as its display currency.

See [frontend/README.md](frontend/README.md) for the frontend structure,
route map, and implementation notes.

`frontend/.env` is already provided locally. After cloning, copy
`frontend/.env.example` to `frontend/.env` (`Copy-Item .env.example .env` in
PowerShell, or `cp .env.example .env` on macOS/Linux, from `frontend/`).
`VITE_API_BASE_URL` points to the authentication API (`http://localhost:8081/api`).
Values prefixed with `VITE_` are public, so do not store secrets there.
Restart Vite after changing environment variables.

Other frontend commands, from `frontend/`:

```sh
npm run build
npm run preview
```

The build is written to `frontend/dist/`. Preview serves that build on port 4173.
Use `npm ci` instead of `npm install` for an installation matching the lockfile.

## Database

Follow [database/README.md](database/README.md) to create the local database and
role. Update `DB_PASSWORD` in `backend/.env` before starting the backend.
The default host is `localhost`, port is `5432`, database is `freshmart_pos`, and
username is `freshmart`. Flyway creates the authentication user table and the
dev profile seeds two missing users. Task 4 adds `categories` and `products`
through a separate migration; the catalog starts empty, with no mock seed data.
Task 5 adds one zero-stock inventory balance per product and an audit history table.
Task 6 adds sale headers/lines and links outgoing stock movements to each sale through V4.

## Backend

The backend uses Java 17 and Spring Boot with Spring Web, Spring Data JPA,
validation, the PostgreSQL JDBC driver, and the Spring Boot test starter (JUnit).

`backend/.env` is already provided locally. After cloning, copy
`backend/.env.example` to `backend/.env` and set your database connection values.
The backend imports `.env` as Java properties: use unquoted values, and double
any literal backslashes. Operating system environment variables override this
file. Generate a JWT signing key with `scripts/Initialize-AuthEnvironment.ps1`
if it is not already configured; see [Task 3](docs/authentication.md).
Start the app from `backend/` so the relative `.env` path resolves.

In a separate PowerShell terminal, starting at the project root:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

On macOS/Linux, from `backend/`:

```sh
sh ./mvnw spring-boot:run
```

The backend listens on <http://localhost:8081> and requires PostgreSQL, but does
not require the frontend. Look for `Started FreshmartApplication` in the logs.
Authentication endpoints are under `/api/auth`. Protected endpoints return
JSON 401/403 errors without redirecting to a backend login form. Port 8081
avoids an existing service on port 8080 on the setup machine.
You can change `SERVER_PORT` in `backend/.env` and the corresponding
`VITE_API_BASE_URL` in `frontend/.env`. Stop either development server with
`Ctrl+C` in its terminal.

If `JAVA_HOME` points to an older Java installation, correct it for the current
PowerShell terminal. On the machine used for setup, Java 17 is installed here:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
.\mvnw.cmd --version
```

On another machine, replace that path with your own JDK 17 directory. This changes
only the current terminal, not your system-wide Java settings.

Build the executable JAR from `backend/`:

```powershell
.\mvnw.cmd clean verify
java -jar target/freshmart-pos-backend-0.0.1-SNAPSHOT.jar
```

On macOS/Linux, use `sh ./mvnw clean verify` for the build. The JAR command is the
same. `verify` runs the isolated authentication integration tests and packaging.
Running the packaged app still requires the database settings above.

## Scope

Task 3 implements authentication and role access. Task 4 implements product
and category CRUD, search, status, validation, and read-only Cashier catalog pages.
Task 5 implements transactional stock updates, movement history, thresholds and
inventory alerts. Tasks 6–7 implement checkout, stock deductions, sales history and receipts.
Task 8 implements database-backed dashboards, sales analytics and report CSV exports.
Task 9 implements employee accounts, profiles, customers and linked purchase history.
Settings remains a local demo. Card payments are simulated;
Task 10 adds reliability fixes and regression coverage without new business features.
Task 11 adds Docker images, Compose and CI/CD image publishing without changing
the business UI. Task 12 defines AWS infrastructure without provisioning it.
Refunds, supplier management, multi-store features and Kubernetes application
deployment (Task 13) are not implemented.

Local `.env` files, dependency folders, and build outputs are excluded from Git.
Commit the `.env.example` files and frontend lockfile so others can reproduce
the setup.

Configuration references: [Vite](https://vite.dev/guide/),
[Tailwind CSS](https://tailwindcss.com/docs/installation/using-vite),
[Redux Toolkit](https://redux.js.org/tutorials/quick-start),
[Spring Boot configuration](https://docs.spring.io/spring-boot/3.5/reference/features/external-config.html),
and [Maven Wrapper](https://maven.apache.org/tools/wrapper/).
