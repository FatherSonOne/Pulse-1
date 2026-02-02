/**
 * Database Migration Runner for Pulse Supabase
 *
 * This script executes SQL migrations against the Pulse Supabase database.
 *
 * Requirements:
 * - Service role key in .env.local (SUPABASE_SERVICE_ROLE_KEY)
 * - Supabase URL in .env.local (VITE_SUPABASE_URL)
 *
 * Usage:
 *   node migrations/run-migrations.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n📝 Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
  console.error('   You can find it in your Supabase project settings under "API"');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migration files to run (in order)
const migrations = [
  '001_google_contacts_sync_jobs.sql',
  '002_relationship_profiles_api_access.sql'
];

async function runMigration(filename) {
  console.log(`\n📄 Running migration: ${filename}`);

  try {
    const sqlPath = join(__dirname, filename);
    const sql = readFileSync(sqlPath, 'utf8');

    // Execute SQL using Supabase client
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      // If exec_sql function doesn't exist, try using the REST API directly
      if (error.code === 'PGRST202') {
        console.log('⚠️  exec_sql function not available, trying direct execution...');

        // For direct execution, we'll need to use a different approach
        // Split the SQL into individual statements and execute them
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement) {
            console.log(`   Executing: ${statement.substring(0, 50)}...`);
            // Note: Supabase JS client doesn't support raw SQL execution
            // You'll need to run these migrations manually via Supabase SQL Editor
            console.log('   (Requires manual execution via Supabase SQL Editor)');
          }
        }

        console.log('\n⚠️  Please run this migration manually:');
        console.log(`   1. Go to https://app.supabase.com/project/YOUR_PROJECT_ID/sql`);
        console.log(`   2. Copy the contents of: ${filename}`);
        console.log(`   3. Paste and execute in the SQL Editor`);
        return false;
      }

      throw error;
    }

    console.log(`✅ Migration completed: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function runAllMigrations() {
  console.log('🚀 Starting database migrations...\n');
  console.log(`📍 Database: ${SUPABASE_URL}`);

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📝 Total: ${migrations.length}`);

  if (failCount > 0) {
    console.log('\n⚠️  Some migrations need to be run manually via Supabase SQL Editor');
    console.log('   See instructions above for each failed migration');
  } else {
    console.log('\n🎉 All migrations completed successfully!');
  }

  console.log('\n' + '='.repeat(60));
}

// Run migrations
runAllMigrations().catch(error => {
  console.error('\n❌ Migration runner failed:', error);
  process.exit(1);
});
