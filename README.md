# FreshMart POS System

A supermarket POS and inventory management system for admin and cashier users.
Task 1 provides the development setup. Task 2 adds a responsive frontend demo
with separate Admin and Cashier workspaces inside one React application.

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

Open <http://localhost:5173>. The shared login page lets you choose **Admin** or
**Cashier**. Use the prefilled details and click **Sign in to FreshMart**. This is
a role-switching demo: any valid email and nonempty password are accepted, and
no credentials are checked or sent anywhere. The frontend runs independently
of the backend and PostgreSQL.

Admin pages: Dashboard, Point of Sale, Products, Categories, Inventory, Sales,
Customers, Employees, Reports, Settings, and My Profile. Cashier pages:
Dashboard, Point of Sale, Sales History, and My Profile. Cashier sales history
shows only that cashier's transactions. The UI redirects attempts to access
the other role's workspace; this is a navigation demonstration, not security.

You can search and filter tables, add/edit catalog and directory records,
adjust inventory, export CSVs, edit your profile, and save store preferences.
Add products to a POS order and complete a **demo sale** to update inventory
and sales history. No real payment is collected. All state lives in Redux
memory and resets on refresh, including the selected demo role. Mock data uses
October 17, 2026 as its reference date and USD as its display currency.

See [frontend/README.md](frontend/README.md) for the frontend structure,
route map, and implementation notes.

`frontend/.env` is already provided locally. After cloning, copy
`frontend/.env.example` to `frontend/.env` (`Copy-Item .env.example .env` in
PowerShell, or `cp .env.example .env` on macOS/Linux, from `frontend/`).
`VITE_API_BASE_URL` is reserved for future API calls; no requests are made yet.
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
username is `freshmart`. No tables or seed data are created in this task.

## Backend

The backend uses Java 17 and Spring Boot with Spring Web, Spring Data JPA,
validation, the PostgreSQL JDBC driver, and the Spring Boot test starter (JUnit).

`backend/.env` is already provided locally. After cloning, copy
`backend/.env.example` to `backend/.env` and set your database connection values.
The backend imports `.env` as Java properties: use unquoted values, and double
any literal backslashes. Operating system environment variables override this
file. Start the app from `backend/` so the relative `.env` path resolves.

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
There are no API endpoints yet, so a request to `/` returns HTTP 404; that is
expected. Port 8081 avoids an existing service on port 8080 on the setup machine.
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
same. No feature tests exist yet; `verify` currently checks compilation and
packaging. Running the packaged app still requires the database settings above.

## Scope

Task 2 implements frontend UI and local mock interactions only. API service
files remain placeholders. There is no backend integration, real
authentication, database logic, or payment processing. The backend, database,
Docker, Docker Compose, GitHub Actions, AWS, and Kubernetes setup is unchanged.

Local `.env` files, dependency folders, and build outputs are excluded from Git.
Commit the `.env.example` files and frontend lockfile so others can reproduce
the setup.

Configuration references: [Vite](https://vite.dev/guide/),
[Tailwind CSS](https://tailwindcss.com/docs/installation/using-vite),
[Redux Toolkit](https://redux.js.org/tutorials/quick-start),
[Spring Boot configuration](https://docs.spring.io/spring-boot/3.5/reference/features/external-config.html),
and [Maven Wrapper](https://maven.apache.org/tools/wrapper/).
