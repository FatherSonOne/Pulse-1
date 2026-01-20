import { supabase } from './supabase';

/**
 * Backup and Sync Service
 * Handles data backup, restoration, and cross-device synchronization using Supabase
 */

// ==================== Types ====================

export type BackupType = 'full' | 'incremental' | 'messages' | 'contacts' | 'settings';
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

export interface BackupEntry {
  id: string;
  user_id: string;
  name: string;
  type: BackupType;
  size: number;
  created_at: string;
  completed_at?: string;
  status: BackupStatus;
  progress?: number;
  error_message?: string;
  storage_path: string;
  encrypted: boolean;
  item_count: {
    messages: number;
    contacts: number;
    attachments: number;
  };
  metadata?: Record<string, any>;
}

export interface SyncDevice {
  id: string;
  user_id: string;
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'web';
  device_os: string;
  last_sync: string;
  status: SyncStatus;
  sync_enabled: boolean;
  created_at: string;
}

export interface BackupSettings {
  auto_backup: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  backup_time: string;
  include_attachments: boolean;
  encrypt_backups: boolean;
  retention_days: number;
}

export interface SyncSettings {
  sync_enabled: boolean;
  sync_messages: boolean;
  sync_contacts: boolean;
  sync_settings: boolean;
  sync_attachments: boolean;
  conflict_resolution: 'newest' | 'oldest' | 'manual';
}

export interface BackupData {
  messages?: any[];
  contacts?: any[];
  settings?: any;
  attachments?: any[];
  metadata: {
    created_at: string;
    version: string;
    user_id: string;
  };
}

export interface RestoreResult {
  success: boolean;
  restored_items: {
    messages: number;
    contacts: number;
    settings: number;
    attachments: number;
  };
  errors?: string[];
}

// ==================== Backup Service ====================

export class BackupSyncService {
  /**
   * Create a new backup
   */
  async createBackup(
    userId: string,
    type: BackupType,
    settings: BackupSettings,
    onProgress?: (progress: number) => void
  ): Promise<BackupEntry> {
    try {
      // Gather data based on backup type
      const data = await this.gatherBackupData(userId, type, settings);

      // Calculate size
      const dataString = JSON.stringify(data);
      const size = new Blob([dataString]).size;

      // Create backup entry
      const { data: backupEntry, error: createError } = await supabase
        .from('backups')
        .insert([
          {
            user_id: userId,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Backup - ${new Date().toLocaleDateString()}`,
            type,
            size,
            status: 'in_progress',
            progress: 0,
            encrypted: settings.encrypt_backups,
            item_count: {
              messages: data.messages?.length || 0,
              contacts: data.contacts?.length || 0,
              attachments: data.attachments?.length || 0
            },
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create backup entry: ${createError.message}`);
      }

      // Encrypt data if requested
      let finalData = dataString;
      if (settings.encrypt_backups) {
        finalData = await this.encryptData(dataString, userId);
      }

      // Upload to storage
      const storagePath = `backups/${userId}/${backupEntry.id}.json${settings.encrypt_backups ? '.enc' : ''}`;

      onProgress?.(50);

      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(storagePath, new Blob([finalData]), {
          contentType: 'application/json',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload backup: ${uploadError.message}`);
      }

      onProgress?.(90);

      // Update backup entry as completed
      const { data: completedBackup, error: updateError } = await supabase
        .from('backups')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          storage_path: storagePath
        })
        .eq('id', backupEntry.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update backup status:', updateError);
      }

      onProgress?.(100);

      return completedBackup || backupEntry;
    } catch (error: any) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  /**
   * Gather data for backup based on type
   */
  private async gatherBackupData(
    userId: string,
    type: BackupType,
    settings: BackupSettings
  ): Promise<BackupData> {
    const data: BackupData = {
      metadata: {
        created_at: new Date().toISOString(),
        version: '1.0',
        user_id: userId
      }
    };

    try {
      // Gather messages
      if (type === 'messages' || type === 'full') {
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('user_id', userId);
        data.messages = messages || [];
      }

      // Gather contacts
      if (type === 'contacts' || type === 'full') {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', userId);
        data.contacts = contacts || [];
      }

      // Gather settings
      if (type === 'settings' || type === 'full') {
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
        data.settings = userSettings;
      }

      // Gather attachments metadata
      if (settings.include_attachments && (type === 'full' || type === 'messages')) {
        const { data: attachments } = await supabase
          .from('file_uploads')
          .select('*')
          .eq('user_id', userId);
        data.attachments = attachments || [];
      }

      return data;
    } catch (error: any) {
      console.error('Failed to gather backup data:', error);
      throw error;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(
    backupId: string,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      restored_items: {
        messages: 0,
        contacts: 0,
        settings: 0,
        attachments: 0
      },
      errors: []
    };

    try {
      // Get backup entry
      const { data: backup, error: fetchError } = await supabase
        .from('backups')
        .select('*')
        .eq('id', backupId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !backup) {
        throw new Error('Backup not found');
      }

      onProgress?.(10);

      // Download backup data
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('backups')
        .download(backup.storage_path);

      if (downloadError) {
        throw new Error(`Failed to download backup: ${downloadError.message}`);
      }

      onProgress?.(30);

      // Read and parse data
      const dataString = await fileData.text();

      // Decrypt if encrypted
      let finalDataString = dataString;
      if (backup.encrypted) {
        finalDataString = await this.decryptData(dataString, userId);
      }

      const data: BackupData = JSON.parse(finalDataString);

      onProgress?.(50);

      // Restore messages
      if (data.messages && data.messages.length > 0) {
        const { error: messagesError } = await supabase
          .from('messages')
          .upsert(data.messages, { onConflict: 'id' });

        if (messagesError) {
          result.errors?.push(`Messages: ${messagesError.message}`);
        } else {
          result.restored_items.messages = data.messages.length;
        }
      }

      onProgress?.(70);

      // Restore contacts
      if (data.contacts && data.contacts.length > 0) {
        const { error: contactsError } = await supabase
          .from('contacts')
          .upsert(data.contacts, { onConflict: 'id' });

        if (contactsError) {
          result.errors?.push(`Contacts: ${contactsError.message}`);
        } else {
          result.restored_items.contacts = data.contacts.length;
        }
      }

      onProgress?.(85);

      // Restore settings
      if (data.settings) {
        const { error: settingsError } = await supabase
          .from('user_settings')
          .upsert(data.settings, { onConflict: 'user_id' });

        if (settingsError) {
          result.errors?.push(`Settings: ${settingsError.message}`);
        } else {
          result.restored_items.settings = 1;
        }
      }

      onProgress?.(100);

      result.success = (result.errors?.length || 0) === 0;
      return result;
    } catch (error: any) {
      console.error('Restore failed:', error);
      result.errors?.push(error.message);
      return result;
    }
  }

  /**
   * List backups for a user
   */
  async listBackups(userId: string): Promise<BackupEntry[]> {
    const { data, error } = await supabase
      .from('backups')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list backups: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string, userId: string): Promise<void> {
    // Get backup info
    const { data: backup, error: fetchError } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !backup) {
      throw new Error('Backup not found');
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('backups')
      .remove([backup.storage_path]);

    if (storageError) {
      console.error('Failed to delete backup file:', storageError);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('backups')
      .delete()
      .eq('id', backupId);

    if (deleteError) {
      throw new Error(`Failed to delete backup: ${deleteError.message}`);
    }
  }

  /**
   * Get backup settings for user
   */
  async getBackupSettings(userId: string): Promise<BackupSettings> {
    const { data, error } = await supabase
      .from('backup_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get backup settings:', error);
    }

    return data || {
      auto_backup: false,
      backup_frequency: 'weekly',
      backup_time: '02:00',
      include_attachments: true,
      encrypt_backups: true,
      retention_days: 30
    };
  }

  /**
   * Update backup settings
   */
  async updateBackupSettings(userId: string, settings: BackupSettings): Promise<void> {
    const { error } = await supabase
      .from('backup_settings')
      .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' });

    if (error) {
      throw new Error(`Failed to update backup settings: ${error.message}`);
    }
  }

  // ==================== Sync Methods ====================

  /**
   * Register a device for sync
   */
  async registerDevice(
    userId: string,
    deviceName: string,
    deviceType: SyncDevice['device_type'],
    deviceOs: string
  ): Promise<SyncDevice> {
    const { data, error } = await supabase
      .from('sync_devices')
      .insert([
        {
          user_id: userId,
          device_name: deviceName,
          device_type: deviceType,
          device_os: deviceOs,
          last_sync: new Date().toISOString(),
          status: 'synced',
          sync_enabled: true,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to register device: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all devices for a user
   */
  async listDevices(userId: string): Promise<SyncDevice[]> {
    const { data, error } = await supabase
      .from('sync_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_sync', { ascending: false });

    if (error) {
      throw new Error(`Failed to list devices: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update device sync status
   */
  async updateDeviceSync(deviceId: string, status: SyncStatus): Promise<void> {
    const { error } = await supabase
      .from('sync_devices')
      .update({
        status,
        last_sync: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (error) {
      throw new Error(`Failed to update device sync: ${error.message}`);
    }
  }

  /**
   * Perform sync operation
   */
  async syncData(
    userId: string,
    deviceId: string,
    syncSettings: SyncSettings
  ): Promise<{ success: boolean; synced_items: number }> {
    try {
      // Update device status to syncing
      await this.updateDeviceSync(deviceId, 'syncing');

      let syncedItems = 0;

      // Sync messages
      if (syncSettings.sync_messages) {
        // This would implement delta sync logic
        // For now, we just verify the data exists
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        syncedItems += count || 0;
      }

      // Sync contacts
      if (syncSettings.sync_contacts) {
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        syncedItems += count || 0;
      }

      // Update device status to synced
      await this.updateDeviceSync(deviceId, 'synced');

      return { success: true, synced_items: syncedItems };
    } catch (error: any) {
      console.error('Sync failed:', error);
      await this.updateDeviceSync(deviceId, 'error');
      return { success: false, synced_items: 0 };
    }
  }

  /**
   * Get sync settings for user
   */
  async getSyncSettings(userId: string): Promise<SyncSettings> {
    const { data, error } = await supabase
      .from('sync_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get sync settings:', error);
    }

    return data || {
      sync_enabled: true,
      sync_messages: true,
      sync_contacts: true,
      sync_settings: true,
      sync_attachments: false,
      conflict_resolution: 'newest'
    };
  }

  /**
   * Update sync settings
   */
  async updateSyncSettings(userId: string, settings: SyncSettings): Promise<void> {
    const { error } = await supabase
      .from('sync_settings')
      .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' });

    if (error) {
      throw new Error(`Failed to update sync settings: ${error.message}`);
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Encrypt data (placeholder - implement with actual encryption)
   */
  private async encryptData(data: string, userId: string): Promise<string> {
    // TODO: Implement proper encryption using a secure library
    // For now, just return the data (NOT SECURE - only for demo)
    console.warn('Encryption not implemented - data is not actually encrypted');
    return btoa(data); // Base64 encoding (NOT encryption)
  }

  /**
   * Decrypt data (placeholder - implement with actual decryption)
   */
  private async decryptData(encryptedData: string, userId: string): Promise<string> {
    // TODO: Implement proper decryption
    // For now, just decode base64
    console.warn('Decryption not implemented - data was not actually encrypted');
    return atob(encryptedData); // Base64 decoding (NOT decryption)
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

// Export singleton instance
export const backupSyncService = new BackupSyncService();
