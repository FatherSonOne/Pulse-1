// Test Matrix Persistence Service
// Saves and loads test results to/from Supabase

import { supabase } from './supabase';

export type TestStatus = 'pass' | 'fail' | 'pending' | 'blocked';

export interface TestResult {
  id: string;
  test_id: string;
  status: TestStatus;
  notes: string;
  tester_name: string;
  user_id: string;
  updated_at: string;
}

export interface TestMatrixData {
  tester_name: string;
  results: Record<string, { status: TestStatus; notes: string }>;
}

/**
 * Save a single test result to Supabase
 * Uses upsert to create or update existing result
 */
export const saveTestResult = async (
  testId: string,
  status: TestStatus,
  notes: string,
  testerName: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('test_matrix_results')
    .upsert(
      {
        test_id: testId,
        status,
        notes,
        tester_name: testerName,
        user_id: userId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'test_id,user_id',
      }
    );

  if (error) {
    console.error('Failed to save test result:', error);
    throw new Error(`Failed to save test result: ${error.message}`);
  }
};

/**
 * Load all test results for a user
 */
export const loadTestResults = async (userId: string): Promise<TestMatrixData> => {
  const { data, error } = await supabase
    .from('test_matrix_results')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to load test results:', error);
    // Return empty data on error (first time use)
    return { tester_name: '', results: {} };
  }

  if (!data || data.length === 0) {
    return { tester_name: '', results: {} };
  }

  // Build results map from database records
  const results: Record<string, { status: TestStatus; notes: string }> = {};
  let testerName = '';

  data.forEach((result: TestResult) => {
    results[result.test_id] = {
      status: result.status,
      notes: result.notes,
    };
    // Use the most recent tester name
    if (!testerName && result.tester_name) {
      testerName = result.tester_name;
    }
  });

  return { tester_name: testerName, results };
};

/**
 * Save tester name preference
 */
export const saveTesterName = async (
  testerName: string,
  userId: string
): Promise<void> => {
  // Update all existing results with the new tester name
  const { error } = await supabase
    .from('test_matrix_results')
    .update({ tester_name: testerName, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to save tester name:', error);
  }
};

/**
 * Clear all test results for a user (reset)
 */
export const clearTestResults = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('test_matrix_results')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to clear test results:', error);
    throw new Error(`Failed to clear test results: ${error.message}`);
  }
};

/**
 * Get all test results from all testers (for admin view)
 */
export const getAllTestResults = async (): Promise<TestResult[]> => {
  const { data, error } = await supabase
    .from('test_matrix_results')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to load all test results:', error);
    return [];
  }

  return data || [];
};
