import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixMigrations() {
  try {
    // Check current migration status
    const { data: migrations, error: migError } = await supabase
      .from('supabase_migrations')
      .select('*')
      .order('version', { ascending: false })
      .limit(10);

    if (migError) {
      console.error('Error fetching migrations:', migError);
      return;
    }

    console.log('Recent migrations:');
    migrations.forEach(m => {
      console.log(`  ${m.version} - ${m.name || '(unnamed)'}`);
    });

    // Insert migration 037 as completed (if not exists)
    const { error: insertError } = await supabase
      .from('supabase_migrations')
      .upsert({
        version: '037',
        name: 'focus_mode_sessions',
        statements: []
      }, {
        onConflict: 'version'
      });

    if (insertError) {
      console.error('Error marking migration 037:', insertError);
    } else {
      console.log('Marked migration 037 as applied');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

fixMigrations();
