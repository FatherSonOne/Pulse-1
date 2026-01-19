import React, { useState, useCallback, useMemo } from 'react';

// Types
interface EncryptionSettings {
  enabled: boolean;
  algorithm: 'AES-256' | 'RSA-2048' | 'ChaCha20';
  autoEncrypt: boolean;
  keyExpiryDays: number;
  allowScreenshots: boolean;
  selfDestructEnabled: boolean;
  selfDestructMinutes: number;
}

interface PrivacySettings {
  hideTypingIndicator: boolean;
  hideReadReceipts: boolean;
  hideOnlineStatus: boolean;
  hideLastSeen: boolean;
  blurPreviews: boolean;
  requireAuth: boolean;
  authMethod: 'pin' | 'biometric' | 'password';
}

interface EncryptedMessage {
  id: string;
  contactName: string;
  preview: string;
  timestamp: Date;
  expiresAt?: Date;
  isDecrypted: boolean;
}

interface SecurityEvent {
  id: string;
  type: 'key_generated' | 'key_exchanged' | 'message_encrypted' | 'message_decrypted' | 'key_expired' | 'auth_failed' | 'screenshot_blocked';
  description: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error';
}

interface MessageEncryptionProps {
  onSettingsChange?: (settings: EncryptionSettings & PrivacySettings) => void;
  onGenerateKey?: () => void;
  onExportKey?: () => void;
}

// Mock data generators
const generateMockEncryptedMessages = (): EncryptedMessage[] => [
  {
    id: '1',
    contactName: 'Alice Chen',
    preview: 'Encrypted: Financial documents attached...',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    isDecrypted: false
  },
  {
    id: '2',
    contactName: 'Bob Smith',
    preview: 'Encrypted: Meeting credentials for tomorrow...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    isDecrypted: true
  },
  {
    id: '3',
    contactName: 'Carol Davis',
    preview: 'Encrypted: API keys for the new project...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    isDecrypted: false
  }
];

const generateMockSecurityEvents = (): SecurityEvent[] => [
  {
    id: '1',
    type: 'key_generated',
    description: 'New encryption key pair generated',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    severity: 'info'
  },
  {
    id: '2',
    type: 'key_exchanged',
    description: 'Key exchanged with Alice Chen',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    severity: 'info'
  },
  {
    id: '3',
    type: 'screenshot_blocked',
    description: 'Screenshot attempt blocked in secure chat',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    severity: 'warning'
  },
  {
    id: '4',
    type: 'auth_failed',
    description: 'Failed authentication attempt (3 remaining)',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    severity: 'error'
  },
  {
    id: '5',
    type: 'message_encrypted',
    description: '15 messages encrypted today',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    severity: 'info'
  }
];

export const MessageEncryption: React.FC<MessageEncryptionProps> = ({
  onSettingsChange,
  onGenerateKey,
  onExportKey
}) => {
  const [activeTab, setActiveTab] = useState<'encryption' | 'privacy' | 'messages' | 'log'>('encryption');
  const [encryptionSettings, setEncryptionSettings] = useState<EncryptionSettings>({
    enabled: true,
    algorithm: 'AES-256',
    autoEncrypt: false,
    keyExpiryDays: 30,
    allowScreenshots: false,
    selfDestructEnabled: false,
    selfDestructMinutes: 5
  });
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    hideTypingIndicator: false,
    hideReadReceipts: false,
    hideOnlineStatus: false,
    hideLastSeen: false,
    blurPreviews: true,
    requireAuth: false,
    authMethod: 'pin'
  });
  const [encryptedMessages] = useState<EncryptedMessage[]>(generateMockEncryptedMessages);
  const [securityEvents] = useState<SecurityEvent[]>(generateMockSecurityEvents);
  const [showKeyInfo, setShowKeyInfo] = useState(false);

  const updateEncryptionSetting = useCallback(<K extends keyof EncryptionSettings>(
    key: K,
    value: EncryptionSettings[K]
  ) => {
    setEncryptionSettings(prev => {
      const updated = { ...prev, [key]: value };
      onSettingsChange?.({ ...updated, ...privacySettings });
      return updated;
    });
  }, [privacySettings, onSettingsChange]);

  const updatePrivacySetting = useCallback(<K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => {
    setPrivacySettings(prev => {
      const updated = { ...prev, [key]: value };
      onSettingsChange?.({ ...encryptionSettings, ...updated });
      return updated;
    });
  }, [encryptionSettings, onSettingsChange]);

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatTimeRemaining = (date: Date): string => {
    const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
    if (seconds <= 0) return 'Expired';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const securityScore = useMemo(() => {
    let score = 50;
    if (encryptionSettings.enabled) score += 15;
    if (encryptionSettings.algorithm === 'AES-256') score += 10;
    if (!encryptionSettings.allowScreenshots) score += 5;
    if (privacySettings.hideReadReceipts) score += 5;
    if (privacySettings.hideOnlineStatus) score += 5;
    if (privacySettings.requireAuth) score += 10;
    return Math.min(100, score);
  }, [encryptionSettings, privacySettings]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSeverityColor = (severity: SecurityEvent['severity']): string => {
    switch (severity) {
      case 'info': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'warning': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'error': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
    }
  };

  const getEventIcon = (type: SecurityEvent['type']): string => {
    switch (type) {
      case 'key_generated': return 'fa-key';
      case 'key_exchanged': return 'fa-handshake';
      case 'message_encrypted': return 'fa-lock';
      case 'message_decrypted': return 'fa-unlock';
      case 'key_expired': return 'fa-clock';
      case 'auth_failed': return 'fa-shield-xmark';
      case 'screenshot_blocked': return 'fa-camera-slash';
      default: return 'fa-circle-info';
    }
  };

  return (
    <div className="space-y-4">
      {/* Security Score Header */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 dark:from-emerald-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-shield-halved text-emerald-500 text-xl" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Security Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(securityScore)}`}>{securityScore}/100</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowKeyInfo(!showKeyInfo)}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition border border-zinc-200 dark:border-zinc-700"
            >
              <i className="fa-solid fa-key mr-1.5" />
              Key Info
            </button>
            <button
              onClick={onGenerateKey}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <i className="fa-solid fa-rotate mr-1.5" />
              Regenerate
            </button>
          </div>
        </div>

        {showKeyInfo && (
          <div className="mt-4 p-3 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-zinc-500">Public Key</p>
                <p className="font-mono text-zinc-700 dark:text-zinc-300 truncate">pk_a1b2c3d4e5f6...</p>
              </div>
              <div>
                <p className="text-zinc-500">Key Created</p>
                <p className="text-zinc-700 dark:text-zinc-300">Jan 5, 2026</p>
              </div>
              <div>
                <p className="text-zinc-500">Algorithm</p>
                <p className="text-zinc-700 dark:text-zinc-300">{encryptionSettings.algorithm}</p>
              </div>
              <div>
                <p className="text-zinc-500">Expires</p>
                <p className="text-zinc-700 dark:text-zinc-300">Feb 4, 2026</p>
              </div>
            </div>
            <button
              onClick={onExportKey}
              className="mt-3 w-full py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition"
            >
              <i className="fa-solid fa-download mr-1.5" />
              Export Public Key
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        {[
          { id: 'encryption' as const, label: 'Encryption', icon: 'fa-lock' },
          { id: 'privacy' as const, label: 'Privacy', icon: 'fa-eye-slash' },
          { id: 'messages' as const, label: 'Encrypted', icon: 'fa-envelope-circle-check' },
          { id: 'log' as const, label: 'Security Log', icon: 'fa-list-check' }
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
      {activeTab === 'encryption' && (
        <div className="space-y-4">
          {/* Encryption Toggle */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${encryptionSettings.enabled ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-zinc-100 dark:bg-zinc-700'}`}>
                <i className={`fa-solid fa-lock ${encryptionSettings.enabled ? 'text-emerald-600' : 'text-zinc-400'}`} />
              </div>
              <div>
                <p className="font-medium text-sm text-zinc-900 dark:text-white">End-to-End Encryption</p>
                <p className="text-xs text-zinc-500">Messages are encrypted before sending</p>
              </div>
            </div>
            <button
              onClick={() => updateEncryptionSetting('enabled', !encryptionSettings.enabled)}
              className={`w-12 h-6 rounded-full transition-colors ${encryptionSettings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${encryptionSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Algorithm Selection */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="font-medium text-sm text-zinc-900 dark:text-white mb-2">Encryption Algorithm</p>
            <div className="grid grid-cols-3 gap-2">
              {(['AES-256', 'RSA-2048', 'ChaCha20'] as const).map(algo => (
                <button
                  key={algo}
                  onClick={() => updateEncryptionSetting('algorithm', algo)}
                  className={`p-2 rounded-lg text-xs font-medium transition border ${
                    encryptionSettings.algorithm === algo
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-50 dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-emerald-300'
                  }`}
                >
                  {algo}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Settings */}
          <div className="space-y-2">
            {[
              { key: 'autoEncrypt' as const, label: 'Auto-encrypt new conversations', icon: 'fa-wand-magic-sparkles' },
              { key: 'allowScreenshots' as const, label: 'Allow screenshots in secure chats', icon: 'fa-camera' },
              { key: 'selfDestructEnabled' as const, label: 'Self-destructing messages', icon: 'fa-bomb' }
            ].map(setting => (
              <div key={setting.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${setting.icon} text-zinc-400 w-4`} />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{setting.label}</span>
                </div>
                <button
                  onClick={() => updateEncryptionSetting(setting.key, !encryptionSettings[setting.key])}
                  className={`w-10 h-5 rounded-full transition-colors ${encryptionSettings[setting.key] ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${encryptionSettings[setting.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Self-destruct Timer */}
          {encryptionSettings.selfDestructEnabled && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-2">
                <i className="fa-solid fa-clock mr-1.5" />
                Self-Destruct Timer
              </p>
              <div className="flex gap-2">
                {[1, 5, 15, 30, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => updateEncryptionSetting('selfDestructMinutes', mins)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
                      encryptionSettings.selfDestructMinutes === mins
                        ? 'bg-orange-500 text-white'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-orange-100'
                    }`}
                  >
                    {mins < 60 ? `${mins}m` : '1h'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="space-y-2">
          {[
            { key: 'hideTypingIndicator' as const, label: 'Hide typing indicator', description: 'Others won\'t see when you\'re typing', icon: 'fa-keyboard' },
            { key: 'hideReadReceipts' as const, label: 'Hide read receipts', description: 'Others won\'t see when you read messages', icon: 'fa-check-double' },
            { key: 'hideOnlineStatus' as const, label: 'Hide online status', description: 'Appear offline to all contacts', icon: 'fa-circle' },
            { key: 'hideLastSeen' as const, label: 'Hide last seen', description: 'Don\'t show when you were last active', icon: 'fa-clock' },
            { key: 'blurPreviews' as const, label: 'Blur message previews', description: 'Hide content in notifications', icon: 'fa-eye-slash' },
            { key: 'requireAuth' as const, label: 'Require authentication', description: 'Lock app with PIN/biometric', icon: 'fa-fingerprint' }
          ].map(setting => (
            <div key={setting.key} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                  <i className={`fa-solid ${setting.icon} text-zinc-500 text-sm`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{setting.label}</p>
                  <p className="text-xs text-zinc-500">{setting.description}</p>
                </div>
              </div>
              <button
                onClick={() => updatePrivacySetting(setting.key, !privacySettings[setting.key])}
                className={`w-10 h-5 rounded-full transition-colors ${privacySettings[setting.key] ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${privacySettings[setting.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}

          {/* Auth Method */}
          {privacySettings.requireAuth && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-2">Authentication Method</p>
              <div className="flex gap-2">
                {([
                  { id: 'pin' as const, label: 'PIN', icon: 'fa-hashtag' },
                  { id: 'biometric' as const, label: 'Biometric', icon: 'fa-fingerprint' },
                  { id: 'password' as const, label: 'Password', icon: 'fa-key' }
                ]).map(method => (
                  <button
                    key={method.id}
                    onClick={() => updatePrivacySetting('authMethod', method.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
                      privacySettings.authMethod === method.id
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-indigo-100'
                    }`}
                  >
                    <i className={`fa-solid ${method.icon}`} />
                    {method.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="space-y-2">
          {encryptedMessages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-lock text-zinc-400" />
              </div>
              <p className="text-sm text-zinc-500">No encrypted messages yet</p>
            </div>
          ) : (
            encryptedMessages.map(msg => (
              <div key={msg.id} className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${msg.isDecrypted ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-700'}`}>
                      <i className={`fa-solid ${msg.isDecrypted ? 'fa-unlock text-green-600' : 'fa-lock text-zinc-400'} text-sm`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{msg.contactName}</p>
                      <p className="text-xs text-zinc-500">{formatTimeAgo(msg.timestamp)}</p>
                    </div>
                  </div>
                  {msg.expiresAt && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      msg.expiresAt.getTime() - Date.now() < 1000 * 60 * 60
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      <i className="fa-solid fa-clock mr-1" />
                      {formatTimeRemaining(msg.expiresAt)}
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm ${msg.isDecrypted ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 italic blur-sm hover:blur-none transition-all cursor-pointer'}`}>
                  {msg.preview}
                </p>
                {!msg.isDecrypted && (
                  <button className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                    <i className="fa-solid fa-key mr-1" />
                    Decrypt message
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'log' && (
        <div className="space-y-2">
          {securityEvents.map(event => (
            <div key={event.id} className={`p-3 rounded-lg ${getSeverityColor(event.severity)}`}>
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${getEventIcon(event.type)}`} />
                <span className="text-sm font-medium">{event.description}</span>
              </div>
              <p className="text-xs mt-1 opacity-70">{formatTimeAgo(event.timestamp)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Privacy Shield Button Component
interface PrivacyShieldButtonProps {
  isSecure: boolean;
  onClick: () => void;
}

export const PrivacyShieldButton: React.FC<PrivacyShieldButtonProps> = ({ isSecure, onClick }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-lg transition ${
      isSecure
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
    }`}
    title={isSecure ? 'Encryption enabled' : 'Enable encryption'}
  >
    <i className={`fa-solid ${isSecure ? 'fa-shield-halved' : 'fa-shield'}`} />
  </button>
);
