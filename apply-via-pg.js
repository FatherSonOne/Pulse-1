import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const { Client } = pg;

// Get database password from environment or use direct connection via supabase CLI
// The SERVICE_KEY is a JWT, not the database password
// We need to get the actual database password from Supabase dashboard
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!dbPassword) {
  console.error('❌ SUPABASE_DB_PASSWORD not found in .env');
  console.error('Please add your database password to .env file');
  console.error('Get it from: https://app.supabase.com/project/ucaeuszgoihoyrvhewxk/settings/database');
  process.exit(1);
}

const connectionString = `postgresql://postgres.ucaeuszgoihoyrvhewxk:${dbPassword}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`;

async function applyMigrations() {
  const client = new Client({ connectionString });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('Connected!\n');

    // Read the combined migration SQL
    const sql = await fs.readFile('apply-all-analytics-migrations.sql', 'utf8');

    console.log('Executing migration SQL...');
    await client.query(sql);

    console.log('✅ Migration executed successfully!\n');

    // Verify tables
    const { rows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'relationship_health',
        'conflict_tracking',
        'hot_topics',
        'recognition_events',
        'recognition_summary',
        'wins_tracker',
        'predictions_cache',
        'ml_training_data',
        'burnout_indicators'
      )
      ORDER BY table_name;
    `);

    console.log('Tables created:');
    rows.forEach(row => console.log(`  ✓ ${row.table_name}`));

    if (rows.length === 9) {
      console.log('\n✅ All 9 tables created successfully!');
    } else {
      console.log(`\n⚠️  Only ${rows.length}/9 tables found`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();
