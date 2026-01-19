import React, { useState, useCallback, useMemo } from 'react';

// Types
interface BackupEntry {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'messages' | 'contacts' | 'settings';
  size: number;
  createdAt: Date;
  status: 'completed' | 'in_progress' | 'failed' | 'scheduled';
  progress?: number;
  destination: 'local' | 'cloud' | 'drive' | 'dropbox';
  encrypted: boolean;
  itemCount: {
    messages: number;
    contacts: number;
    attachments: number;
  };
}

interface SyncDevice {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'web';
  lastSync: Date;
  status: 'synced' | 'syncing' | 'pending' | 'error';
  os: string;
}

interface BackupSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupTime: string;
  includeAttachments: boolean;
  encryptBackups: boolean;
  cloudProvider: 'none' | 'drive' | 'dropbox' | 'icloud';
  retentionDays: number;
}

interface SyncSettings {
  syncEnabled: boolean;
  syncMessages: boolean;
  syncContacts: boolean;
  syncSettings: boolean;
  syncAttachments: boolean;
  conflictResolution: 'newest' | 'oldest' | 'manual';
}

interface BackupSyncProps {
  onBackupCreate?: (type: BackupEntry['type']) => void;
  onBackupRestore?: (backupId: string) => void;
  onBackupDelete?: (backupId: string) => void;
  onSyncNow?: () => void;
  onSettingsChange?: (settings: BackupSettings & SyncSettings) => void;
}

// Mock data
const generateMockBackups = (): BackupEntry[] => [
  {
    id: '1',
    name: 'Full Backup - Jan 10, 2026',
    type: 'full',
    size: 156000000,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: 'completed',
    destination: 'cloud',
    encrypted: true,
    itemCount: { messages: 2847, contacts: 156, attachments: 423 }
  },
  {
    id: '2',
    name: 'Incremental - Jan 9, 2026',
    type: 'incremental',
    size: 12000000,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    status: 'completed',
    destination: 'cloud',
    encrypted: true,
    itemCount: { messages: 145, contacts: 3, attachments: 12 }
  },
  {
    id: '3',
    name: 'Messages Export',
    type: 'messages',
    size: 45000000,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    status: 'completed',
    destination: 'local',
    encrypted: false,
    itemCount: { messages: 2847, contacts: 0, attachments: 0 }
  },
  {
    id: '4',
    name: 'Scheduled Backup',
    type: 'full',
    size: 0,
    createdAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
    status: 'scheduled',
    destination: 'cloud',
    encrypted: true,
    itemCount: { messages: 0, contacts: 0, attachments: 0 }
  }
];

const generateMockDevices = (): SyncDevice[] => [
  {
    id: '1',
    name: 'MacBook Pro',
    type: 'desktop',
    lastSync: new Date(Date.now() - 1000 * 60 * 5),
    status: 'synced',
    os: 'macOS 14.2'
  },
  {
    id: '2',
    name: 'iPhone 15',
    type: 'mobile',
    lastSync: new Date(Date.now() - 1000 * 60 * 30),
    status: 'synced',
    os: 'iOS 17.2'
  },
  {
    id: '3',
    name: 'iPad Pro',
    type: 'tablet',
    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: 'pending',
    os: 'iPadOS 17.2'
  },
  {
    id: '4',
    name: 'Chrome Browser',
    type: 'web',
    lastSync: new Date(),
    status: 'syncing',
    os: 'Web'
  }
];

export const BackupSync: React.FC<BackupSyncProps> = ({
  onBackupCreate,
  onBackupRestore,
  onBackupDelete,
  onSyncNow,
  onSettingsChange
}) => {
  const [activeTab, setActiveTab] = useState<'backups' | 'sync' | 'settings'>('backups');
  const [backups, setBackups] = useState<BackupEntry[]>(generateMockBackups);
  const [devices] = useState<SyncDevice[]>(generateMockDevices);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    autoBackup: true,
    backupFrequency: 'daily',
    backupTime: '02:00',
    includeAttachments: true,
    encryptBackups: true,
    cloudProvider: 'drive',
    retentionDays: 30
  });
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    syncEnabled: true,
    syncMessages: true,
    syncContacts: true,
    syncSettings: true,
    syncAttachments: false,
    conflictResolution: 'newest'
  });

  const totalBackupSize = useMemo(() =>
    backups.filter(b => b.status === 'completed').reduce((sum, b) => sum + b.size, 0),
    [backups]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 0) {
      const futureSeconds = Math.abs(seconds);
      if (futureSeconds < 3600) return `in ${Math.floor(futureSeconds / 60)}m`;
      if (futureSeconds < 86400) return `in ${Math.floor(futureSeconds / 3600)}h`;
      return `in ${Math.floor(futureSeconds / 86400)}d`;
    }
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getDeviceIcon = (type: SyncDevice['type']): string => {
    const icons: Record<SyncDevice['type'], string> = {
      desktop: 'fa-desktop',
      mobile: 'fa-mobile-screen',
      tablet: 'fa-tablet-screen-button',
      web: 'fa-globe'
    };
    return icons[type];
  };

  const getStatusColor = (status: string): { bg: string; text: string } => {
    const colors: Record<string, { bg: string; text: string }> = {
      completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
      synced: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
      in_progress: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
      syncing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
      scheduled: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
      failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
      error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' }
    };
    return colors[status] || colors.pending;
  };

  const getBackupTypeIcon = (type: BackupEntry['type']): string => {
    const icons: Record<BackupEntry['type'], string> = {
      full: 'fa-database',
      incremental: 'fa-arrow-up-right-dots',
      messages: 'fa-comments',
      contacts: 'fa-address-book',
      settings: 'fa-gear'
    };
    return icons[type];
  };

  const getDestinationIcon = (dest: BackupEntry['destination']): string => {
    const icons: Record<BackupEntry['destination'], string> = {
      local: 'fa-hard-drive',
      cloud: 'fa-cloud',
      drive: 'fa-google-drive',
      dropbox: 'fa-dropbox'
    };
    return icons[dest];
  };

  const handleCreateBackup = useCallback(async (type: BackupEntry['type']) => {
    setIsCreatingBackup(true);
    setBackupProgress(0);

    // Simulate backup progress
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setBackupProgress(i);
    }

    const newBackup: BackupEntry = {
      id: Date.now().toString(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Backup - ${new Date().toLocaleDateString()}`,
      type,
      size: Math.floor(Math.random() * 100000000) + 10000000,
      createdAt: new Date(),
      status: 'completed',
      destination: backupSettings.cloudProvider === 'none' ? 'local' : 'cloud',
      encrypted: backupSettings.encryptBackups,
      itemCount: {
        messages: type === 'messages' || type === 'full' ? 2847 : 0,
        contacts: type === 'contacts' || type === 'full' ? 156 : 0,
        attachments: backupSettings.includeAttachments ? 423 : 0
      }
    };

    setBackups(prev => [newBackup, ...prev]);
    setIsCreatingBackup(false);
    onBackupCreate?.(type);
  }, [backupSettings, onBackupCreate]);

  const handleDeleteBackup = useCallback((id: string) => {
    setBackups(prev => prev.filter(b => b.id !== id));
    onBackupDelete?.(id);
  }, [onBackupDelete]);

  const updateBackupSetting = useCallback(<K extends keyof BackupSettings>(
    key: K,
    value: BackupSettings[K]
  ) => {
    setBackupSettings(prev => {
      const updated = { ...prev, [key]: value };
      onSettingsChange?.({ ...updated, ...syncSettings });
      return updated;
    });
  }, [syncSettings, onSettingsChange]);

  const updateSyncSetting = useCallback(<K extends keyof SyncSettings>(
    key: K,
    value: SyncSettings[K]
  ) => {
    setSyncSettings(prev => {
      const updated = { ...prev, [key]: value };
      onSettingsChange?.({ ...backupSettings, ...updated });
      return updated;
    });
  }, [backupSettings, onSettingsChange]);

  const syncedDevicesCount = useMemo(() =>
    devices.filter(d => d.status === 'synced').length,
    [devices]
  );

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 dark:from-cyan-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-cloud-arrow-up text-cyan-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Backup & Sync</p>
              <p className="text-xs text-zinc-500">{syncedDevicesCount}/{devices.length} devices synced</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{formatFileSize(totalBackupSize)}</p>
            <p className="text-xs text-zinc-500">Total backed up</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => handleCreateBackup('full')}
            disabled={isCreatingBackup}
            className="flex-1 py-2 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 disabled:opacity-50 transition"
          >
            <i className="fa-solid fa-plus mr-1" />
            New Backup
          </button>
          <button
            onClick={onSyncNow}
            className="flex-1 py-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition"
          >
            <i className="fa-solid fa-rotate mr-1" />
            Sync Now
          </button>
        </div>
      </div>

      {/* Backup Progress */}
      {isCreatingBackup && (
        <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-cyan-700 dark:text-cyan-300 font-medium">Creating backup...</span>
            <span className="text-cyan-600">{backupProgress}%</span>
          </div>
          <div className="h-2 bg-white dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all"
              style={{ width: `${backupProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        {[
          { id: 'backups' as const, label: 'Backups', icon: 'fa-database' },
          { id: 'sync' as const, label: 'Devices', icon: 'fa-arrows-rotate' },
          { id: 'settings' as const, label: 'Settings', icon: 'fa-gear' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'backups' && (
        <div className="space-y-2">
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <i className="fa-solid fa-database text-zinc-300 text-3xl mb-3" />
              <p className="text-sm text-zinc-500">No backups yet</p>
            </div>
          ) : (
            backups.map(backup => {
              const statusColors = getStatusColor(backup.status);
              return (
                <div
                  key={backup.id}
                  className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                        <i className={`fa-solid ${getBackupTypeIcon(backup.type)} text-cyan-600 dark:text-cyan-400 text-sm`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{backup.name}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <i className={`fa-solid ${getDestinationIcon(backup.destination)}`} />
                          <span>{formatTimeAgo(backup.createdAt)}</span>
                          {backup.encrypted && <i className="fa-solid fa-lock text-green-500" />}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                      {backup.status.replace('_', ' ')}
                    </span>
                  </div>

                  {backup.status === 'completed' && (
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-zinc-500">
                        <span>{formatFileSize(backup.size)}</span>
                        <span>{backup.itemCount.messages} msgs</span>
                        <span>{backup.itemCount.contacts} contacts</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => onBackupRestore?.(backup.id)}
                          className="px-2 py-1 text-xs text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {backup.status === 'in_progress' && backup.progress !== undefined && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all"
                          style={{ width: `${backup.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Backup Type Options */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-500 mb-2">Create backup</p>
            <div className="grid grid-cols-2 gap-2">
              {(['messages', 'contacts', 'settings', 'full'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleCreateBackup(type)}
                  disabled={isCreatingBackup}
                  className="p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition"
                >
                  <i className={`fa-solid ${getBackupTypeIcon(type)} mr-1`} />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-2">
          {devices.map(device => {
            const statusColors = getStatusColor(device.status);
            return (
              <div
                key={device.id}
                className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                      <i className={`fa-solid ${getDeviceIcon(device.type)} text-zinc-600 dark:text-zinc-400`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{device.name}</p>
                      <p className="text-xs text-zinc-500">{device.os}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                      {device.status === 'syncing' && <i className="fa-solid fa-circle-notch fa-spin mr-1" />}
                      {device.status}
                    </span>
                    <p className="text-xs text-zinc-400 mt-1">{formatTimeAgo(device.lastSync)}</p>
                  </div>
                </div>
              </div>
            );
          })}

          <button className="w-full p-3 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-500 hover:border-cyan-300 dark:hover:border-cyan-700 hover:text-cyan-600 transition">
            <i className="fa-solid fa-plus mr-1" />
            Add new device
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Backup Settings */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Backup Settings</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Auto backup</span>
                <button
                  onClick={() => updateBackupSetting('autoBackup', !backupSettings.autoBackup)}
                  className={`w-10 h-5 rounded-full transition-colors ${backupSettings.autoBackup ? 'bg-cyan-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${backupSettings.autoBackup ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {backupSettings.autoBackup && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Frequency</span>
                    <select
                      value={backupSettings.backupFrequency}
                      onChange={(e) => updateBackupSetting('backupFrequency', e.target.value as BackupSettings['backupFrequency'])}
                      className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Time</span>
                    <input
                      type="time"
                      value={backupSettings.backupTime}
                      onChange={(e) => updateBackupSetting('backupTime', e.target.value)}
                      className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Include attachments</span>
                <button
                  onClick={() => updateBackupSetting('includeAttachments', !backupSettings.includeAttachments)}
                  className={`w-10 h-5 rounded-full transition-colors ${backupSettings.includeAttachments ? 'bg-cyan-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${backupSettings.includeAttachments ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Encrypt backups</span>
                <button
                  onClick={() => updateBackupSetting('encryptBackups', !backupSettings.encryptBackups)}
                  className={`w-10 h-5 rounded-full transition-colors ${backupSettings.encryptBackups ? 'bg-cyan-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${backupSettings.encryptBackups ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Sync Settings */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Sync Settings</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Enable sync</span>
                <button
                  onClick={() => updateSyncSetting('syncEnabled', !syncSettings.syncEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors ${syncSettings.syncEnabled ? 'bg-cyan-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${syncSettings.syncEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {syncSettings.syncEnabled && (
                <>
                  {(['syncMessages', 'syncContacts', 'syncSettings', 'syncAttachments'] as const).map(key => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">
                        {key.replace('sync', 'Sync ')}
                      </span>
                      <button
                        onClick={() => updateSyncSetting(key, !syncSettings[key])}
                        className={`w-10 h-5 rounded-full transition-colors ${syncSettings[key] ? 'bg-cyan-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${syncSettings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Conflict resolution</span>
                    <select
                      value={syncSettings.conflictResolution}
                      onChange={(e) => updateSyncSetting('conflictResolution', e.target.value as SyncSettings['conflictResolution'])}
                      className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                    >
                      <option value="newest">Keep newest</option>
                      <option value="oldest">Keep oldest</option>
                      <option value="manual">Ask me</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sync Status Indicator
interface SyncStatusIndicatorProps {
  status: 'synced' | 'syncing' | 'error';
  onClick?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ status, onClick }) => {
  const statusConfig = {
    synced: { icon: 'fa-check', color: 'text-green-500' },
    syncing: { icon: 'fa-circle-notch fa-spin', color: 'text-blue-500' },
    error: { icon: 'fa-exclamation-triangle', color: 'text-red-500' }
  };

  const config = statusConfig[status];

  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
      title={`Sync status: ${status}`}
    >
      <i className={`fa-solid ${config.icon} ${config.color}`} />
    </button>
  );
};
