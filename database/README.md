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

This task creates no application tables or seed data. The backend has automatic
schema creation and SQL initialization disabled. The files in `init/` are still
empty placeholders for future work.
