import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
});

async function executeMigration(filename) {
  try {
    console.log(`\nApplying migration: ${filename}`);
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename);
    const sql = await fs.readFile(migrationPath, 'utf8');

    // Execute via pg-connection (direct SQL execution)
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      // Try alternative: split and execute via pg query
      console.log('Direct exec failed, using SQL statements...');

      // For now, just verify table doesn't exist yet
      const { data, error } = await supabase
        .from('relationship_health')
        .select('count')
        .limit(0);

      if (!error) {
        console.log('Table already exists!');
        return true;
      }

      // Execute CREATE TABLE statement
      console.log('Creating table via raw SQL...');
      // We'll need to use the SQL Editor API or another method
      console.log('Please apply this migration via Supabase Dashboard > SQL Editor:');
      console.log(sql);
      return false;
    }

    console.log('Migration applied successfully!');
    return true;

  } catch (err) {
    console.error('Error:', err.message);
    return false;
  }
}

// Apply migrations
const migrations = [
  '20260206211700_relationship_health.sql'
];

for (const migration of migrations) {
  await executeMigration(migration);
}

// Verify
console.log('\nVerifying tables...');
const { data, error } = await supabase
  .from('relationship_health')
  .select('count')
  .limit(0);

if (error) {
  console.log('❌ relationship_health table not found');
  console.log('\nPlease apply the migration manually via Supabase Dashboard.');
} else {
  console.log('✓ relationship_health table exists!');
}
