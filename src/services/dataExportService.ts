/**
 * Data Export Service
 * Handles comprehensive data export functionality for Privacy Dashboard
 * Exports user data (emails, contacts, calendar, settings) as downloadable ZIP files
 * Stores exports in Supabase Storage with 30-day expiration
 */

import { supabase } from './supabase';
import JSZip from 'jszip';

// Types
export interface DataExport {
  id: string;
  user_id: string;
  export_type: ExportType;
  status: ExportStatus;
  file_size_bytes: number | null;
  file_url: string | null;
  storage_path: string | null;
  expires_at: string;
  downloaded_at: string | null;
  download_count: number;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type ExportType =
  | 'full_export'
  | 'emails_only'
  | 'contacts_only'
  | 'calendar_only'
  | 'settings_only'
  | 'messages_only';

export type ExportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export interface ExportRequest {
  exportType: ExportType;
  includeAttachments?: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface ExportData {
  emails?: any[];
  contacts?: any[];
  calendar?: any[];
  settings?: any;
  messages?: any[];
  metadata?: {
    exportDate: string;
    exportType: ExportType;
    recordCounts: Record<string, number>;
  };
}

class DataExportService {
  private readonly EXPORT_EXPIRY_DAYS = 30;
  private readonly STORAGE_BUCKET = 'data-exports';

  /**
   * Request a new data export
   */
  async requestExport(
    userId: string,
    request: ExportRequest
  ): Promise<DataExport | null> {
    try {
      // Create export record in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.EXPORT_EXPIRY_DAYS);

      const { data, error } = await supabase
        .from('data_exports')
        .insert({
          user_id: userId,
          export_type: request.exportType,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
          metadata: {
            includeAttachments: request.includeAttachments || false,
            dateRange: request.dateRange || null,
          },
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[DataExport] Export request created:', data.id);

      // Start export processing in background
      this.processExport(data.id, userId, request).catch((err) => {
        console.error('[DataExport] Background processing error:', err);
      });

      return data;
    } catch (error) {
      console.error('[DataExport] Error requesting export:', error);
      return null;
    }
  }

  /**
   * Process the data export (background task)
   */
  private async processExport(
    exportId: string,
    userId: string,
    request: ExportRequest
  ): Promise<void> {
    try {
      // Update status to processing
      await this.updateExportStatus(exportId, 'processing');

      // Gather data based on export type
      const exportData = await this.gatherExportData(userId, request);

      // Generate ZIP file
      const zipBlob = await this.generateZipFile(exportData, request.exportType);

      // Upload to Supabase Storage
      const storagePath = await this.uploadToStorage(
        userId,
        exportId,
        zipBlob
      );

      // Generate signed URL (valid for 7 days)
      const fileUrl = await this.generateSignedUrl(storagePath);

      // Update export record with success
      await supabase
        .from('data_exports')
        .update({
          status: 'completed',
          file_size_bytes: zipBlob.size,
          storage_path: storagePath,
          file_url: fileUrl,
          metadata: {
            ...exportData.metadata,
            includeAttachments: request.includeAttachments || false,
          },
        })
        .eq('id', exportId);

      console.log('[DataExport] Export completed:', exportId);

      // Log activity
      await this.logActivity(userId, 'data_export', 'Export completed', {
        exportId,
        exportType: request.exportType,
        fileSize: zipBlob.size,
      });
    } catch (error: any) {
      console.error('[DataExport] Error processing export:', error);

      // Update export record with error
      await supabase
        .from('data_exports')
        .update({
          status: 'failed',
          error_message: error.message || 'Unknown error',
        })
        .eq('id', exportId);
    }
  }

  /**
   * Gather data for export based on type
   */
  private async gatherExportData(
    userId: string,
    request: ExportRequest
  ): Promise<ExportData> {
    const data: ExportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        exportType: request.exportType,
        recordCounts: {},
      },
    };

    try {
      // Full export includes everything
      if (
        request.exportType === 'full_export' ||
        request.exportType === 'settings_only'
      ) {
        data.settings = await this.exportUserSettings(userId);
        if (data.settings) {
          data.metadata!.recordCounts.settings = 1;
        }
      }

      // Export user settings from user_settings table
      if (
        request.exportType === 'full_export' ||
        request.exportType === 'contacts_only'
      ) {
        data.contacts = await this.exportContacts(userId);
        data.metadata!.recordCounts.contacts = data.contacts?.length || 0;
      }

      if (
        request.exportType === 'full_export' ||
        request.exportType === 'calendar_only'
      ) {
        data.calendar = await this.exportCalendar(userId, request.dateRange);
        data.metadata!.recordCounts.calendar = data.calendar?.length || 0;
      }

      if (
        request.exportType === 'full_export' ||
        request.exportType === 'messages_only'
      ) {
        data.messages = await this.exportMessages(userId, request.dateRange);
        data.metadata!.recordCounts.messages = data.messages?.length || 0;
      }

      // Note: Emails are from Gmail API, handled separately if needed
      if (
        request.exportType === 'full_export' ||
        request.exportType === 'emails_only'
      ) {
        // Placeholder - would integrate with Gmail API
        data.emails = [];
        data.metadata!.recordCounts.emails = 0;
      }

      return data;
    } catch (error) {
      console.error('[DataExport] Error gathering data:', error);
      throw error;
    }
  }

  /**
   * Export user settings
   */
  private async exportUserSettings(userId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.debug('[DataExport] No user settings found (expected for new users)');
          return null;
        }
        throw error;
      }

      return {
        ...data.settings,
        lastUpdated: data.updated_at,
      };
    } catch (error) {
      console.error('[DataExport] Error exporting settings:', error);
      return null;
    }
  }

  /**
   * Export contacts (placeholder - would integrate with Google Contacts API)
   */
  private async exportContacts(userId: string): Promise<any[]> {
    // This would integrate with googleContactsService
    // For now, return empty array
    return [];
  }

  /**
   * Export calendar events (placeholder - would integrate with Google Calendar API)
   */
  private async exportCalendar(
    userId: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<any[]> {
    // This would integrate with googleCalendarService
    // For now, return empty array
    return [];
  }

  /**
   * Export messages (if stored in Supabase)
   */
  private async exportMessages(
    userId: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: true });

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.startDate)
          .lte('created_at', dateRange.endDate);
      }

      const { data, error } = await query;

      if (error) {
        // Table might not exist
        console.debug('[DataExport] No messages found (table may not exist)');
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[DataExport] Error exporting messages:', error);
      return [];
    }
  }

  /**
   * Generate ZIP file from export data
   */
  private async generateZipFile(
    data: ExportData,
    exportType: ExportType
  ): Promise<Blob> {
    const zip = new JSZip();

    // Add metadata file
    zip.file(
      'metadata.json',
      JSON.stringify(data.metadata, null, 2)
    );

    // Add data files based on what's included
    if (data.settings) {
      zip.file('settings.json', JSON.stringify(data.settings, null, 2));
    }

    if (data.contacts && data.contacts.length > 0) {
      zip.file('contacts.json', JSON.stringify(data.contacts, null, 2));
      // Also add CSV version
      const contactsCsv = this.convertToCSV(data.contacts);
      zip.file('contacts.csv', contactsCsv);
    }

    if (data.calendar && data.calendar.length > 0) {
      zip.file('calendar.json', JSON.stringify(data.calendar, null, 2));
      // Also add CSV version
      const calendarCsv = this.convertToCSV(data.calendar);
      zip.file('calendar.csv', calendarCsv);
    }

    if (data.messages && data.messages.length > 0) {
      zip.file('messages.json', JSON.stringify(data.messages, null, 2));
    }

    if (data.emails && data.emails.length > 0) {
      zip.file('emails.json', JSON.stringify(data.emails, null, 2));
    }

    // Add README
    const readme = this.generateReadme(exportType, data.metadata);
    zip.file('README.txt', readme);

    // Generate ZIP blob
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return blob;
  }

  /**
   * Convert array of objects to CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        const escaped = ('' + value).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Generate README file for export
   */
  private generateReadme(
    exportType: ExportType,
    metadata?: ExportData['metadata']
  ): string {
    const recordCounts = metadata?.recordCounts || {};

    return `
PULSE DATA EXPORT
=================

Export Type: ${exportType}
Export Date: ${metadata?.exportDate || new Date().toISOString()}

CONTENTS
--------
${recordCounts.settings ? '✓ settings.json - Your application settings' : ''}
${recordCounts.contacts ? `✓ contacts.json, contacts.csv - ${recordCounts.contacts} contacts` : ''}
${recordCounts.calendar ? `✓ calendar.json, calendar.csv - ${recordCounts.calendar} calendar events` : ''}
${recordCounts.messages ? `✓ messages.json - ${recordCounts.messages} messages` : ''}
${recordCounts.emails ? `✓ emails.json - ${recordCounts.emails} emails` : ''}
✓ metadata.json - Export metadata and statistics
✓ README.txt - This file

FILE FORMATS
------------
- JSON files: Machine-readable format for importing into other applications
- CSV files: Spreadsheet-compatible format for viewing in Excel/Google Sheets

PRIVACY NOTICE
--------------
This export contains your personal data from Pulse.
Please store this file securely and delete it when no longer needed.
This export will automatically expire and be deleted after 30 days.

SUPPORT
-------
For questions about your data export, contact support@pulse.app
Privacy Policy: https://pulse.app/privacy
    `.trim();
  }

  /**
   * Upload ZIP file to Supabase Storage
   */
  private async uploadToStorage(
    userId: string,
    exportId: string,
    blob: Blob
  ): Promise<string> {
    const fileName = `${exportId}.zip`;
    const filePath = `${userId}/${fileName}`;

    const { error } = await supabase.storage
      .from(this.STORAGE_BUCKET)
      .upload(filePath, blob, {
        contentType: 'application/zip',
        upsert: false,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return filePath;
  }

  /**
   * Generate signed URL for download
   */
  private async generateSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(this.STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Update export status
   */
  private async updateExportStatus(
    exportId: string,
    status: ExportStatus
  ): Promise<void> {
    await supabase
      .from('data_exports')
      .update({ status })
      .eq('id', exportId);
  }

  /**
   * Get user's export history
   */
  async getExportHistory(userId: string): Promise<DataExport[]> {
    try {
      const { data, error } = await supabase
        .from('data_exports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === 'PGRST204' || error.code === 'PGRST116') {
          console.debug('[DataExport] No export history found (expected for new users)');
          return [];
        }
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[DataExport] Error getting export history:', error);
      return [];
    }
  }

  /**
   * Get export by ID
   */
  async getExport(exportId: string): Promise<DataExport | null> {
    try {
      const { data, error } = await supabase
        .from('data_exports')
        .select('*')
        .eq('id', exportId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[DataExport] Error getting export:', error);
      return null;
    }
  }

  /**
   * Track download of an export
   */
  async trackDownload(exportId: string): Promise<void> {
    try {
      const { data: exportData } = await supabase
        .from('data_exports')
        .select('download_count')
        .eq('id', exportId)
        .single();

      const currentCount = exportData?.download_count || 0;

      await supabase
        .from('data_exports')
        .update({
          downloaded_at: new Date().toISOString(),
          download_count: currentCount + 1,
        })
        .eq('id', exportId);
    } catch (error) {
      console.error('[DataExport] Error tracking download:', error);
    }
  }

  /**
   * Delete an export (from both database and storage)
   */
  async deleteExport(exportId: string, userId: string): Promise<boolean> {
    try {
      // Get export details
      const exportData = await this.getExport(exportId);
      if (!exportData || exportData.user_id !== userId) {
        throw new Error('Export not found or unauthorized');
      }

      // Delete from storage if exists
      if (exportData.storage_path) {
        await supabase.storage
          .from(this.STORAGE_BUCKET)
          .remove([exportData.storage_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('data_exports')
        .delete()
        .eq('id', exportId)
        .eq('user_id', userId);

      if (error) throw error;

      console.log('[DataExport] Export deleted:', exportId);
      return true;
    } catch (error) {
      console.error('[DataExport] Error deleting export:', error);
      return false;
    }
  }

  /**
   * Clean up expired exports (called by cron job)
   */
  async cleanupExpiredExports(): Promise<number> {
    try {
      // Get expired exports
      const { data: expiredExports, error } = await supabase
        .from('data_exports')
        .select('id, user_id, storage_path')
        .lt('expires_at', new Date().toISOString())
        .in('status', ['completed', 'failed']);

      if (error) throw error;
      if (!expiredExports || expiredExports.length === 0) return 0;

      // Delete storage files
      const storagePaths = expiredExports
        .filter((e) => e.storage_path)
        .map((e) => e.storage_path!);

      if (storagePaths.length > 0) {
        await supabase.storage.from(this.STORAGE_BUCKET).remove(storagePaths);
      }

      // Mark as expired in database
      await supabase
        .from('data_exports')
        .update({ status: 'expired', file_url: null })
        .in(
          'id',
          expiredExports.map((e) => e.id)
        );

      console.log('[DataExport] Cleaned up expired exports:', expiredExports.length);
      return expiredExports.length;
    } catch (error) {
      console.error('[DataExport] Error cleaning up exports:', error);
      return 0;
    }
  }

  /**
   * Log activity to activity_logs table
   */
  private async logActivity(
    userId: string,
    actionType: string,
    actionDetail: string,
    metadata: any
  ): Promise<void> {
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action_type: actionType,
        action_detail: actionDetail,
        metadata,
      });
    } catch (error) {
      console.error('[DataExport] Error logging activity:', error);
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export singleton instance
export const dataExportService = new DataExportService();
export default dataExportService;
