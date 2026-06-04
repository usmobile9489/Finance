-- Finance Platform Database Schema

-- Enable RLS
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own companies" ON companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own companies" ON companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own companies" ON companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own companies" ON companies FOR DELETE USING (auth.uid() = user_id);

-- Contacts Table  
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  contact_type VARCHAR(50) CHECK (contact_type IN ('customer', 'vendor')),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view contacts from their companies" ON contacts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = contacts.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert contacts to their companies" ON contacts FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = contacts.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update contacts from their companies" ON contacts FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = contacts.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete contacts from their companies" ON contacts FOR DELETE 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = contacts.company_id AND companies.user_id = auth.uid()));

-- Tags Table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) CHECK (category IN ('item', 'transaction')),
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tags from their companies" ON tags FOR SELECT 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = tags.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert tags to their companies" ON tags FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = tags.company_id AND companies.user_id = auth.uid()));

-- Items Table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view items from their companies" ON items FOR SELECT
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = items.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert items to their companies" ON items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = items.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update items from their companies" ON items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = items.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete items from their companies" ON items FOR DELETE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = items.company_id AND companies.user_id = auth.uid()));

-- Item Pricing Table (customer-specific pricing)
CREATE TABLE IF NOT EXISTS item_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  custom_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE item_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view pricing from their companies" ON item_pricing FOR SELECT 
  USING (EXISTS (SELECT 1 FROM items 
    JOIN companies ON companies.id = items.company_id 
    WHERE items.id = item_pricing.item_id AND companies.user_id = auth.uid()));

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  amount DECIMAL(12,2) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('income', 'expense')),
  description VARCHAR(500) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view transactions from their companies" ON transactions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = transactions.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert transactions to their companies" ON transactions FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = transactions.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update transactions from their companies" ON transactions FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = transactions.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete transactions from their companies" ON transactions FOR DELETE 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = transactions.company_id AND companies.user_id = auth.uid()));

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  subtotal DECIMAL(12,2),
  tax DECIMAL(12,2),
  total DECIMAL(12,2),
  status VARCHAR(50) CHECK (status IN ('draft', 'pending_approval', 'sent', 'paid')),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(50) CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_recurring_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view invoices from their companies" ON invoices FOR SELECT 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = invoices.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can manage invoices from their companies" ON invoices FOR INSERT, UPDATE, DELETE 
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = invoices.company_id AND companies.user_id = auth.uid()));

-- Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  description VARCHAR(500),
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2),
  line_total DECIMAL(12,2)
);
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage invoice_items from their companies" ON invoice_items FOR ALL
  USING (EXISTS (SELECT 1 FROM invoices JOIN companies ON companies.id = invoices.company_id
    WHERE invoices.id = invoice_items.invoice_id AND companies.user_id = auth.uid()));

-- Forms Table
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view forms from their companies" ON forms FOR SELECT
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = forms.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert forms to their companies" ON forms FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = forms.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update forms from their companies" ON forms FOR UPDATE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = forms.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete forms from their companies" ON forms FOR DELETE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = forms.company_id AND companies.user_id = auth.uid()));

-- Form Fields Table
CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('text', 'email', 'number', 'textarea', 'select', 'checkbox', 'file')),
  required BOOLEAN DEFAULT FALSE,
  options TEXT[] DEFAULT '{}',
  field_order INT
);
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage form_fields from their companies" ON form_fields FOR ALL
  USING (EXISTS (SELECT 1 FROM forms JOIN companies ON companies.id = forms.company_id
    WHERE forms.id = form_fields.form_id AND companies.user_id = auth.uid()));

-- Form Submissions Table
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  data JSONB,
  submitted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view submissions from their companies" ON form_submissions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM forms 
    JOIN companies ON companies.id = forms.company_id 
    WHERE forms.id = form_submissions.form_id AND companies.user_id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_items_company_id ON items(company_id);
CREATE INDEX idx_transactions_company_id ON transactions(company_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_forms_company_id ON forms(company_id);
