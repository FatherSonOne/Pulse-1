import React, { useState, useCallback, useRef } from 'react';

// Types
interface NotificationSound {
  id: string;
  name: string;
  category: 'default' | 'minimal' | 'playful' | 'professional' | 'custom';
  previewUrl?: string;
  icon: string;
  duration: number; // in milliseconds
}

interface SoundPreference {
  eventType: 'new_message' | 'mention' | 'reaction' | 'urgent' | 'call' | 'system';
  soundId: string;
  volume: number;
  isEnabled: boolean;
}

interface NotificationSoundsProps {
  preferences?: SoundPreference[];
  onPreferenceChange?: (preference: SoundPreference) => void;
  onCustomSoundUpload?: (file: File) => void;
}

// Default sounds library
const soundLibrary: NotificationSound[] = [
  // Default category
  { id: 'default_chime', name: 'Chime', category: 'default', icon: 'fa-bell', duration: 500 },
  { id: 'default_ding', name: 'Ding', category: 'default', icon: 'fa-bell', duration: 300 },
  { id: 'default_pop', name: 'Pop', category: 'default', icon: 'fa-circle', duration: 200 },
  { id: 'default_swoosh', name: 'Swoosh', category: 'default', icon: 'fa-wind', duration: 400 },

  // Minimal category
  { id: 'minimal_tap', name: 'Soft Tap', category: 'minimal', icon: 'fa-hand-pointer', duration: 150 },
  { id: 'minimal_click', name: 'Click', category: 'minimal', icon: 'fa-circle-dot', duration: 100 },
  { id: 'minimal_blip', name: 'Blip', category: 'minimal', icon: 'fa-droplet', duration: 200 },
  { id: 'minimal_subtle', name: 'Subtle', category: 'minimal', icon: 'fa-volume-low', duration: 300 },

  // Playful category
  { id: 'playful_bubble', name: 'Bubble', category: 'playful', icon: 'fa-comment-dots', duration: 400 },
  { id: 'playful_sparkle', name: 'Sparkle', category: 'playful', icon: 'fa-sparkles', duration: 600 },
  { id: 'playful_bounce', name: 'Bounce', category: 'playful', icon: 'fa-basketball', duration: 500 },
  { id: 'playful_magic', name: 'Magic', category: 'playful', icon: 'fa-wand-magic-sparkles', duration: 700 },

  // Professional category
  { id: 'pro_tone', name: 'Tone', category: 'professional', icon: 'fa-briefcase', duration: 400 },
  { id: 'pro_alert', name: 'Alert', category: 'professional', icon: 'fa-triangle-exclamation', duration: 500 },
  { id: 'pro_notify', name: 'Notify', category: 'professional', icon: 'fa-bell-concierge', duration: 450 },
  { id: 'pro_gentle', name: 'Gentle', category: 'professional', icon: 'fa-feather', duration: 600 }
];

// Event types configuration
const eventTypes: { id: SoundPreference['eventType']; label: string; icon: string; description: string }[] = [
  { id: 'new_message', label: 'New Message', icon: 'fa-message', description: 'When you receive a new message' },
  { id: 'mention', label: 'Mention', icon: 'fa-at', description: 'When someone mentions you' },
  { id: 'reaction', label: 'Reaction', icon: 'fa-face-smile', description: 'When someone reacts to your message' },
  { id: 'urgent', label: 'Urgent', icon: 'fa-bolt', description: 'For urgent or priority messages' },
  { id: 'call', label: 'Incoming Call', icon: 'fa-phone', description: 'For incoming voice/video calls' },
  { id: 'system', label: 'System', icon: 'fa-gear', description: 'System notifications and alerts' }
];

// Default preferences
const defaultPreferences: SoundPreference[] = [
  { eventType: 'new_message', soundId: 'default_chime', volume: 80, isEnabled: true },
  { eventType: 'mention', soundId: 'default_ding', volume: 90, isEnabled: true },
  { eventType: 'reaction', soundId: 'minimal_tap', volume: 50, isEnabled: true },
  { eventType: 'urgent', soundId: 'pro_alert', volume: 100, isEnabled: true },
  { eventType: 'call', soundId: 'default_chime', volume: 100, isEnabled: true },
  { eventType: 'system', soundId: 'minimal_blip', volume: 60, isEnabled: true }
];

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  masterVolume: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  volumeSlider: {
    width: '100px',
    height: '4px',
    borderRadius: '2px',
    appearance: 'none' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    outline: 'none',
    cursor: 'pointer'
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '12px'
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  eventInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  eventIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px'
  },
  eventLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  eventDescription: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  toggle: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background-color 0.2s ease'
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    position: 'absolute' as const,
    top: '2px',
    transition: 'left 0.2s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  },
  soundSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  soundDropdown: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer'
  },
  previewButton: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    transition: 'all 0.2s ease'
  },
  volumeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '12px'
  },
  volumeLabel: {
    fontSize: '11px',
    color: '#64748b',
    width: '60px'
  },
  volumeBar: {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative' as const,
    cursor: 'pointer'
  },
  volumeFill: {
    height: '100%',
    borderRadius: '3px',
    backgroundColor: '#8B5CF6',
    transition: 'width 0.1s ease'
  },
  volumeValue: {
    fontSize: '11px',
    color: '#94a3b8',
    width: '40px',
    textAlign: 'right' as const
  },
  soundLibrary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px'
  },
  soundCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    padding: '12px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center' as const
  },
  soundCardSelected: {
    borderColor: 'rgba(139, 92, 246, 0.5)',
    backgroundColor: 'rgba(139, 92, 246, 0.1)'
  },
  soundIcon: {
    fontSize: '20px',
    marginBottom: '6px',
    color: '#94a3b8'
  },
  soundName: {
    fontSize: '11px',
    color: '#e2e8f0',
    fontWeight: 500
  },
  categoryLabel: {
    fontSize: '9px',
    color: '#64748b',
    marginTop: '2px',
    textTransform: 'capitalize' as const
  },
  uploadSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px dashed rgba(255, 255, 255, 0.2)',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  uploadIcon: {
    fontSize: '32px',
    color: '#64748b',
    marginBottom: '12px'
  },
  uploadText: {
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '4px'
  },
  uploadHint: {
    fontSize: '11px',
    color: '#64748b'
  },
  playingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  soundWave: {
    width: '3px',
    height: '12px',
    backgroundColor: '#8B5CF6',
    borderRadius: '2px',
    animation: 'soundWave 0.5s ease-in-out infinite alternate'
  }
};

// Main Component
export const NotificationSounds: React.FC<NotificationSoundsProps> = ({
  preferences: initialPreferences,
  onPreferenceChange,
  onCustomSoundUpload
}) => {
  const [preferences, setPreferences] = useState<SoundPreference[]>(
    initialPreferences || defaultPreferences
  );
  const [masterVolume, setMasterVolume] = useState(100);
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggle = useCallback((eventType: SoundPreference['eventType']) => {
    setPreferences(prev => prev.map(p =>
      p.eventType === eventType ? { ...p, isEnabled: !p.isEnabled } : p
    ));
    const pref = preferences.find(p => p.eventType === eventType);
    if (pref) {
      onPreferenceChange?.({ ...pref, isEnabled: !pref.isEnabled });
    }
  }, [preferences, onPreferenceChange]);

  const handleSoundChange = useCallback((eventType: SoundPreference['eventType'], soundId: string) => {
    setPreferences(prev => prev.map(p =>
      p.eventType === eventType ? { ...p, soundId } : p
    ));
    const pref = preferences.find(p => p.eventType === eventType);
    if (pref) {
      onPreferenceChange?.({ ...pref, soundId });
    }
  }, [preferences, onPreferenceChange]);

  const handleVolumeChange = useCallback((eventType: SoundPreference['eventType'], volume: number) => {
    setPreferences(prev => prev.map(p =>
      p.eventType === eventType ? { ...p, volume } : p
    ));
  }, []);

  const playPreview = useCallback((soundId: string) => {
    setPlayingSound(soundId);
    // Simulate sound playing
    setTimeout(() => setPlayingSound(null), 500);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCustomSoundUpload?.(file);
    }
  }, [onCustomSoundUpload]);

  const categories = ['default', 'minimal', 'playful', 'professional'];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-volume-high" />
          Notification Sounds
        </div>
        <div style={styles.masterVolume}>
          <i className="fa-solid fa-volume-low" style={{ color: '#64748b', fontSize: '12px' }} />
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={e => setMasterVolume(Number(e.target.value))}
            style={styles.volumeSlider}
          />
          <i className="fa-solid fa-volume-high" style={{ color: '#64748b', fontSize: '12px' }} />
        </div>
      </div>

      <div style={styles.content}>
        {/* Event Sound Settings */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Sound Settings by Event</div>
          {eventTypes.map(event => {
            const pref = preferences.find(p => p.eventType === event.id) || defaultPreferences[0];
            const sound = soundLibrary.find(s => s.id === pref.soundId);

            return (
              <div key={event.id} style={styles.eventCard}>
                <div style={styles.eventHeader}>
                  <div style={styles.eventInfo}>
                    <div style={styles.eventIcon}>
                      <i className={`fa-solid ${event.icon}`} />
                    </div>
                    <div>
                      <div style={styles.eventLabel}>{event.label}</div>
                      <div style={styles.eventDescription}>{event.description}</div>
                    </div>
                  </div>
                  <button
                    style={{
                      ...styles.toggle,
                      backgroundColor: pref.isEnabled ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)'
                    }}
                    onClick={() => handleToggle(event.id)}
                  >
                    <div style={{
                      ...styles.toggleKnob,
                      left: pref.isEnabled ? '22px' : '2px'
                    }} />
                  </button>
                </div>

                {pref.isEnabled && (
                  <>
                    <div style={styles.soundSelector}>
                      <select
                        style={styles.soundDropdown}
                        value={pref.soundId}
                        onChange={e => handleSoundChange(event.id, e.target.value)}
                      >
                        {categories.map(cat => (
                          <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                            {soundLibrary.filter(s => s.category === cat).map(sound => (
                              <option key={sound.id} value={sound.id}>{sound.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <button
                        style={{
                          ...styles.previewButton,
                          backgroundColor: playingSound === pref.soundId
                            ? 'rgba(139, 92, 246, 0.4)'
                            : 'rgba(139, 92, 246, 0.2)'
                        }}
                        onClick={() => playPreview(pref.soundId)}
                      >
                        {playingSound === pref.soundId ? (
                          <div style={styles.playingIndicator}>
                            <div style={{ ...styles.soundWave, animationDelay: '0s' }} />
                            <div style={{ ...styles.soundWave, animationDelay: '0.1s' }} />
                            <div style={{ ...styles.soundWave, animationDelay: '0.2s' }} />
                          </div>
                        ) : (
                          <i className="fa-solid fa-play" />
                        )}
                      </button>
                    </div>

                    <div style={styles.volumeControl}>
                      <span style={styles.volumeLabel}>Volume</span>
                      <div
                        style={styles.volumeBar}
                        onClick={e => {
                          const rect = (e.target as HTMLDivElement).getBoundingClientRect();
                          const volume = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                          handleVolumeChange(event.id, Math.max(0, Math.min(100, volume)));
                        }}
                      >
                        <div style={{ ...styles.volumeFill, width: `${pref.volume}%` }} />
                      </div>
                      <span style={styles.volumeValue}>{pref.volume}%</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Sound Library */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Sound Library</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: selectedCategory === cat
                    ? 'rgba(139, 92, 246, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: selectedCategory === cat ? '#a78bfa' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textTransform: 'capitalize'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={styles.soundLibrary}>
            {soundLibrary
              .filter(s => !selectedCategory || s.category === selectedCategory)
              .map(sound => (
                <div
                  key={sound.id}
                  style={{
                    ...styles.soundCard,
                    ...(playingSound === sound.id ? styles.soundCardSelected : {})
                  }}
                  onClick={() => playPreview(sound.id)}
                >
                  <div style={styles.soundIcon}>
                    <i className={`fa-solid ${sound.icon}`} />
                  </div>
                  <div style={styles.soundName}>{sound.name}</div>
                  <div style={styles.categoryLabel}>{sound.category}</div>
                </div>
              ))}
          </div>
        </div>

        {/* Custom Sound Upload */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Custom Sounds</div>
          <div
            style={styles.uploadSection}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={styles.uploadIcon}>
              <i className="fa-solid fa-cloud-arrow-up" />
            </div>
            <div style={styles.uploadText}>Upload Custom Sound</div>
            <div style={styles.uploadHint}>MP3, WAV, OGG (max 1MB)</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};

// Quick mute button
export const MuteButton: React.FC<{
  isMuted: boolean;
  onToggle: () => void;
}> = ({ isMuted, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '6px 10px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        color: isMuted ? '#f87171' : '#94a3b8',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`} />
      {isMuted ? 'Unmute' : 'Mute'}
    </button>
  );
};

export default NotificationSounds;
