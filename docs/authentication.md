# Task 3 — authentication and role access

The existing FreshMart UI now uses Spring Boot and PostgreSQL for authentication.
Product, inventory, POS, customer, employee, report, and sales data remain the
Task 2 in-memory mock UI. No business APIs or Task 4 features are implemented.

## Run locally

On the current workspace, PostgreSQL's `freshmart` role and `freshmart_pos`
database have been created, and `backend/.env` contains the local database
password and a generated JWT key. These secrets are ignored by Git.

For a new clone, follow [database setup](../database/README.md), copy the `.env`
examples, and run this from `backend/` to generate the missing JWT key without
printing it or overwriting other settings:

```powershell
.\scripts\Initialize-AuthEnvironment.ps1
```

If PowerShell's local script policy blocks this helper, use
`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Initialize-AuthEnvironment.ps1`.
On another OS, set `JWT_SECRET` to the Base64 encoding of at least 32
cryptographically random bytes in the ignored backend `.env`.

Start the backend in one terminal:

```powershell
cd backend
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
.\mvnw.cmd spring-boot:run
```

Use the JDK 17 path on your machine. On macOS/Linux use `sh ./mvnw spring-boot:run`.
The server runs at **http://localhost:8081**. Flyway creates only `app_users`
and its migration history table. Hibernate validates the schema; it does not
drop or recreate tables. Development startup adds missing users without
overwriting existing accounts or password hashes.

Start the frontend in another terminal:

```sh
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173/login**. Use `localhost` consistently for both
frontend and API; cookies depend on the browser host. The existing
`VITE_API_BASE_URL=http://localhost:8081/api` is now used for authentication.

## Test accounts

These defaults exist only when the **dev** profile and development seeding are enabled.

| Account | Email | Development password | Destination |
| --- | --- | --- | --- |
| Admin | `admin@freshmart.com` | `Admin@FreshMart123` | `/admin/dashboard` |
| Cashier | `cashier@freshmart.com` | `Cashier@FreshMart123` | `/cashier/dashboard` |

The workspace cards retain the original layout. In the Vite dev server they
can fill the corresponding email; they never grant a role. Enter the password
and click **Sign in to FreshMart**. A cashier email always opens the cashier
workspace, regardless of the card selected. Use either existing sign-out
button before switching accounts.

`DEV_ADMIN_PASSWORD` and `DEV_CASHIER_PASSWORD` override seed passwords only
when creating an account for the first time. Existing accounts are never
reset on restart. Set `DEV_USERS_ENABLED=false` to disable seeding. Outside
development use a non-dev profile, a private JWT key, and HTTPS with
`AUTH_COOKIE_SECURE=true`; the non-dev default is secure cookies.

## Authentication flow

1. The browser retrieves a CSRF token from `GET /api/auth/csrf` and submits
   email/password as JSON to `POST /api/auth/login`, with `X-CSRF-TOKEN`.
2. The backend normalizes the email, loads the PostgreSQL user, verifies the
   BCrypt hash, and checks the account is enabled. Failed credentials share
   the same 401 error; password values are redacted from DTO logging.
3. The backend signs an HS256 JWT containing the user ID, role, session
   version, issuer, audience, and expiration. Default lifetime is one hour
   (`JWT_TTL=PT1H`); no refresh token is issued.
4. The JWT is set as `freshmart_access`, an HttpOnly, SameSite=Lax cookie
   scoped to `/api`. Production cookies also require HTTPS. JavaScript never
   receives the token and does not put credentials or JWTs in browser storage.
5. Redux stores only the returned user, expiry, loading state, and feedback.
   Backend roles are `ADMIN`/`CASHIER`; the frontend normalizes those verified
   values to lowercase for the existing route and menu structure.
6. On refresh, `GET /api/auth/me` restores Redux from the validated cookie.
   Session checks also run on navigation and when returning to the browser tab.
   Expiry clears the user and redirects to login with a session-ended message.
7. Every protected API request verifies the JWT signature/claims, then checks
   the database account, enabled flag, role, and session version. Frontend route
   guards provide friendly navigation; Spring Security enforces actual API access.
8. `POST /api/auth/logout` increments the user's session version, clears the
   JWT/CSRF cookies, and clears the frontend user/cart. This signs out **all
   existing sessions for that account**, including copied old tokens. If the
   server cannot be reached, the UI reports the failure instead of pretending
   the HttpOnly cookie was revoked.

Cookie-authenticated writes require CSRF validation, and credentialed CORS is
restricted to `FRONTEND_ORIGINS` (localhost ports 5173 and 4173 by default).
The implementation uses [Spring Security JWT support](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)
and [Spring Security CSRF protection](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html).

## Access and errors

| Endpoint | Access |
| --- | --- |
| `GET /api/auth/csrf` | Public; returns the CSRF token/header name |
| `POST /api/auth/login` | Public with valid CSRF token |
| `GET /api/auth/me` | Authenticated Admin or Cashier |
| `POST /api/auth/logout` | Authenticated, with CSRF token |
| `GET /api/admin/access` | ADMIN only; returns user details as an access check |
| `GET /api/cashier/access` | CASHIER only; returns user details as an access check |

The access endpoints contain no dashboard or business logic. Other API routes
are denied until a future task explicitly implements them.

Errors use `{ "code": "...", "message": "..." }`. Invalid credentials and
missing/expired/revoked tokens return 401; wrong roles and invalid CSRF return
403; malformed input returns 400. The login form shows failures inline,
disables duplicate submissions, and distinguishes network outages. Wrong-role
frontend navigation goes to `/unauthorized`, with a link to the user's own
dashboard. Admin cannot access cashier-only routes either.

Profile email, ID, and role are server-owned and read-only. Task 2's name/phone
editing remains explicitly labeled as a local preview, not an account update.
Employee directory edits also do not create accounts or change permissions.

## Verification

```powershell
cd backend
.\mvnw.cmd verify
```

The integration suite uses an isolated H2 database in PostgreSQL compatibility
mode and the real Flyway migration, BCrypt, JWT, security filters, and CSRF
handshake. It never deletes development PostgreSQL accounts. It covers both
roles, bad credentials, forged role input, invalid/expired tokens, logout
revocation, disabled/deleted/changed-role accounts, CORS, and malformed bodies.

```sh
cd frontend
npm test
npm run build
```

Frontend tests cover credential submission, server-owned roles, session restore,
invalid credentials, failed logout, stale request races, profile boundaries,
and unsupported roles. Browser checks additionally exercise the running
PostgreSQL-backed server, refresh, both logout controls, and mobile login.

Manual checks: sign in as each account; refresh to confirm persistence; visit
the other role's URL to see access denied; sign out and revisit a protected
URL; submit a wrong password; stop the backend to see the connection error.

## Files created or changed

Backend paths below are relative to `backend/`:

| Change | Files |
| --- | --- |
| Implemented existing placeholders | `src/main/java/com/freshmart/model/User.java`, `repository/UserRepository.java`, `service/AuthService.java`, `controller/AuthController.java` |
| Created models and DTOs | `model/Role.java`, `dto/LoginRequest.java`, `dto/UserResponse.java`, `dto/AuthResponse.java`, `dto/ApiError.java` (under `src/main/java/com/freshmart/`) |
| Created configuration | `config/AuthProperties.java`, `config/SecurityConfig.java`, `config/DevelopmentUserSeeder.java` |
| Created JWT support | `security/JwtService.java`, `security/JwtAuthenticationFilter.java`, `security/AuthCookies.java`, `security/AuthenticatedUser.java` |
| Created API support | `controller/AccessController.java`, `controller/ApiExceptionHandler.java` |
| Created migration | `src/main/resources/db/migration/V1__create_auth_users.sql` |
| Created tests | `src/test/java/com/freshmart/AuthIntegrationTest.java`, `src/test/resources/application-test.properties` |
| Created setup helper | `scripts/Initialize-AuthEnvironment.ps1` |
| Updated configuration | `pom.xml`, `.env.example`, `src/main/resources/application.properties`, `application-dev.properties` |
| Updated local secrets (untracked) | `.env`: generated JWT key and local PostgreSQL password |

Frontend paths below are relative to `frontend/`:

| Change | Files |
| --- | --- |
| Created | `src/components/AuthSession.jsx`, `src/hooks/useLogout.js`, `tests/auth.test.js` |
| Updated authentication | `src/services/api.js`, `src/services/authService.js`, `src/store/slices/authSlice.js`, `src/store/slices/cartSlice.js` |
| Updated UI integration | `src/App.jsx`, `src/pages/auth/Login.jsx`, `src/routes/AppRoutes.jsx`, `src/components/Header.jsx`, `Sidebar.jsx`, `Layout.jsx`, `ProfileView.jsx`, `src/index.css` |
| Updated configuration/docs | `package.json`, `.env.example`, `README.md` |

Repository docs: updated root `README.md` and `database/README.md`; created this
`docs/authentication.md`. Existing product/inventory/POS/sales backend
placeholders, business data, Vite configuration, and frontend `.env` are retained.
