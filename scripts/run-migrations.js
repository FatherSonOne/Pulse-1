import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runMigrations() {
  console.log('🚀 Running Analytics Migrations...\n');

  try {
    // Read the combined migration file
    const sql = await fs.readFile('apply-all-analytics-migrations.sql', 'utf8');

    // Split into individual statements (rough split - good enough for this use case)
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^={3,}/));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Skip comments and separators
      if (stmt.startsWith('--') || stmt.match(/^={3,}/)) continue;

      const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
      process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

      try {
        // Use the SQL execution endpoint
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: stmt + ';' })
        });

        if (response.ok || response.status === 204) {
          console.log('✓');
          successCount++;
        } else {
          const error = await response.text();
          console.log(`⚠️  ${error.substring(0, 50)}`);
          // Don't count as error if it's "already exists" type errors
          if (error.includes('already exists') || error.includes('IF NOT EXISTS')) {
            successCount++;
          } else {
            errorCount++;
          }
        }
      } catch (err) {
        console.log(`❌ ${err.message.substring(0, 50)}`);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Migration Summary:`);
    console.log(`  ✓ Success: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }

  // Verify tables were created
  console.log('🔍 Verifying tables...\n');

  const expectedTables = [
    'relationship_health',
    'conflict_tracking',
    'hot_topics',
    'recognition_events',
    'recognition_summary',
    'wins_tracker',
    'predictions_cache',
    'ml_training_data',
    'burnout_indicators'
  ];

  for (const tableName of expectedTables) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('count')
        .limit(0);

      if (error) {
        console.log(`  ❌ ${tableName} - NOT FOUND`);
      } else {
        console.log(`  ✓ ${tableName}`);
      }
    } catch (err) {
      console.log(`  ❌ ${tableName} - ERROR: ${err.message}`);
    }
  }

  console.log('\n✅ Migration process complete!');
  console.log('\nIf tables show as NOT FOUND, please apply manually via Supabase Dashboard.');
  console.log('See APPLY_MIGRATIONS.md for instructions.\n');
}

runMigrations();
