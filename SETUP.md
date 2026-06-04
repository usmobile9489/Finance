# Finance Platform - Setup Guide

## Step 1: Supabase Database Setup

The most critical step is to execute the database schema in your Supabase project. This creates all 12 tables with Row Level Security (RLS) policies.

### Instructions:

1. **Log in to your Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your Finance project

2. **Create a New SQL Query**
   - Click on **SQL Editor** in the left sidebar
   - Click **Create new query** button
   - Name it something like "Setup Finance Schema"

3. **Copy the Database Schema**
   - Open the `database-schema.sql` file in this project (root directory)
   - Select all content (Ctrl+A)
   - Copy it (Ctrl+C)

4. **Paste into Supabase**
   - Paste the entire schema into the SQL editor
   - Click the **Run** button (or press Ctrl+Enter)
   - Wait for the query to complete (should see "Success" message)

5. **Verify Tables Were Created**
   - Go to **Table Editor** in the left sidebar
   - You should see these tables:
     - companies
     - contacts
     - tags
     - items
     - item_pricing
     - transactions
     - invoices
     - invoice_items
     - forms
     - form_fields
     - form_submissions
     - audit_logs (optional)

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Configure Environment Variables

Your `.env.local` file should already be configured with:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

If not, create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in Supabase:
- Project Settings → API → Project URL and anon public key

## Step 4: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## ✅ Table Setup Verification Checklist

- [ ] All 12 tables created in Supabase
- [ ] `.env.local` has correct Supabase URL and key
- [ ] `npm install` completed successfully
- [ ] Development server starts without errors
- [ ] Can access http://localhost:3000
- [ ] Personal dashboard (`/dashboard`) loads
- [ ] Admin dashboard (`/admin`) loads

## 📝 Database Tables

### Core Tables
- **companies** - Financial company information
- **contacts** - Customers and vendors
- **items** - Products/services with pricing
- **tags** - Custom organizational tags

### Transaction & Invoicing
- **transactions** - Income and expense records
- **invoices** - Invoice records
- **invoice_items** - Line items in invoices
- **item_pricing** - Customer-specific pricing rules

### Custom Forms
- **forms** - Form templates
- **form_fields** - Fields within forms
- **form_submissions** - User form responses

## 🔐 Security

All database tables have Row Level Security (RLS) enabled:
- Users can only access data from their own companies
- Data is isolated by company_id and authenticated user (auth.uid())
- No data leaks between users

## ❓ Troubleshooting

### Error: "Table already exists"
- The table already exists in your database. Either:
  - Drop the table first: `DROP TABLE IF EXISTS table_name CASCADE;`
  - Skip to Step 2 (Install Dependencies)

### Error: "Permission denied"
- Make sure you're using the Supabase **SQL Editor**, not another tool
- Verify you're in the correct Supabase project
- Check that you're logged in as a project owner/admin

### Cannot connect to database from app
- Verify your `.env.local` has correct credentials
- Check that Supabase URL starts with `https://`
- Verify anon key is not empty
- Go to Supabase Settings → API and copy values again

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```
Then open http://localhost:3001

## 🚀 Next Steps

Once setup is complete:

1. **Test Personal Dashboard** (`/dashboard`)
   - Add test transactions
   - Add tags
   - View summary statistics

2. **Test Admin Dashboard** (`/admin`)
   - View company list
   - Navigate through all modules

3. **Connect to Live Database**
   - Replace mock data with real database queries
   - Update `app/dashboard/page.tsx` to fetch real transactions
   - Update admin pages to fetch real company data

4. **Build Features**
   - Authentication system (login/signup)
   - Invoice creation and management
   - Form builder interface
   - PDF invoice generation
   - File uploads for logos

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Documentation](https://react.dev)

## 💬 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase documentation
3. Check Next.js documentation
4. Review database-schema.sql comments

---

**Status**: Database schema creation is the critical first step. Without this, the application won't be able to connect to the database.
