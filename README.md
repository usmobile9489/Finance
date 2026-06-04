# Finance Management Platform

A comprehensive multi-company financial management system built with Next.js, Supabase, and Tailwind CSS.

## 🎯 Features

### 💳 Personal Finance Dashboard (`/dashboard`)
- Add income & expense transactions
- Tag transactions for organization
- View balance and summary statistics
- Recent transactions overview
- Filter by tags
- Track spending by category

### 🏢 Business Dashboard (`/admin`)
- **Multi-Company Management**: Manage multiple financial companies
- **Company Switcher**: Easy navigation between companies  
- **Dashboard Overview**: View company statistics and key metrics
- **Company Logos**: Upload and display company logos

### 💰 Financial Tracking
- **Transactions**: Record income and expense transactions
- **Tags**: Organize transactions with custom tags
- **Notes**: Add detailed notes to transactions
- **Analytics**: View total income, expenses, and profit/loss per company
- **Contact Management**: Manage customers and vendors

### 📄 Professional Invoicing
- **Invoice Creation**: Create and manage invoices
- **Logo Integration**: Display company logos on invoices
- **Recurring Invoices**: Set up recurring invoices with custom frequencies
- **Approval Workflow**: Require approval before sending invoices
- **Invoice Status**: Track draft, pending approval, sent, and paid status
- **Customizable Templates**: Multiple invoice templates available

### 👥 Contacts Management
- **Customers & Vendors**: Maintain separate contact lists
- **Contact Details**: Store email, phone, address, and notes
- **Customer-Specific Pricing**: Set custom prices per customer

### 📦 Item Management
- **Item Catalog**: Create and manage items/services
- **Base Pricing**: Set standard prices (can be overridden per customer)
- **Tags**: Organize items with custom tags
- **Customer-Specific Pricing**: Apply different prices for different customers

### 📋 Custom Forms
- **Form Builder**: Create custom forms for your business
- **Form Fields**: Support text, email, number, textarea, select, checkbox, and file upload
- **Form Submissions**: Collect and view form submissions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account ([Create one free](https://supabase.com))

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Get your project credentials:
   - Go to **Project Settings** → **API**
   - Copy `Project URL` and `anon public key`

### 3. Configure Environment Variables

Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Execute Database Schema

1. Open `database-schema.sql` in this project
2. Go to Supabase Dashboard → **SQL Editor**
3. Click **Create new query**
4. Copy and paste the entire contents of `database-schema.sql`
5. Click **Run**

This creates all necessary tables with Row Level Security (RLS) policies for secure multi-tenant operation.

### 5. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── app/
│   ├── page.tsx            # Landing page
│   ├── layout.tsx          # Root layout
│   ├── dashboard/          # Personal finance dashboard
│   ├── admin/              # Business dashboard
│   │   ├── page.tsx        # Admin home
│   │   ├── invoices/       # Invoice management
│   │   ├── transactions/   # Transaction tracking
│   │   ├── contacts/       # Customer/vendor management
│   │   ├── items/          # Product/service catalog
│   │   └── forms/          # Custom forms
│   └── auth/               # Authentication
│       ├── login/          # Login page
│       └── signup/         # Sign up page
├── components/             # Reusable React components
├── lib/
│   ├── supabase.ts        # Supabase client configuration
│   └── api.ts             # API functions for database operations
├── types/
│   └── database.ts        # TypeScript type definitions
└── public/                # Static assets
```

## 🔐 Security Features

- **Row Level Security (RLS)**: All tables use RLS policies to ensure users can only access their own data
- **Multi-tenant Isolation**: Company-based data isolation with company_id foreign keys
- **Authentication**: Supabase Auth integration for secure user management
- **Environment Variables**: Sensitive credentials stored securely in `.env.local`

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with React 19 and TypeScript
- **Styling**: Tailwind CSS with responsive design
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel (recommended)

## 📧 Database Schema

The database includes the following tables:
- `companies` - Financial company information
- `contacts` - Customers and vendors
- `tags` - Custom tags for organization
- `items` - Products/services with pricing
- `item_pricing` - Customer-specific pricing
- `transactions` - Income and expense records
- `invoices` - Invoice records
- `invoice_items` - Line items in invoices
- `forms` - Custom form templates
- `form_fields` - Fields within forms
- `form_submissions` - Form submission responses
- Plus audit logs and support tables

All tables include RLS policies for secure access control.

## 🚢 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and connect your repository
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## 📝 License

MIT
- **Shareable Links**: Generate public URLs for customers to fill out forms

### 📊 Analytics & Reports
- **Dashboard**: Overview of financial metrics per company
- **Aggregate Analytics**: View combined totals across all companies
- **Financial Summary**: Income, expenses, and profit/loss calculations

## Tech Stack

- **Frontend**: Next.js 14+ with TypeScript
- **UI Framework**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Hosting**: Vercel

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd finance-platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**
   - Create a new Supabase project at https://supabase.com
   - Copy your project URL and API key
   - Create a `.env.local` file in the root directory:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up database schema**
   - Run the SQL migrations in Supabase:
     ```sql
     -- Create companies table
     CREATE TABLE companies (
       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
       name VARCHAR NOT NULL,
       email VARCHAR NOT NULL,
       phone VARCHAR,
       address VARCHAR,
       logo_url VARCHAR,
       user_id UUID NOT NULL REFERENCES auth.users,
       created_at TIMESTAMP DEFAULT now(),
       updated_at TIMESTAMP DEFAULT now()
     );

     -- Create contacts table
     CREATE TABLE contacts (
       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
       company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
       name VARCHAR NOT NULL,
       email VARCHAR NOT NULL,
       phone VARCHAR,
       contact_type VARCHAR NOT NULL CHECK (contact_type IN ('customer', 'vendor')),
       address VARCHAR,
       notes TEXT,
       created_at TIMESTAMP DEFAULT now(),
       updated_at TIMESTAMP DEFAULT now()
     );

     -- Create transactions table
     CREATE TABLE transactions (
       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
       company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
       contact_id UUID REFERENCES contacts,
       amount DECIMAL(10, 2) NOT NULL,
       type VARCHAR NOT NULL CHECK (type IN ('income', 'expense')),
       description VARCHAR NOT NULL,
       tags TEXT[] DEFAULT '{}',
       notes TEXT,
       transaction_date DATE NOT NULL,
       created_at TIMESTAMP DEFAULT now(),
       updated_at TIMESTAMP DEFAULT now()
     );

     -- Create items table
     CREATE TABLE items (
       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
       company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
       name VARCHAR NOT NULL,
       description TEXT,
       base_price DECIMAL(10, 2) NOT NULL,
       tags TEXT[] DEFAULT '{}',
       created_at TIMESTAMP DEFAULT now(),
       updated_at TIMESTAMP DEFAULT now()
     );

     -- Create invoices table
     CREATE TABLE invoices (
       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
       company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
       invoice_number VARCHAR NOT NULL UNIQUE,
       contact_id UUID NOT NULL REFERENCES contacts,
       items JSONB DEFAULT '[]'::jsonb,
       subtotal DECIMAL(10, 2) NOT NULL,
       tax DECIMAL(10, 2) DEFAULT 0,
       total DECIMAL(10, 2) NOT NULL,
       status VARCHAR DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'sent', 'paid')),
       issue_date DATE NOT NULL,
       due_date DATE NOT NULL,
       notes TEXT,
       is_recurring BOOLEAN DEFAULT false,
       recurring_frequency VARCHAR CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
       next_recurring_date DATE,
       created_at TIMESTAMP DEFAULT now(),
       updated_at TIMESTAMP DEFAULT now()
     );

     -- Create forms table
     CREATE TABLE forms (
       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
       company_id UUID NOT NULL REFERENCES companies ON DELETE CASCADE,
       name VARCHAR NOT NULL,
       description TEXT,
       fields JSONB DEFAULT '[]'::jsonb,
       created_at TIMESTAMP DEFAULT now(),
       updated_at TIMESTAMP DEFAULT now()
     );

     -- Create form submissions table
     CREATE TABLE form_submissions (
       id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
       form_id UUID NOT NULL REFERENCES forms ON DELETE CASCADE,
       contact_id UUID REFERENCES contacts,
       data JSONB DEFAULT '{}',
       submitted_at TIMESTAMP DEFAULT now(),
       created_at TIMESTAMP DEFAULT now()
     );

     -- Storage bucket for company logos
     INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);
     ```

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Deployment to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Click "Import Project" and select your GitHub repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click "Deploy"

3. **Custom Domain**
   - Your site will be live at a Vercel URL (e.g., finance-platform.vercel.app)
   - To use a custom domain, configure it in Vercel project settings

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── admin/               # Admin dashboard pages
│   │   ├── page.tsx        # Main dashboard
│   │   ├── invoices/       # Invoice management
│   │   ├── transactions/   # Transaction tracking
│   │   ├── contacts/       # Contact management
│   │   ├── items/          # Item/service management
│   │   └── forms/          # Custom forms
│   ├── auth/               # Authentication pages
│   │   ├── login/          # Login page
│   │   └── signup/         # Sign up page
│   └── layout.tsx          # Root layout
├── components/             # Reusable React components
│   ├── Dashboard.tsx       # Dashboard summary
│   ├── CompanySelector.tsx # Company switcher
│   ├── InvoiceForm.tsx    # Invoice creation form
│   └── InvoiceTemplate.tsx # Professional invoice template
├── lib/                    # Utility functions
│   ├── api.ts             # Supabase API calls
│   └── supabase.ts        # Supabase client
├── types/                 # TypeScript type definitions
│   └── database.ts        # Database types
├── public/                # Static assets
└── styles/                # Global styles
```

## Usage

### Creating an Account
1. Visit the signup page and create an account
2. Verify your email
3. Log in to the platform

### Setting Up Your First Company
1. Click "Create Company" in the admin dashboard
2. Enter company details (name, email, phone, address)
3. Upload a logo (optional)
4. Select the company in the company switcher

### Creating an Invoice
1. Navigate to Invoices
2. Click "Create Invoice"
3. Select a customer contact
4. Add items and amounts
5. Set issue and due dates
6. Save as draft or submit for approval

### Managing Contacts
1. Go to Contacts
2. Click "Add Contact"
3. Choose customer or vendor type
4. Fill in contact details
5. Save

### Tracking Transactions
1. Visit Transactions
2. Click "Add Transaction"
3. Select income or expense
4. Enter amount and description
5. Add tags and notes as needed

## Row Level Security (RLS)

The platform uses Supabase RLS to ensure users can only access their own company data:

```sql
-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

-- Create policy for companies
CREATE POLICY "Users can only see their own companies"
ON companies FOR SELECT
USING (auth.uid() = user_id);

-- Similar policies needed for other tables
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
```

## Support

For issues and questions, please create an issue in the GitHub repository.

## License

MIT License - see LICENSE file for details
