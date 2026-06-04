#!/usr/bin/env node
/**
 * Setup Database Script
 * Creates all tables and RLS policies in Supabase
 * Run: SUPABASE_DB_PASSWORD=your_password node setup-db.js
 */

const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ Error: .env.local not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1];
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

console.log('\n📊 Supabase Database Setup');
console.log('='.repeat(50));

if (!SUPABASE_URL) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!DB_PASSWORD) {
  console.error('❌ Error: SUPABASE_DB_PASSWORD environment variable not set');
  console.error('\nRun with: SUPABASE_DB_PASSWORD=your_password node setup-db.js');
  process.exit(1);
}

// Extract project ID
const projectId = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
if (!projectId) {
  console.error('❌ Error: Invalid SUPABASE_URL format');
  process.exit(1);
}

console.log(`Project: ${projectId}`);

const pg = require('pg');

async function setupDatabase() {
  const client = new pg.Client({
    host: `db.${projectId}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  try {
    console.log('\n🔗 Connecting...');
    await client.connect();
    console.log('✅ Connected!\n');

    const sqlPath = path.join(__dirname, 'database-schema.sql');
    const sqlSchema = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executing schema...\n');
    
    const statements = sqlSchema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executed = 0;
    let errors = 0;

    for (const statement of statements) {
      try {
        await client.query(statement);
        executed++;
        process.stdout.write('.');
      } catch (error) {
        errors++;
        process.stdout.write('⚠');
      }
    }

    console.log(`\n\n✅ Complete!`);
    console.log(`   Executed: ${executed}`);
    if (errors > 0) console.log(`   Warnings: ${errors}`);
    
    const result = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    console.log('\n📋 Tables:');
    result.rows.forEach(row => {
      console.log(`   • ${row.tablename}`);
    });

    console.log('\n🎉 Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase().catch(console.error);
