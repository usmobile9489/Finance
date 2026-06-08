-- ============================================================================
--  Seed the Keying + Phones companies
--  Run this AFTER you have (1) run setup.sql and (2) created your admin login
--  (Supabase → Authentication → Users → Add user).
--
--  Replace YOUR_ADMIN_EMAIL with the email you signed up with, then Run.
-- ============================================================================
WITH me AS (
  SELECT id FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL@example.com' LIMIT 1
)
INSERT INTO companies (user_id, name, kind)
SELECT me.id, v.name, v.kind
FROM me, (VALUES
  ('Phones', 'phone'),     -- phone buy/sell, service, rental
  ('SyncKey', 'keying')    -- keying / locksmith
) AS v(name, kind)
WHERE NOT EXISTS (
  SELECT 1 FROM companies c WHERE c.user_id = me.id AND c.name = v.name
)
RETURNING name, kind;
