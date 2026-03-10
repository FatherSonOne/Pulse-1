/**
 * Data Cleanup Edge Function
 * Scheduled function that executes automatic data retention cleanup
 * Runs daily at scheduled time for users with auto-cleanup enabled
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ================================================
// Types
// ================================================

interface DataRetentionPolicy {
  id: string;
  user_id: string;
  emails_retention_days: number;
  calendar_retention_days: number;
  contacts_retention_days: number;
  messages_retention_days: number;
  auto_cleanup_enabled: boolean;
  cleanup_time_utc: string;
  last_cleanup_at: string | null;
  next_cleanup_at: string | null;
}

interface CleanupResult {
  user_id: string;
  cleanup_type: string;
  items_deleted: number;
  status: 'completed' | 'failed' | 'partial';
  error_message?: string;
  execution_time_ms: number;
}

// ================================================
// Main Handler
// ================================================

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify authorization (cron secret or service role key)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!authHeader || !cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify secret matches
    const providedSecret = authHeader.replace('Bearer ', '');
    if (providedSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional user_id (manual trigger)
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body.user_id || null;
    } catch {
      // No body or invalid JSON - run for all users
    }

    // Get policies that need cleanup
    const now = new Date();
    let query = supabase
      .from('data_retention_policies')
      .select('*')
      .eq('auto_cleanup_enabled', true);

    if (targetUserId) {
      // Manual trigger for specific user
      query = query.eq('user_id', targetUserId);
    } else {
      // Scheduled trigger - only cleanup policies due now
      query = query.lte('next_cleanup_at', now.toISOString());
    }

    const { data: policies, error: policiesError } = await query;

    if (policiesError) {
      console.error('[DataCleanup] Error fetching policies:', policiesError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch retention policies',
          details: policiesError.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!policies || policies.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No policies due for cleanup',
          processed: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DataCleanup] Processing ${policies.length} policies`);

    // Execute cleanup for each policy
    const results: CleanupResult[] = [];

    for (const policy of policies) {
      try {
        const policyResults = await cleanupUserData(supabase, policy);
        results.push(...policyResults);

        // Update policy last_cleanup_at and next_cleanup_at
        const nextCleanup = calculateNextCleanup(policy.cleanup_time_utc);

        await supabase
          .from('data_retention_policies')
          .update({
            last_cleanup_at: now.toISOString(),
            next_cleanup_at: nextCleanup.toISOString(),
          })
          .eq('id', policy.id);
      } catch (error) {
        console.error(`[DataCleanup] Error processing policy ${policy.id}:`, error);
        results.push({
          user_id: policy.user_id,
          cleanup_type: 'all',
          items_deleted: 0,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          execution_time_ms: 0,
        });
      }
    }

    // Calculate summary
    const summary = {
      policies_processed: policies.length,
      total_items_deleted: results.reduce((sum, r) => sum + r.items_deleted, 0),
      successful: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };

    console.log('[DataCleanup] Cleanup completed:', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[DataCleanup] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// ================================================
// Helper Functions
// ================================================

/**
 * Execute cleanup for all data types in a policy
 */
async function cleanupUserData(
  supabase: any,
  policy: DataRetentionPolicy
): Promise<CleanupResult[]> {
  const results: CleanupResult[] = [];

  const dataTypes = [
    { type: 'emails', days: policy.emails_retention_days, table: 'emails' },
    { type: 'calendar', days: policy.calendar_retention_days, table: 'calendar_events' },
    { type: 'contacts', days: policy.contacts_retention_days, table: 'contacts' },
    { type: 'messages', days: policy.messages_retention_days, table: 'messages' },
  ];

  for (const { type, days, table } of dataTypes) {
    // Skip if retention is -1 (never delete)
    if (days === -1) {
      continue;
    }

    const startTime = Date.now();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Delete old data
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', policy.user_id)
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        // Table might not exist or have different schema
        console.warn(`[DataCleanup] Error deleting ${type} for user ${policy.user_id}:`, error);

        results.push({
          user_id: policy.user_id,
          cleanup_type: type,
          items_deleted: 0,
          status: 'failed',
          error_message: error.message,
          execution_time_ms: Date.now() - startTime,
        });

        // Log to cleanup_logs
        await logCleanup(
          supabase,
          policy.user_id,
          type,
          0,
          days,
          'failed',
          Date.now() - startTime,
          error.message
        );

        continue;
      }

      const itemsDeleted = data?.length || 0;
      const executionTime = Date.now() - startTime;

      results.push({
        user_id: policy.user_id,
        cleanup_type: type,
        items_deleted: itemsDeleted,
        status: 'completed',
        execution_time_ms: executionTime,
      });

      // Log to cleanup_logs
      await logCleanup(
        supabase,
        policy.user_id,
        type,
        itemsDeleted,
        days,
        'completed',
        executionTime
      );

      if (itemsDeleted > 0) {
        console.log(
          `[DataCleanup] Deleted ${itemsDeleted} ${type} for user ${policy.user_id}`
        );
      }
    } catch (error) {
      console.error(`[DataCleanup] Error cleaning ${type}:`, error);

      results.push({
        user_id: policy.user_id,
        cleanup_type: type,
        items_deleted: 0,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - startTime,
      });
    }
  }

  return results;
}

/**
 * Log cleanup operation to database
 */
async function logCleanup(
  supabase: any,
  userId: string,
  cleanupType: string,
  itemsDeleted: number,
  retentionDays: number,
  status: 'completed' | 'failed' | 'partial',
  executionTimeMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('data_cleanup_logs').insert({
      user_id: userId,
      cleanup_type: cleanupType,
      items_deleted: itemsDeleted,
      retention_days: retentionDays,
      status,
      execution_time_ms: executionTimeMs,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error('[DataCleanup] Error logging cleanup:', error);
  }
}

/**
 * Calculate next cleanup time based on cleanup_time_utc
 */
function calculateNextCleanup(cleanupTimeUtc: string): Date {
  const now = new Date();
  const [hours, minutes, seconds] = cleanupTimeUtc.split(':').map(Number);

  const nextCleanup = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hours,
      minutes,
      seconds || 0
    )
  );

  // If that time has passed today, schedule for tomorrow
  if (nextCleanup <= now) {
    nextCleanup.setUTCDate(nextCleanup.getUTCDate() + 1);
  }

  return nextCleanup;
}
