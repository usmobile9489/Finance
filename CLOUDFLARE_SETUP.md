# Deploy on Cloudflare Pages + Supabase (fresh accounts)

This runs the dashboard on **Cloudflare Pages** with **Supabase** as the database.
No rewrite — same app, different host. Works with brand-new GitHub + Supabase accounts.

---

## Part 1 — Database (new Supabase account)
1. Sign up at https://supabase.com → **New project**. Pick a region + a strong DB password.
2. **SQL Editor → New query** → paste all of **`setup.sql`** → **Run**. (Builds every table + security rule.)
3. **Authentication → Providers → Email** → turn **OFF** "Allow new users to sign up" (invite-only).
4. **Authentication → Users → Add user** → your email + password, tick "Auto confirm". This is your admin login.
5. **Create the Keying + Phones companies:** open **`seed-companies.sql`**, replace
   `YOUR_ADMIN_EMAIL@example.com` with the email from step 4, and Run it in the SQL Editor.
6. **Project Settings → API** → copy these (you'll paste them into Cloudflare):
   - **Project URL**            → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key**        → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

---

## Part 2 — Code (new GitHub account)
1. Create an empty repo on the new GitHub account (e.g. `finance`).
2. Push this project's files to it:
   ```bash
   git init
   git add .
   git commit -m "Finance dashboard"
   git branch -M main
   git remote add origin https://github.com/NEW_ACCOUNT/finance.git
   git push -u origin main
   ```

---

## Part 3 — Host on Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. **Build settings:**
   - Framework preset: **Next.js**
   - Build command: `npx @cloudflare/next-on-pages@1`
   - Build output directory: `.vercel/output/static`
3. **Settings → Functions → Compatibility flags:** add **`nodejs_compat`** (for both Production and Preview).
   Set **Compatibility date** to today's date.
4. **Settings → Environment variables** (Production *and* Preview) — add:
   ```
   NEXT_PUBLIC_SUPABASE_URL          = <your Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY     = <your anon public key>
   SUPABASE_SERVICE_ROLE_KEY         = <your service_role key>
   ```
5. **Save and Deploy.** Cloudflare gives you a `https://<project>.pages.dev` URL. Add your own
   domain later under **Custom domains** if you want.

---

## Part 4 — First login
- Go to `https://<project>.pages.dev/auth/login` and sign in with the admin user from Part 1, step 4.
- You should see the **Phones** and **SyncKey** companies in the sidebar.

---

## Notes & gotchas
- The dashboard's few server routes (`/api/...`) need the **`nodejs_compat`** flag (Part 3, step 3).
  If a server action errors, double-check that flag is set on both environments.
- The **service_role key is secret** — it lives only in Cloudflare's env vars (server side), never in the browser.
- Your data lives entirely in **your** Supabase project. Back it up from the app
  (Settings → Download full backup) or with `pg_dump`.
- If the very first Cloudflare build fails on the adapter, run `npm install` once locally and
  commit the updated `package-lock.json`, then redeploy.
