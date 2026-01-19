/**
 * Saved Searches Service
 */

import { supabase } from './supabase';
import { SearchFilters, SearchSortOptions } from './unifiedSearchService';

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query: string;
  filters: SearchFilters;
  alertEnabled: boolean;
  alertFrequency: 'daily' | 'weekly' | 'instant';
  lastAlertAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class SavedSearchesService {
  /**
   * Get all saved searches for user
   */
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching saved searches:', error);
        return [];
      }

      return (data || []).map(this.dbToSavedSearch);
    } catch (err: any) {
      console.error('Error fetching saved searches:', {
        message: err.message,
        details: err.toString(),
        hint: 'This may be due to network connectivity or Supabase configuration issues.',
        code: err.code || '',
      });
      return [];
    }
  }

  /**
   * Create saved search
   */
  async createSavedSearch(
    userId: string,
    search: Omit<SavedSearch, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<SavedSearch | null> {
    const { data, error } = await supabase
      .from('saved_searches')
      .insert([{
        user_id: userId,
        name: search.name,
        query: search.query,
        filters: search.filters,
        alert_enabled: search.alertEnabled,
        alert_frequency: search.alertFrequency,
        last_alert_at: search.lastAlertAt?.toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating saved search:', error);
      return null;
    }

    return this.dbToSavedSearch(data);
  }

  /**
   * Update saved search
   */
  async updateSavedSearch(userId: string, id: string, updates: Partial<SavedSearch>): Promise<boolean> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.query !== undefined) updateData.query = updates.query;
    if (updates.filters !== undefined) updateData.filters = updates.filters;
    if (updates.alertEnabled !== undefined) updateData.alert_enabled = updates.alertEnabled;
    if (updates.alertFrequency !== undefined) updateData.alert_frequency = updates.alertFrequency;
    if (updates.lastAlertAt !== undefined) updateData.last_alert_at = updates.lastAlertAt?.toISOString();

    const { error } = await supabase
      .from('saved_searches')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Delete saved search
   */
  async deleteSavedSearch(userId: string, id: string): Promise<boolean> {
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Convert DB row to SavedSearch
   */
  private dbToSavedSearch(db: any): SavedSearch {
    return {
      id: db.id,
      userId: db.user_id,
      name: db.name,
      query: db.query,
      filters: db.filters || {},
      alertEnabled: db.alert_enabled || false,
      alertFrequency: db.alert_frequency || 'daily',
      lastAlertAt: db.last_alert_at ? new Date(db.last_alert_at) : undefined,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at),
    };
  }
}

export const savedSearchesService = new SavedSearchesService();