# Finance Management Platform - Copilot Instructions

## Project Overview
Building a multi-company financial management website with Next.js + Supabase for managing 3 financial companies with income tracking, expenses, invoicing, recurring invoices, custom forms, and analytics.

## Setup Checklist

### 1. Create project structure and install dependencies
- [ ] Initialize Next.js project with TypeScript
- [ ] Install Supabase, Tailwind CSS, and UI libraries
- [ ] Create folder structure: app, components, lib, public, types

### 2. Set up Database Schema
- [ ] Create Supabase tables: companies, transactions, invoices, forms, items, tags
- [ ] Set up relationships and constraints
- [ ] Configure Row Level Security (RLS) policies

### 3. Build Core Features
- [ ] Authentication (Supabase Auth)
- [ ] Company management and multi-company support
- [ ] Dashboard/home page with company switcher
- [ ] Income and expense tracking
- [ ] Transaction tagging and notes
- [ ] Item prices with customer-specific pricing
- [ ] Contacts management (customers and vendors)

### 4. Build Invoicing System
- [ ] Create invoice creation/management with professional design
- [ ] Add company logo upload and display per invoice
- [ ] Recurring invoice setup
- [ ] Approval workflow before sending
- [ ] Multiple invoice templates with custom styling
- [ ] Company-specific invoice URLs for clients

### 5. Build Custom Forms Feature
- [ ] Form builder interface
- [ ] Form templates
- [ ] Form responses/submissions

### 6. Build Analytics & Reports
- [ ] Dashboard showing total income per company
- [ ] Total income across all companies
- [ ] Financial summary reports

### 7. Test and Deploy
- [ ] Test all features
- [ ] Deploy to Vercel
- [ ] Set up environment variables

## Key Requirements
- Multi-company support (3 companies)
- Income and expense tracking
- Custom invoice forms with approval
- Recurring invoice options
- Item pricing varies per customer
- Tags for items and transactions
- Notes functionality
- Company-specific and aggregate analytics

## Tech Stack
- **Frontend**: Next.js 14+ with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Hosting**: Vercel

## Development Guidelines
- Use TypeScript for type safety
- Component-based architecture with React
- Supabase client for database operations
- Responsive design with Tailwind CSS
- Implement proper error handling and validation
