-- ============================================================================
--  Business & Personal Finance Manager — FULL DATABASE SETUP
--  Run this once on a fresh Supabase project (SQL Editor → paste → Run).
--  It is idempotent: safe to re-run.
-- ============================================================================

-- ── Helper: which owner accounts the current user may act as ────────────────
-- (themselves + any account they have been added to as a member)
CREATE TABLE IF NOT EXISTS account_members (
  owner_id  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (owner_id, member_id)
);
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see own memberships" ON account_members;
CREATE POLICY "see own memberships" ON account_members
  FOR SELECT USING (member_id = auth.uid() OR owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.acct_owner_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid()
  UNION
  SELECT owner_id FROM account_members WHERE member_id = auth.uid();
$$;

-- ── Companies ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255), phone VARCHAR(50), address TEXT, logo_url TEXT,
  kind VARCHAR NOT NULL DEFAULT 'general',   -- general | phone | keying | personal
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;
CREATE POLICY "companies_select" ON companies FOR SELECT USING (user_id IN (SELECT acct_owner_ids()));
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (user_id IN (SELECT acct_owner_ids()));
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (user_id IN (SELECT acct_owner_ids()));
CREATE POLICY "companies_delete" ON companies FOR DELETE USING (user_id IN (SELECT acct_owner_ids()));

-- Reusable helper expression: a company_id owned by an accessible account
-- (used verbatim in the policies below)

-- ── Contacts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, email VARCHAR(255), phone VARCHAR(50),
  contact_type VARCHAR(50) DEFAULT 'customer' CHECK (contact_type IN ('customer','vendor')),
  address TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_all" ON contacts;
CREATE POLICY "contacts_all" ON contacts FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));

-- ── Tags ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, category VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_all" ON tags;
CREATE POLICY "tags_all" ON tags FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));

-- ── Items (with cost + sell price) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, description TEXT,
  base_price DECIMAL(10,2) DEFAULT 0,   -- sell price
  cost_price DECIMAL(10,2),             -- purchase price
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_all" ON items;
CREATE POLICY "items_all" ON items FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));

-- ── Item customer pricing ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  custom_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, contact_id)
);
ALTER TABLE item_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_pricing_all" ON item_pricing;
CREATE POLICY "item_pricing_all" ON item_pricing FOR ALL
  USING (item_id IN (SELECT i.id FROM items i JOIN companies c ON c.id=i.company_id WHERE c.user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (item_id IN (SELECT i.id FROM items i JOIN companies c ON c.id=i.company_id WHERE c.user_id IN (SELECT acct_owner_ids())));

-- ── Business transactions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  amount DECIMAL(12,2) NOT NULL, type VARCHAR(50) CHECK (type IN ('income','expense')),
  description VARCHAR(500) NOT NULL, tags TEXT[] DEFAULT '{}', notes TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_all" ON transactions;
CREATE POLICY "transactions_all" ON transactions FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));

-- ── Invoices (with cost + From overrides) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  subtotal DECIMAL(12,2) DEFAULT 0, tax DECIMAL(12,2) DEFAULT 0, total DECIMAL(12,2) DEFAULT 0,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','sent','paid')),
  issue_date DATE DEFAULT CURRENT_DATE, due_date DATE, notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(50), next_recurring_date DATE,
  from_name VARCHAR, from_address TEXT, from_email VARCHAR, from_phone VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_all" ON invoices FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  description VARCHAR(500), quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0, line_total DECIMAL(12,2) DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0
);
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_items_all" ON invoice_items;
CREATE POLICY "invoice_items_all" ON invoice_items FOR ALL
  USING (invoice_id IN (SELECT inv.id FROM invoices inv JOIN companies c ON c.id=inv.company_id WHERE c.user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (invoice_id IN (SELECT inv.id FROM invoices inv JOIN companies c ON c.id=inv.company_id WHERE c.user_id IN (SELECT acct_owner_ids())));

-- ── Forms ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, description TEXT,
  is_published BOOLEAN DEFAULT FALSE, slug VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "forms_all" ON forms;
DROP POLICY IF EXISTS "forms_public_read" ON forms;
CREATE POLICY "forms_all" ON forms FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));
CREATE POLICY "forms_public_read" ON forms FOR SELECT USING (is_published = true);

CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL, type VARCHAR(50), required BOOLEAN DEFAULT FALSE,
  options TEXT[] DEFAULT '{}', field_order INT DEFAULT 0
);
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "form_fields_all" ON form_fields;
DROP POLICY IF EXISTS "form_fields_public_read" ON form_fields;
CREATE POLICY "form_fields_all" ON form_fields FOR ALL
  USING (form_id IN (SELECT f.id FROM forms f JOIN companies c ON c.id=f.company_id WHERE c.user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (form_id IN (SELECT f.id FROM forms f JOIN companies c ON c.id=f.company_id WHERE c.user_id IN (SELECT acct_owner_ids())));
CREATE POLICY "form_fields_public_read" ON form_fields FOR SELECT
  USING (form_id IN (SELECT id FROM forms WHERE is_published = true));

CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id), data JSONB,
  submitted_at TIMESTAMPTZ DEFAULT now(), created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "form_submissions_read" ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_public_insert" ON form_submissions;
CREATE POLICY "form_submissions_read" ON form_submissions FOR SELECT
  USING (form_id IN (SELECT f.id FROM forms f JOIN companies c ON c.id=f.company_id WHERE c.user_id IN (SELECT acct_owner_ids())));
CREATE POLICY "form_submissions_public_insert" ON form_submissions FOR INSERT
  WITH CHECK (form_id IN (SELECT id FROM forms WHERE is_published = true));

-- ── Personal finance ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL, amount DECIMAL(10,2) NOT NULL,
  type VARCHAR NOT NULL CHECK (type IN ('income','expense','donation')),
  category VARCHAR NOT NULL, tags TEXT[] DEFAULT '{}',
  description VARCHAR NOT NULL, notes TEXT, attachment_url VARCHAR,
  is_subscription BOOLEAN NOT NULL DEFAULT false,
  subscription_frequency VARCHAR CHECK (subscription_frequency IN ('weekly','monthly','quarterly','yearly')),
  subscription_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE personal_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "personal_transactions_all" ON personal_transactions;
CREATE POLICY "personal_transactions_all" ON personal_transactions FOR ALL
  USING (user_id IN (SELECT acct_owner_ids())) WITH CHECK (user_id IN (SELECT acct_owner_ids()));

CREATE TABLE IF NOT EXISTS personal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name VARCHAR NOT NULL, type VARCHAR NOT NULL DEFAULT 'all', color VARCHAR NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE personal_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "personal_categories_all" ON personal_categories;
CREATE POLICY "personal_categories_all" ON personal_categories FOR ALL
  USING (user_id IN (SELECT acct_owner_ids())) WITH CHECK (user_id IN (SELECT acct_owner_ids()));

-- ── Phone businesses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  device_name VARCHAR NOT NULL, imei VARCHAR, serial_number VARCHAR,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0, purchase_date DATE,
  seller VARCHAR, notes TEXT, status VARCHAR NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold')),
  sale_price DECIMAL(10,2), sale_date DATE, customer VARCHAR, sale_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phone_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  customer VARCHAR NOT NULL, service_type VARCHAR NOT NULL,
  cost_to_business DECIMAL(10,2) NOT NULL DEFAULT 0, price_charged DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_date DATE NOT NULL, notes TEXT,
  status VARCHAR NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phone_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  device_name VARCHAR NOT NULL, imei VARCHAR, customer VARCHAR NOT NULL,
  rental_start DATE NOT NULL, rental_end DATE,
  rental_amount DECIMAL(10,2) NOT NULL DEFAULT 0, deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT, status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','overdue')),
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Locksmith / Keying ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locksmith_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  project_name VARCHAR NOT NULL, customer VARCHAR NOT NULL, project_type VARCHAR NOT NULL,
  material_cost DECIMAL(10,2) DEFAULT 0, labor_cost DECIMAL(10,2) DEFAULT 0, invoice_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','quoted')),
  start_date DATE NOT NULL, end_date DATE, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS locksmith_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  item_name VARCHAR NOT NULL, category VARCHAR NOT NULL DEFAULT 'other',
  quantity INTEGER NOT NULL DEFAULT 0, unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS keying_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  lock_name VARCHAR NOT NULL, vendor VARCHAR, cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sold_price DECIMAL(10,2), status VARCHAR NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold')),
  customer VARCHAR, purchase_date DATE, sale_date DATE, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS keying_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  description VARCHAR NOT NULL, vendor VARCHAR, amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  expense_date DATE, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS keying_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  name VARCHAR NOT NULL, size VARCHAR, quantity INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR DEFAULT 'pcs', low_threshold INTEGER DEFAULT 0, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS keying_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
  brand VARCHAR NOT NULL, cylinder_type VARCHAR, price_per_key DECIMAL(10,2) DEFAULT 0,
  UNIQUE(company_id, brand, cylinder_type)
);

-- company-scoped RLS (ALL) for the business tables above
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['phone_inventory','phone_services','phone_rentals',
    'locksmith_projects','locksmith_inventory','keying_locks','keying_expenses',
    'keying_inventory','keying_prices']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t||'_all', t);
    EXECUTE format($f$CREATE POLICY %I ON %I FOR ALL
      USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
      WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));$f$, t||'_all', t);
  END LOOP;
END $$;

-- ── Keying orders (public submissions allowed) ──────────────────────────────
CREATE TABLE IF NOT EXISTS keying_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies ON DELETE CASCADE,
  order_number VARCHAR NOT NULL, status VARCHAR NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','complete','cancelled')),
  company_name VARCHAR NOT NULL, contact_name VARCHAR NOT NULL,
  email VARCHAR, phone VARCHAR, address VARCHAR, customer_ref VARCHAR, needed_by DATE,
  notes TEXT, brands_json JSONB DEFAULT '[]', total DECIMAL(10,2) DEFAULT 0,
  cut_keys BOOLEAN NOT NULL DEFAULT false, lock_count INTEGER DEFAULT 0, price_per_lock DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE keying_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "keying_orders_insert" ON keying_orders;
DROP POLICY IF EXISTS "keying_orders_read" ON keying_orders;
DROP POLICY IF EXISTS "keying_orders_update" ON keying_orders;
DROP POLICY IF EXISTS "keying_orders_delete" ON keying_orders;
CREATE POLICY "keying_orders_insert" ON keying_orders FOR INSERT
  WITH CHECK (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));
CREATE POLICY "keying_orders_read" ON keying_orders FOR SELECT
  USING ((company_id IS NULL AND EXISTS (SELECT 1 FROM companies WHERE user_id IN (SELECT acct_owner_ids()) AND kind='keying'))
         OR company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));
CREATE POLICY "keying_orders_update" ON keying_orders FOR UPDATE
  USING ((company_id IS NULL AND EXISTS (SELECT 1 FROM companies WHERE user_id IN (SELECT acct_owner_ids()) AND kind='keying'))
         OR company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));
CREATE POLICY "keying_orders_delete" ON keying_orders FOR DELETE
  USING ((company_id IS NULL AND EXISTS (SELECT 1 FROM companies WHERE user_id IN (SELECT acct_owner_ids()) AND kind='keying'))
         OR company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));

-- ── Public function: keying brand (name + logo) for the /keying form ────────
CREATE OR REPLACE FUNCTION public.get_keying_brand()
RETURNS TABLE(name text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT name, logo_url FROM companies WHERE kind = 'keying' ORDER BY created_at LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_keying_brand() TO anon, authenticated;

-- ── Storage bucket for company logos ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos','company-logos', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
DROP POLICY IF EXISTS "logos authenticated write" ON storage.objects;
CREATE POLICY "logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');
CREATE POLICY "logos authenticated write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-logos');

-- ── Bills: invoices you receive (vendor bills) + their uploaded files ─────────
CREATE TABLE IF NOT EXISTS public.received_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  paid boolean NOT NULL DEFAULT false,
  file_path text,
  file_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.received_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "received_invoices_all" ON public.received_invoices;
CREATE POLICY "received_invoices_all" ON public.received_invoices FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT acct_owner_ids())));

-- ── Private bucket for uploaded documents (bills, etc.) ──────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents','documents', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "documents read" ON storage.objects;
DROP POLICY IF EXISTS "documents write" ON storage.objects;
DROP POLICY IF EXISTS "documents delete" ON storage.objects;
CREATE POLICY "documents read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "documents write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "documents delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');

-- ── Done. Then in Supabase: Authentication → Providers → Email → turn OFF
--    "Allow new users to sign up" so the app is invite-only.
-- ============================================================================
