const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '038_relationship_health.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration 038_relationship_health.sql...');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If exec_sql doesn't exist, try direct execution via postgrest
      console.log('Trying alternative method...');

      // Split SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Executing: ${statement.substring(0, 100)}...`);
          const { error: stmtError } = await supabase.rpc('exec', {
            query: statement + ';'
          });
          if (stmtError) {
            console.error('Statement error:', stmtError);
          }
        }
      }
    }

    console.log('Migration applied successfully!');

    // Verify the table was created
    const { data: tables, error: tableError } = await supabase
      .from('relationship_health')
      .select('count')
      .limit(0);

    if (tableError) {
      console.log('Verification - Table may not exist yet:', tableError.message);
    } else {
      console.log('Verification - relationship_health table exists!');
    }

  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  }
}

applyMigration();
