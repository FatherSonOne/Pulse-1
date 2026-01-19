/**
 * API Key Management Service
 * Handles creation, validation, and management of public API keys
 */

import { supabase } from './supabase';

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface ApiKeyCreateResult {
  key_id: string;
  api_key: string;  // Only returned once on creation
  key_prefix: string;
}

export interface ApiRequestLog {
  id: string;
  api_key_id: string | null;
  user_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ApiUsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  requests_by_endpoint: Record<string, number>;
  requests_by_day: { date: string; count: number }[];
}

// Scope definitions
export const API_SCOPES = {
  read: 'Read access to your data',
  write: 'Create and update data',
  delete: 'Delete data',
  admin: 'Full administrative access'
} as const;

export type ApiScope = keyof typeof API_SCOPES;

/**
 * Create a new API key
 */
export async function createApiKey(
  name: string,
  scopes: ApiScope[] = ['read'],
  rateLimit: number = 100,
  expiresAt?: Date
): Promise<{ success: boolean; data?: ApiKeyCreateResult; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.rpc('generate_api_key', {
      p_user_id: user.id,
      p_name: name,
      p_scopes: scopes,
      p_rate_limit: rateLimit,
      p_expires_at: expiresAt?.toISOString() || null
    });

    if (error) throw error;

    // The function returns an array with one row
    const result = data?.[0];
    if (!result) {
      return { success: false, error: 'Failed to generate API key' };
    }

    return {
      success: true,
      data: {
        key_id: result.key_id,
        api_key: result.api_key,
        key_prefix: result.key_prefix
      }
    };
  } catch (err: any) {
    console.error('Error creating API key:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all API keys for the current user
 */
export async function getApiKeys(): Promise<{ success: boolean; data?: ApiKey[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching API keys:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get a single API key by ID
 */
export async function getApiKey(keyId: string): Promise<{ success: boolean; data?: ApiKey; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (err: any) {
    console.error('Error fetching API key:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update an API key
 */
export async function updateApiKey(
  keyId: string,
  updates: {
    name?: string;
    scopes?: ApiScope[];
    rate_limit?: number;
    is_active?: boolean;
    expires_at?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('api_keys')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('Error updating API key:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete (revoke) an API key
 */
export async function deleteApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('Error deleting API key:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Revoke an API key (soft delete - marks as inactive)
 */
export async function revokeApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
  return updateApiKey(keyId, { is_active: false });
}

/**
 * Get API request logs for the current user
 */
export async function getApiRequestLogs(
  options: {
    keyId?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ success: boolean; data?: ApiRequestLog[]; error?: string }> {
  try {
    let query = supabase
      .from('api_request_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.keyId) {
      query = query.eq('api_key_id', options.keyId);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching API request logs:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get API usage statistics
 */
export async function getApiUsageStats(
  keyId?: string,
  days: number = 30
): Promise<{ success: boolean; data?: ApiUsageStats; error?: string }> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('api_request_logs')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (keyId) {
      query = query.eq('api_key_id', keyId);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    if (!logs || logs.length === 0) {
      return {
        success: true,
        data: {
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          average_response_time: 0,
          requests_by_endpoint: {},
          requests_by_day: []
        }
      };
    }

    // Calculate stats
    const successfulRequests = logs.filter(l => l.status_code >= 200 && l.status_code < 400);
    const failedRequests = logs.filter(l => l.status_code >= 400);

    const responseTimes = logs
      .filter(l => l.response_time_ms !== null)
      .map(l => l.response_time_ms as number);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Group by endpoint
    const requestsByEndpoint: Record<string, number> = {};
    logs.forEach(log => {
      requestsByEndpoint[log.endpoint] = (requestsByEndpoint[log.endpoint] || 0) + 1;
    });

    // Group by day
    const requestsByDayMap: Record<string, number> = {};
    logs.forEach(log => {
      const day = log.created_at.split('T')[0];
      requestsByDayMap[day] = (requestsByDayMap[day] || 0) + 1;
    });

    const requestsByDay = Object.entries(requestsByDayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: {
        total_requests: logs.length,
        successful_requests: successfulRequests.length,
        failed_requests: failedRequests.length,
        average_response_time: Math.round(avgResponseTime),
        requests_by_endpoint: requestsByEndpoint,
        requests_by_day: requestsByDay
      }
    };
  } catch (err: any) {
    console.error('Error fetching API usage stats:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Generate example curl command for an API key
 */
export function generateCurlExample(apiKey: string, endpoint: string = '/api/v1/projects'): string {
  return `curl -X GET "https://pulse.logosvision.org${endpoint}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json"`;
}

/**
 * Generate example JavaScript fetch code
 */
export function generateFetchExample(apiKey: string, endpoint: string = '/api/v1/projects'): string {
  return `const response = await fetch('https://pulse.logosvision.org${endpoint}', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);`;
}

/**
 * Generate example Python code
 */
export function generatePythonExample(apiKey: string, endpoint: string = '/api/v1/projects'): string {
  return `import requests

response = requests.get(
    'https://pulse.logosvision.org${endpoint}',
    headers={
        'Authorization': 'Bearer ${apiKey}',
        'Content-Type': 'application/json'
    }
)

data = response.json()
print(data)`;
}
