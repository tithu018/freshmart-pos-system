# Local PostgreSQL setup

Install and start PostgreSQL (version 17 is used for local verification).
The backend expects a database named `freshmart_pos` and a login role named
`freshmart`. You can use another database or role by editing `backend/.env`.

For a new local database, connect as your PostgreSQL administrator:

```sh
psql -U postgres -d postgres
```

Run these commands in `psql` once, if the role and database do not already exist:

```sql
CREATE ROLE freshmart LOGIN;
\password freshmart
CREATE DATABASE freshmart_pos OWNER freshmart;
\q
```

The `\password` command prompts for a password. Put that same password in
`DB_PASSWORD` in `backend/.env`. Do not add surrounding quotes; the backend
loads this file as Java properties, so literal backslashes must be doubled.
You can also supply credentials as operating system environment variables.

Verify the connection:

```sh
psql -h localhost -p 5432 -U freshmart -d freshmart_pos -W -c "SELECT current_database();"
```

Task 3 uses Flyway to create `app_users` and `flyway_schema_history` on backend
startup. The migration lives in `backend/src/main/resources/db/migration/`.
Hibernate validates the schema and does not recreate it. The dev profile adds
missing Admin and Cashier accounts using BCrypt hashes. See
[authentication setup](../docs/authentication.md) for credentials and testing.
Task 4 adds `categories` and `products` through `V2__create_catalog.sql`, including
unique SKU/barcode/category-name constraints and a restrictive category foreign key.
The catalog starts empty. Existing user records and migration V1 are preserved.
Task 5 adds `inventory` (one balance per product) and `stock_movements` through V3.
Existing products receive zero stock and a minimum threshold of 10. See
[inventory setup and consistency](../docs/inventory.md). No POS or sales tables are created. The files in `init/`
remain placeholders; do not run them as a second initialization mechanism.
