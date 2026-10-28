# Task 11: Docker and GitHub Actions

The existing React UI and business APIs are unchanged. Nginx serves the production
bundle and forwards `/api/` to Java 17 Spring Boot; PostgreSQL 17 stores data in a
named volume. Flyway applies the existing migrations at backend startup.

## Start on Windows

Install/start Docker Desktop with Linux containers. Use Docker Compose 2.20.3 or
newer (the root file includes the configuration in `devops/docker/`). From the
repository root in PowerShell:

```powershell
# Once: generates a root .env with random database/JWT/initial account secrets.
# Existing files are never overwritten.
.\devops\docker\Initialize-DockerEnvironment.ps1

# Subsequent starts use this one command:
docker compose up --build -d
docker compose ps
```

Wait for all three services to be healthy, then open <http://localhost:3000>.
The first build downloads dependencies and runs both test suites; it can take
several minutes. Docker builds need internet access and enough memory for Node
and Maven. Native Java/Node/PostgreSQL installations are not needed to run Docker.

Open the root `.env` privately in your editor. Log in as `admin@freshmart.com`
using `BOOTSTRAP_ADMIN_PASSWORD`, or `cashier@freshmart.com` using
`BOOTSTRAP_CASHIER_PASSWORD`. These are generated credentials, not the native
development passwords. Once accounts exist, set `BOOTSTRAP_USERS_ENABLED=false`
and run `docker compose up -d` again. Credentials are hashed by the existing
password encoder. Restarting never resets existing users or passwords; changing
bootstrap values is not an account password-reset mechanism.

For manual setup or macOS/Linux, copy `.env.example` to `.env`, supply a unique
database password, a base64 JWT key from at least 32 random bytes, and two initial
account passwords (12 characters minimum, 72 UTF-8 bytes maximum). For example,
`openssl rand -base64 48` generates one value; run it separately for each secret.
Do not commit or share the resulting file. No root `.env` is included in Git.

## Configuration and security

- Root `.env` is for Compose. Existing `backend/.env`, `frontend/.env` and the
  native PostgreSQL database remain independent; Docker does not import them.
- `DB_NAME=freshmart_pos` and `DB_USERNAME=freshmart` retain the existing defaults.
  Docker connects to hostname `postgres` on port 5432, not the host database.
- `FRONTEND_PORT` defaults to 3000. If changed, update `FRONTEND_ORIGINS` to match
  the complete origin, including port. Only the frontend publishes a host port.
- Local HTTP uses `AUTH_COOKIE_SECURE=false` and binds to loopback by default.
  Before external use, configure HTTPS at a trusted reverse proxy, set
  `AUTH_COOKIE_SECURE=true`, and set `FRONTEND_ORIGINS` to the public HTTPS origin.
  This task does not provision TLS certificates, a cloud host or Kubernetes.
- JWT and CSRF cookies retain their existing HttpOnly, SameSite and `/api` path
  settings. Nginx passes cookies and CSRF headers without rewriting them. No
  signing key, password or token is embedded in the frontend build.
- The frontend image always uses the public relative API base `/api`; serving
  both UI and API from one origin avoids cross-site cookie problems. Backend
  configuration is injected at runtime, including tax rate and store timezone.
- Images run the application as non-root users. Compose drops their capabilities,
  uses read-only root filesystems and bounded writable temporary directories,
  bounded rotated logs, and no-new-privileges. PostgreSQL is on a private network and has no
  published host port. App images contain runtime files, not build dependencies.
- The backend image defaults to `prod`. Compose explicitly enables the optional
  `bootstrap` profile, which has no default account passwords and is disabled
  unless requested. The native `dev` profile keeps its previous behavior.
- PostgreSQL readiness gates the backend; backend HTTP readiness gates Nginx.
  `/health` checks Nginx, and `/api/auth/csrf` checks backend HTTP availability.
  These are readiness checks, not ongoing database-query health probes.
- Base images follow their Java/Node/PostgreSQL major-version tags and receive
  updates on pull. Use `docker compose build --pull` when refreshing them. Pin
  reviewed image digests if your release process requires immutable base images.
- Environment variables are visible to local Docker administrators. Protect
  Docker access and the `.env` file; do not paste resolved Compose configuration,
  container environment dumps, or authentication headers into shared logs.

## Stop, restart and preserve data

```powershell
docker compose logs --tail 80 backend
docker compose down
docker compose up -d
```

`down` removes containers/networks but preserves the project's `postgres_data`
volume. `down --volumes` destroys that project's database: use it only for
explicitly disposable test projects. Keep `COMPOSE_PROJECT_NAME` stable to keep
using the same volume. Changing `DB_PASSWORD` after initialization does not
change PostgreSQL's stored role password; perform a coordinated password change.
Back up valuable databases with PostgreSQL tooling before maintenance/upgrades.

## Isolated integration checks

Python 3 is needed only for the optional smoke test. It refuses a database name
that does not end with `_test`; always use a separate Compose project as below.
The test creates its own category/product and two simulated sales.

```powershell
$testEnv = Join-Path $env:TEMP 'freshmart-docker-test.env'
$testState = Join-Path $env:TEMP 'freshmart-docker-test.json'
.\devops\docker\Initialize-DockerEnvironment.ps1 -Path $testEnv -Port 3001 -DatabaseName freshmart_docker_test -ProjectName freshmart-test
docker compose --env-file $testEnv up --build -d --wait --wait-timeout 180
python devops/docker/smoke.py --env-file $testEnv --state-file $testState
docker compose --env-file $testEnv down
docker compose --env-file $testEnv up -d --wait --wait-timeout 180
python devops/docker/smoke.py --env-file $testEnv --state-file $testState --verify-existing
docker compose --env-file $testEnv down
```

Use a new environment filename/project name for a fresh test run. The smoke test
covers Admin/Cashier login, JWT cookies/session restoration, anonymous/CSRF/role
rejections, product creation, inventory stock-in, Cash/Card checkout, financial
totals, idempotent retries and persistence after all containers are recreated.

Native regression commands remain `npm test` and `npm run build` in `frontend/`,
and `./mvnw.cmd verify` (Windows) or `sh ./mvnw verify` in `backend/` with Java 17.
Docker builds also run those suites; Maven tests use isolated in-memory databases.
The existing [PostgreSQL suite](testing.md) remains available.

## CI/CD

`.github/workflows/deploy.yml` runs on every push and pull request, or manually.
It calls the separate reusable frontend and backend workflows, which can also
be dispatched independently. Frontend uses Node 22, `npm ci`, tests and the
production build; backend uses Java 17 and Maven `verify`. Both upload build
artifacts; backend also uploads JUnit reports.

After both pass, CI builds/starts Compose with freshly generated temporary
credentials, runs the smoke test, disables initial account provisioning,
recreates containers, and verifies persistence and existing account login.
Only then does the image job build both images. Pushes to `main` publish to:

- `ghcr.io/<owner>/<repository>-frontend`
- `ghcr.io/<owner>/<repository>-backend`

Tags are `latest` and `sha-<full commit SHA>`. PRs and other branches build but
never publish. Actions are pinned to commit SHAs; only the image job receives
`packages: write`, and registry login uses GitHub's short-lived `GITHUB_TOKEN`.
No repository database/JWT secrets are required. Enable GitHub Actions and allow
package creation under the repository/organization settings. Existing packages
may require granting the repository Actions access to them.

This publishes images, not a deployment to a live server. Hosted execution and
GHCR upload can only be confirmed after the workflow is pushed and run on GitHub.

References: [Compose include](https://docs.docker.com/compose/how-tos/multiple-compose-files/include/)
and [GitHub container publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Verification results (2026-10-28)

- Docker Engine 29.9.2 / Compose 5.6.1: both images built and all three services
  became healthy. Java runtime reports version 17. Non-root users, read-only app
  filesystems, private database networking and log rotation were inspected.
- Backend: **69 passed, 0 failed, 0 errors, 0 skipped**; Maven `verify` and JAR
  packaging succeeded natively and inside the Linux Docker build.
- Frontend: **78 passed, 0 failed** (60 Node tests and 18 React component tests);
  production builds succeeded natively and inside Docker. An initial Windows
  test-worker timeout during concurrent builds cleared on rerun after load fell.
- Six Flyway migrations applied to the isolated PostgreSQL database. Admin and
  Cashier login, CSRF rejection, role restrictions, Cash/Card checkout and
  duplicate prevention passed through Nginx. SQL confirmed two sales totaling
  8.00 and stock 6 from an initial 10.
- All containers were removed and recreated using the same named volume, with
  bootstrap provisioning disabled. Both accounts, both sales and stock 6
  persisted. Root `.env` auto-loading and the exact
  `docker compose up --build -d` command were also exercised.
- Playwright browser checks passed for both logins, deep-link reload/session
  restoration, Cashier access denial, checkout, receipt rendering, stock updates
  and mobile layout. All API requests stayed on the frontend origin; no page
  JavaScript errors occurred. The extra browser sale left SQL totals at three
  sales, subtotal 12.50, discount 2.00, tax 0.00, total 10.50 and stock 5.
- Generated secrets were absent from container logs, the frontend bundle and
  image configuration. Empty required secrets are rejected; environment setup
  preserves existing files. A temporary-mount quoting issue found during the
  initial startup was corrected and the full startup/persistence checks passed.
- GitHub workflows passed `actionlint`; Compose configuration passed validation.
  Hosted workflow execution and actual GHCR publication remain unverified until
  these changes are pushed to GitHub. No known local application issues remain.

Testing used only the separate `freshmart-task11` Compose project and
`freshmart_docker_test` database. Native user data was not modified. Test
containers were stopped afterward; the isolated test volume is retained.

## Changed files

- `docker-compose.yml`
- `.env.example`
- `devops/docker/docker-compose.yml`
- `devops/docker/Initialize-DockerEnvironment.ps1`
- `devops/docker/smoke.py`
- `backend/Dockerfile`
- `backend/.dockerignore`
- `backend/src/main/resources/application-bootstrap.properties`
- `backend/src/main/java/com/freshmart/config/DevelopmentUserSeeder.java`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/nginx.conf`
- `.github/workflows/frontend-ci.yml`
- `.github/workflows/backend-ci.yml`
- `.github/workflows/deploy.yml`
- `README.md`
- `docs/docker.md`

Task 12, AWS and Kubernetes deployment remain outside this task.
