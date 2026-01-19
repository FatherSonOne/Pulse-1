/**
 * Google Drive Service for Pulse Archives
 * Handles folder creation, file uploads, and sync with "Pulse Archives" folder structure
 */

import { supabase } from './supabase';
import type { ArchiveItem, ArchiveType, DriveFolder, DriveExportSettings } from '../types';

// Default folder structure for Pulse Archives
const DEFAULT_FOLDER_STRUCTURE: DriveExportSettings['folderStructure'] = {
  transcripts: 'Message Transcripts',
  voxTranscripts: 'Vox Transcripts',
  voxSummaries: 'Vox Summaries',
  meetingNotes: 'Meeting Notes',
  decisionLogs: 'Decision Logs',
  journals: 'Journals',
  aiSummaries: 'AI Summaries',
  images: 'Images',
  videos: 'Videos',
  documents: 'Documents',
  artifacts: 'Artifacts',
};

// Map archive types to folder names
const TYPE_TO_FOLDER: Record<ArchiveType, keyof DriveExportSettings['folderStructure']> = {
  transcript: 'transcripts',
  vox_transcript: 'voxTranscripts',
  summary: 'voxSummaries',
  meeting_note: 'meetingNotes',
  decision_log: 'decisionLogs',
  journal: 'journals',
  artifact: 'artifacts',
  research: 'documents',
  image: 'images',
  video: 'videos',
  document: 'documents',
};

class GoogleDriveService {
  private accessToken: string | null = null;
  private settings: DriveExportSettings | null = null;
  private folderCache: Map<string, DriveFolder> = new Map();

  /**
   * Initialize the service and load settings
   */
  async initialize(): Promise<boolean> {
    try {
      // Get access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.provider_token) {
        console.warn('No Google access token available. User may need to re-authenticate.');
        return false;
      }

      this.accessToken = session.provider_token;
      await this.loadSettings();
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      return false;
    }
  }

  /**
   * Check if user is connected to Google Drive
   */
  async isConnected(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session?.provider_token;
    } catch {
      return false;
    }
  }

  /**
   * Load export settings from database
   */
  private async loadSettings(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('drive_export_settings')
      .eq('user_id', user.id)
      .single();

    if (data?.drive_export_settings) {
      this.settings = data.drive_export_settings;
    } else {
      // Create default settings
      this.settings = {
        enabled: false,
        autoSync: false,
        folderStructure: DEFAULT_FOLDER_STRUCTURE,
        syncFrequency: 'manual',
      };
    }
  }

  /**
   * Save export settings to database
   */
  async saveSettings(settings: Partial<DriveExportSettings>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    this.settings = { ...this.settings!, ...settings };

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        drive_export_settings: this.settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return !error;
  }

  /**
   * Get current export settings
   */
  getSettings(): DriveExportSettings | null {
    return this.settings;
  }

  /**
   * Make authenticated request to Google Drive API
   */
  private async driveRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://www.googleapis.com/drive/v3${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(name: string, parentId?: string): Promise<DriveFolder | null> {
    try {
      const metadata: Record<string, unknown> = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentId) {
        metadata.parents = [parentId];
      }

      const response = await this.driveRequest('/files', {
        method: 'POST',
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        console.error('Failed to create folder:', await response.text());
        return null;
      }

      const folder = await response.json();

      const driveFolder: DriveFolder = {
        id: folder.id,
        name: folder.name,
        parentId,
        webViewLink: folder.webViewLink,
      };

      this.folderCache.set(name + (parentId || ''), driveFolder);
      return driveFolder;
    } catch (error) {
      console.error('Error creating folder:', error);
      return null;
    }
  }

  /**
   * Find a folder by name and parent
   */
  async findFolder(name: string, parentId?: string): Promise<DriveFolder | null> {
    const cacheKey = name + (parentId || '');
    if (this.folderCache.has(cacheKey)) {
      return this.folderCache.get(cacheKey)!;
    }

    try {
      let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }

      const response = await this.driveRequest(
        `/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data.files && data.files.length > 0) {
        const folder: DriveFolder = {
          id: data.files[0].id,
          name: data.files[0].name,
          parentId,
          webViewLink: data.files[0].webViewLink,
        };
        this.folderCache.set(cacheKey, folder);
        return folder;
      }

      return null;
    } catch (error) {
      console.error('Error finding folder:', error);
      return null;
    }
  }

  /**
   * Get or create a folder (find first, create if not exists)
   */
  async getOrCreateFolder(name: string, parentId?: string): Promise<DriveFolder | null> {
    const existing = await this.findFolder(name, parentId);
    if (existing) return existing;
    return this.createFolder(name, parentId);
  }

  /**
   * Set up the complete Pulse Archives folder structure
   */
  async setupFolderStructure(): Promise<{ success: boolean; rootFolderId?: string }> {
    try {
      // Create or find root "Pulse Archives" folder
      const rootFolder = await this.getOrCreateFolder('Pulse Archives');
      if (!rootFolder) {
        return { success: false };
      }

      // Create all subfolders
      const structure = this.settings?.folderStructure || DEFAULT_FOLDER_STRUCTURE;
      const folderPromises = Object.values(structure).map(folderName =>
        this.getOrCreateFolder(folderName, rootFolder.id)
      );

      await Promise.all(folderPromises);

      // Save the root folder ID to settings
      await this.saveSettings({
        enabled: true,
        rootFolderId: rootFolder.id,
      });

      return { success: true, rootFolderId: rootFolder.id };
    } catch (error) {
      console.error('Error setting up folder structure:', error);
      return { success: false };
    }
  }

  /**
   * Get the target folder for an archive type
   */
  async getTargetFolder(archiveType: ArchiveType): Promise<DriveFolder | null> {
    if (!this.settings?.rootFolderId) {
      const setup = await this.setupFolderStructure();
      if (!setup.success) return null;
    }

    const folderKey = TYPE_TO_FOLDER[archiveType];
    const folderName = this.settings!.folderStructure[folderKey];

    return this.findFolder(folderName, this.settings!.rootFolderId);
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    content: string | Blob,
    fileName: string,
    mimeType: string,
    folderId: string
  ): Promise<{ id: string; webViewLink: string } | null> {
    try {
      const metadata = {
        name: fileName,
        parents: [folderId],
      };

      // Use multipart upload for files with content
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const contentData = typeof content === 'string'
        ? content
        : await this.blobToBase64(content);

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        (typeof content === 'string' ? btoa(unescape(encodeURIComponent(content))) : contentData) +
        closeDelimiter;

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (!response.ok) {
        console.error('Failed to upload file:', await response.text());
        return null;
      }

      return response.json();
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  }

  /**
   * Convert Blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Export a single archive item to Google Drive
   */
  async exportArchiveItem(item: ArchiveItem): Promise<{
    success: boolean;
    fileId?: string;
    webViewLink?: string;
    error?: string;
  }> {
    try {
      if (!await this.isConnected()) {
        return { success: false, error: 'Not connected to Google Drive' };
      }

      await this.initialize();

      // Get the target folder for this archive type
      const folder = await this.getTargetFolder(item.type);
      if (!folder) {
        return { success: false, error: 'Could not find or create target folder' };
      }

      // Generate file name with date
      const dateStr = item.date.toISOString().split('T')[0];
      const sanitizedTitle = item.title.replace(/[^a-zA-Z0-9-_ ]/g, '').substring(0, 50);
      const fileName = `${dateStr}_${sanitizedTitle}.txt`;

      // Prepare content
      const content = this.formatArchiveContent(item);

      // Upload the file
      const result = await this.uploadFile(content, fileName, 'text/plain', folder.id);

      if (result) {
        // Update the archive item with Drive info
        await this.updateArchiveWithDriveInfo(item.id, result.id, folder.id);

        return {
          success: true,
          fileId: result.id,
          webViewLink: result.webViewLink,
        };
      }

      return { success: false, error: 'Upload failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Format archive content for export
   */
  private formatArchiveContent(item: ArchiveItem): string {
    const lines = [
      `Title: ${item.title}`,
      `Type: ${item.type.replace('_', ' ').toUpperCase()}`,
      `Date: ${item.date.toLocaleString()}`,
      item.tags?.length ? `Tags: ${item.tags.join(', ')}` : '',
      item.decisionStatus ? `Status: ${item.decisionStatus}` : '',
      '',
      '---',
      '',
      item.content,
      '',
      '---',
      `Exported from Pulse on ${new Date().toLocaleString()}`,
    ];

    return lines.filter(Boolean).join('\n');
  }

  /**
   * Update archive item with Drive export info
   */
  private async updateArchiveWithDriveInfo(
    archiveId: string,
    driveFileId: string,
    driveFolderId: string
  ): Promise<void> {
    await supabase
      .from('archives')
      .update({
        drive_file_id: driveFileId,
        drive_folder_id: driveFolderId,
        exported_at: new Date().toISOString(),
      })
      .eq('id', archiveId);
  }

  /**
   * Export multiple archive items to Google Drive
   */
  async exportBulk(
    items: ArchiveItem[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < items.length; i++) {
      const result = await this.exportArchiveItem(items[i]);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${items[i].title}: ${result.error}`);
      }

      onProgress?.(i + 1, items.length);
    }

    // Update last sync time
    await this.saveSettings({ lastSyncAt: new Date() });

    return results;
  }

  /**
   * Export all archives to Google Drive
   */
  async exportAll(
    onProgress?: (completed: number, total: number) => void
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: 0, failed: 0, errors: ['Not authenticated'] };
    }

    // Get all archives that haven't been exported yet
    const { data: archives, error } = await supabase
      .from('archives')
      .select('*')
      .eq('user_id', user.id)
      .is('drive_file_id', null)
      .order('date', { ascending: false });

    if (error || !archives) {
      return { success: 0, failed: 0, errors: [error?.message || 'Failed to fetch archives'] };
    }

    // Convert to ArchiveItem format
    const items: ArchiveItem[] = archives.map(db => ({
      id: db.id,
      type: db.archive_type,
      title: db.title,
      content: db.content,
      date: new Date(db.date),
      tags: db.tags || [],
      relatedContactId: db.related_contact_id,
      decisionStatus: db.decision_status,
    }));

    return this.exportBulk(items, onProgress);
  }

  /**
   * Get the web link for the Pulse Archives folder
   */
  async getRootFolderLink(): Promise<string | null> {
    if (!this.settings?.rootFolderId) return null;

    try {
      const response = await this.driveRequest(
        `/files/${this.settings.rootFolderId}?fields=webViewLink`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data.webViewLink;
    } catch {
      return null;
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const response = await this.driveRequest(`/files/${fileId}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get export statistics
   */
  async getExportStats(): Promise<{
    totalExported: number;
    lastExportedAt?: Date;
    storageUsed?: number;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { totalExported: 0 };
    }

    const { count } = await supabase
      .from('archives')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('drive_file_id', 'is', null);

    const { data: latest } = await supabase
      .from('archives')
      .select('exported_at')
      .eq('user_id', user.id)
      .not('exported_at', 'is', null)
      .order('exported_at', { ascending: false })
      .limit(1)
      .single();

    return {
      totalExported: count || 0,
      lastExportedAt: latest?.exported_at ? new Date(latest.exported_at) : undefined,
    };
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();
