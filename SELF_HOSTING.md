# Self-Hosting Guide — Business & Personal Finance Manager

This app is a **Next.js** website backed by **Supabase** (database + login + file
storage). To run your own private copy you need two things:

1. A **database** (Supabase) — holds all your data.
2. A **server** to run the Next.js app.

You can mix and match: easiest is **Supabase Cloud (free tier) + any Node server**.
Fully private/offline is **self-hosted Supabase (Docker) + your own server**.

---

## Part 1 — The Database (pick ONE)

### Option A — Supabase Cloud (easiest, free to start)
1. Go to https://supabase.com → create a project. Note the project's **region** and **database password**.
2. Open **SQL Editor** → **New query** → paste the entire contents of **`setup.sql`** (included in this zip) → **Run**.
   - This creates every table, security rule, and function the app needs.
3. Go to **Project Settings → API** and copy:
   - **Project URL**  → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (keep secret!) → `SUPABASE_SERVICE_ROLE_KEY`
4. **Authentication → Providers → Email** → turn **OFF** "Allow new users to sign up"
   (the app is invite-only; you create users from Settings).
5. Create your first login: **Authentication → Users → Add user** (email + password, mark email confirmed).

### Option B — Self-hosted Supabase (fully private, via Docker)
On a server with Docker installed:
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env          # then EDIT .env: set POSTGRES_PASSWORD, JWT_SECRET,
                              # ANON_KEY, SERVICE_ROLE_KEY, SITE_URL, etc.
docker compose up -d
```
- Open Supabase Studio (default `http://your-server:8000`) → **SQL Editor** → run **`setup.sql`**.
- Your URL/keys are the values you set in that `.env` (ANON_KEY, SERVICE_ROLE_KEY) and
  the API URL (e.g. `http://your-server:8000`).
- Full docs: https://supabase.com/docs/guides/self-hosting/docker

> Plain PostgreSQL alone is **not** enough — the app relies on Supabase for login,
> file storage and row-level security. Use Supabase (cloud or Docker), not bare Postgres.

---

## Part 2 — The App Server

### Prerequisites
- **Node.js 18+** (20 recommended) and **npm**.

### Configure
In the project folder create a file named **`.env.local`**:
```
NEXT_PUBLIC_SUPABASE_URL=<your project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
```
(The first two are safe in the browser. **`SUPABASE_SERVICE_ROLE_KEY` is secret** —
it stays on the server and powers the "create login" feature. Never expose it.)

### Run it
```bash
npm install          # install dependencies (downloads node_modules)
npm run build        # production build
npm run start        # starts on http://localhost:3000
```

### Keep it running (a real server)
Use a process manager so it restarts on reboot/crash:
```bash
npm install -g pm2
pm2 start "npm run start" --name finance
pm2 save && pm2 startup
```
Then put **Nginx** (or Caddy) in front for HTTPS + your domain. Minimal Nginx:
```
server {
  server_name finance.yourdomain.com;
  location / { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
}
```
Run `certbot --nginx` for a free SSL certificate.

### Or run with Docker
```bash
docker build -t finance .          # (add a standard Next.js Dockerfile)
docker run -p 3000:3000 --env-file .env.local finance
```

---

## Part 3 — First login & checklist
- [ ] `setup.sql` ran with no errors
- [ ] `.env.local` has all three keys
- [ ] `npm run build` succeeded
- [ ] App reachable in the browser
- [ ] Created your admin user in Supabase → can log in at `/auth/login`
- [ ] Email signup turned OFF in Supabase
- [ ] (Optional) Upload a company logo in Settings — appears on invoices & the keying form

---

## Notes
- **Data location:** everything lives in your Supabase database. Moving servers later
  only means pointing a new app server at the same Supabase, or restoring a DB backup.
- **Exact mirror of the current data:** if you want to copy the *existing* live database
  exactly (not just the structure), use the Supabase connection string with:
  ```bash
  pg_dump "postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres" \
    --schema=public --no-owner --no-privileges > full_dump.sql
  ```
  and restore it into the new database with `psql`.
- **Backups:** Supabase Cloud does daily backups on paid plans; for self-hosted, schedule
  `pg_dump` on a cron.
