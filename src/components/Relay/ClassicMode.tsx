// Classic Mode - Avant-Garde CMF Nothing x Glassmorphism Design
// Full-featured direct contact messaging with bold industrial aesthetic

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Plus,
  Send,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  ChevronRight,
  Check,
  CheckCheck,
  Loader2,
  X,
  Keyboard,
  Star,
  Clock,
  MessageCircle,
  Volume2,
  Users,
  Download,
  Archive,
  Bookmark,
  BookmarkCheck,
  Share2,
  Forward,
  Reply,
  Heart,
  ThumbsUp,
  Smile,
  MoreVertical,
  Sliders,
  Radio,
  List,
  AlignLeft,
  FileText,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import VoxRecordArea from './VoxRecordArea';

import { blobToBase64 } from '../../services/audioService';
import { transcribeMedia, processWithModel } from '../../services/geminiService';
import { userContactService } from '../../services/userContactService';
import { whisperService } from '../../services/relay/whisperService';
import { audioEnhancementService } from '../../services/relay/audioEnhancementService';
import { voxModeService } from '../../services/relay/voxModeService';
import { getCurrentWorkspaceId } from '../../services/ai/getWorkspaceId';
import { supabase } from '../../services/supabase';
import type { EnrichedUserProfile, PulseUserProfile } from '../../types/userContact';
import toast from 'react-hot-toast';
import './ClassicMode.css';

// Phase 2: Selection Mode
import { useVoxSelection } from '../../hooks/useVoxSelection';
import type { VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from './VoxSelectToolbar';

// Phase 5: AI Enhancements
import {
  MessageAIPanel,
} from './index';

import {
  summarizeConversation,
  generateMeetingNotes,
  generateAutoChapters,
  ConversationSummary,
  MeetingNotes,
  Chapter,
} from '../../services/relay/relayAIService';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import {
  useRelayStudio,
  useRelayModeRecorder,
  StudioMessageCard,
  StudioMasthead,
  avatarColorForId,
  initials as avatarInitials,
} from './studio';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';
import { useWorkspaceData, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { navigateToTeamInvite } from '../../utils/inviteTeammateNavigation';

// Message Menu & Download Modal
import VoxMessageMenu from './VoxMessageMenu';
import VoxDownloadModal from './VoxDownloadModal';
import { archiveRelayConversation } from '../../services/relay/relayArchiveService';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

// How many Direct messages to load per page. The first open loads the most
// recent page; "Load older" pages further back via the created_at cursor. Caps
// the prior unbounded load (which also fetched an audio blob per row).
const DIRECT_PAGE_SIZE = 500;

// ============================================
// TYPES
// ============================================

interface Recording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  transcription?: string;
  isTranscribing?: boolean;
  sender: 'me' | 'other';
  contactId: string;
  status?: 'sent' | 'delivered' | 'read';
  analysis?: {
    sentiment?: string;
    topics?: string[];
    actionItems?: string[];
  };
  starred?: boolean;
  bookmarked?: boolean;
  reactions?: { emoji: string; userId: string; timestamp: Date }[];
  replyToId?: string;
  forwarded?: boolean;
  listenCount?: number;
  // Whisper transcription metadata
  whisperTranscription?: {
    text: string;
    language?: string;
    words?: { word: string; start: number; end: number }[];
  };
  // Audio enhancement metadata
  enhanced?: boolean;
  enhancementApplied?: string[];
}

// A Direct conversation counterparty. voxer_recordings.contact_id points at a
// CRM contacts.id for existing/seeded DMs but at a pulse_users.id for convos
// started from the in-app picker, so we resolve from either table and normalize
// to a shape that's structurally a Partial<PulseUserProfile> — every existing
// activeContact.* / people-row read keeps working unchanged.
type DirectParticipant = Partial<PulseUserProfile> & { id: string };

// Quick reactions for Vox messages
const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '🔥', '👏'];

// Deterministic bar-height pattern keyed off a recording id, so each message's
// placeholder waveform stays stable across renders and looks unique per row.
// Real peak extraction from the decoded AudioBuffer is a follow-up; this kills
// the worst tell (Math.random per paint) at single-helper cost.
function hashRecordingId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function deterministicBarHeight(seed: number, index: number): number {
  // Two-frequency superposition gives a believable "spoken word" envelope
  // without looking sinusoidal. Output range stays in [30, 80] for the same
  // visual presence the prior random version had.
  const a = Math.sin((seed + index * 17) * 0.13);
  const b = Math.cos((seed + index * 11) * 0.23);
  const t = (a + b) / 2; // [-1, 1]
  return 30 + ((t + 1) / 2) * 50; // [30, 80]
}

// Settings interface
interface ClassicModeSettings {
  audioQuality: 'standard' | 'high' | 'ultra';
  autoTranscribe: boolean;
  transcriptionEngine: 'gemini' | 'whisper';
  playbackSpeed: number;
  visualizerSensitivity: number;
  noiseReduction: boolean;
  audioEnhancement: boolean;
  enhanceVoiceClarity: boolean;
}

interface ClassicModeProps {
  onBack: () => void;
  apiKey: string;
  isDarkMode?: boolean;
  /** Pulse user id to land on (e.g. opening from contact card or deep link). */
  initialContactId?: string;
}

// ============================================
// CLASSIC MODE COMPONENT
// ============================================

const ClassicMode: React.FC<ClassicModeProps> = ({
  onBack,
  apiKey,
  isDarkMode = false,
  initialContactId,
}) => {
  // State
  const [activeContactId, setActiveContactId] = useState<string>(initialContactId ?? '');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  // Direct history is capped to the most recent DIRECT_PAGE_SIZE on open (S3);
  // `hasOlderMessages` exposes a "Load older" control, `oldestLoadedAt` is the
  // pagination cursor (ISO ts of the oldest loaded message).
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [oldestLoadedAt, setOldestLoadedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  // 'list' shows the contacts column, 'thread' the conversation. Drives the
  // single-pane swap (with .classic--single-pane); inert when the pane is wide
  // enough to show both. A deep-link to a contact opens straight to the thread.
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(initialContactId ? 'thread' : 'list');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  // Playback flows through the shared Voice Studio transport so the persistent
  // StudioFooter reflects + controls whatever plays here. "Which row is active"
  // is derived from studio.nowPlaying rather than a local playingId.
  const studio = useRelayStudio();

  // Safety net: ensure `quick_vox_status.is_recording` clears if the tab is
  // closed or this view unmounts mid-recording. The hook-based modes get this
  // via useVoxRecording; ClassicMode owns its own MediaRecorder, so it owns
  // its own cleanup too.
  useEffect(() => {
    if (!isRecording) return;
    const flipFalse = () => voxModeService.updateQuickVoxStatus(false).catch(() => {});
    window.addEventListener('pagehide', flipFalse);
    window.addEventListener('beforeunload', flipFalse);
    return () => {
      window.removeEventListener('pagehide', flipFalse);
      window.removeEventListener('beforeunload', flipFalse);
      flipFalse();
    };
  }, [isRecording]);
  const [showNewVoxModal, setShowNewVoxModal] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<{
    blob: Blob;
    url: string;
    duration: number;
    audioBuffer?: AudioBuffer;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const isPreviewing = !!pendingRecording;

  // Settings and controls state. The Settings entry point lives at the
  // Relay shell level (the gear icon in Relay.tsx); ClassicMode no longer
  // surfaces a duplicate door, but the settings object below is still
  // consumed by the audio/transcription pipeline at its current defaults.
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Recording | null>(null);
  const [settings, setSettings] = useState<ClassicModeSettings>({
    audioQuality: 'high',
    autoTranscribe: true,
    transcriptionEngine: 'whisper',
    playbackSpeed: 1,
    visualizerSensitivity: 0.7,
    noiseReduction: true,
    audioEnhancement: true,
    enhanceVoiceClarity: true,
  });

  // Real-time audio visualization state
  const [liveAudioLevel, setLiveAudioLevel] = useState<number[]>(new Array(32).fill(0));

  // Pulse users state
  const [pulseUsers, setPulseUsers] = useState<EnrichedUserProfile[]>([]);
  // Workspace-scoped pickable users for the "New message" modal — only people in
  // the active workspace (who can actually receive a quick_vox). Kept separate
  // from `pulseUsers`, which stays unscoped so resolveParticipant can still name
  // existing thread counterparties that may live in other workspaces.
  const [pickableUsers, setPickableUsers] = useState<EnrichedUserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Recording mode state
  const [recordingMode, setRecordingMode] = useState<'hold' | 'tap'>(() => {
    const saved = localStorage.getItem('voxer-recording-mode');
    return (saved === 'hold' || saved === 'tap') ? saved : 'hold';
  });

  // Persist recording mode preference
  useEffect(() => {
    localStorage.setItem('voxer-recording-mode', recordingMode);
  }, [recordingMode]);

  // Phase 2: Selection Mode State
  const {
    isSelectionMode,
    selectedItems,
    selectionCount,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
    getTotalDuration,
  } = useVoxSelection();

  // Phase 5: AI Enhancement States
  const [showSummary, setShowSummary] = useState(false);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [meetingNotes, setMeetingNotes] = useState<MeetingNotes | null>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  const [activeChapters, setActiveChapters] = useState<Chapter[]>([]);
  const [chapterRecordingId, setChapterRecordingId] = useState<string | null>(null);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const emptyConfig = getEmptyStateConfig('classic');

  // AC3: route still-solo admins toward team activation from the empty thread,
  // instead of a solo dead-end. Member-count proxy + canManageMembers gate.
  const { currentWorkspace, members } = useWorkspaceData();
  const { canManageMembers } = useWorkspacePermissions();
  const showInviteCta = members.length < 2 && canManageMembers;
  const inviteSecondaryAction = showInviteCta
    ? {
        label: 'Invite a teammate',
        onClick: () =>
          navigateToTeamInvite({ workspaceId: currentWorkspace?.id ?? null, source: 'relay-direct-empty' }),
      }
    : undefined;

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // The scrollable thread container (.classic-messages). Used to anchor the
  // viewport when prepending older messages so the view doesn't jump.
  const threadScrollRef = useRef<HTMLDivElement>(null);

  // Track all blob URLs created via URL.createObjectURL() so they can be
  // revoked on component unmount or when no longer needed, preventing memory leaks.
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Theme colors — Relay brand accent (rose-500), per-mode colors retired in 2.1d.1.
  const accentColor = '#f43f5e';

  // Cleanup all blob URLs on component unmount to prevent memory leaks (G6 fix).
  // Individual URLs are also revoked when replaced or deleted, but this
  // catch-all ensures nothing leaks if the component is torn down mid-use.
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  // Map quick_vox rows → Recordings, resolving each audio URL to a local blob
  // URL for playback/download. Shared by the initial load and "Load older" so
  // the (heavy, blob-fetching) transform lives in one place.
  const mapMessagesToRecordings = useCallback(
    async (
      dbMessages: Awaited<ReturnType<typeof voxModeService.getAllQuickVoxMessages>>,
      myId: string,
    ): Promise<Recording[]> => {
      return Promise.all(
        dbMessages.map(async (msg) => {
          let blob: Blob | null = null;
          let url = msg.audioUrl || '';

          if (url) {
            try {
              if (url.startsWith('data:')) {
                const response = await fetch(url);
                blob = await response.blob();
                url = URL.createObjectURL(blob);
                blobUrlsRef.current.add(url);
              } else if (url.startsWith('blob:')) {
                // Stale in-memory URL from a prior session — not resolvable.
                url = '';
              } else {
                // Supabase storage URL — fetch + wrap for local playback/download.
                const response = await fetch(url);
                blob = await response.blob();
                url = URL.createObjectURL(blob);
                blobUrlsRef.current.add(url);
              }
            } catch (e) {
              console.error('Error loading recording from URL:', msg.audioUrl, e);
              // Fall back to the durable remote URL so playback can still try.
              url = msg.audioUrl || '';
            }
          }

          const isMine = msg.senderId === myId;
          return {
            id: msg.id,
            blob: blob || new Blob(),
            url: url || '',
            duration: msg.duration || 0,
            timestamp: msg.createdAt,
            transcription: msg.transcript || undefined,
            isTranscribing: false,
            sender: (isMine ? 'me' : 'other') as 'me' | 'other',
            contactId: isMine ? msg.recipientId : msg.senderId,
            status: (msg.playedAt ? 'read' : msg.status === 'delivered' ? 'delivered' : 'sent') as 'sent' | 'delivered' | 'read',
            analysis: msg.analysis || undefined,
            replyToId: msg.analysis?.reply_to_id || undefined,
          };
        }),
      );
    },
    [],
  );

  // Load the Direct thread from the REAL 2-party quick_vox engine (S0-1). The
  // old voxer_recordings path was a single-user log that never delivered to the
  // recipient; this loads the most recent DIRECT_PAGE_SIZE quick_vox messages I
  // sent or received (S3 cap) and derives the people list + per-contact threads
  // from them. me/them keys off sender_id vs my id; the counterparty (contactId)
  // is the OTHER participant. Older history is paged in via loadOlderMessages.
  useEffect(() => {
    const loadRecordings = async () => {
      try {
        const myId = await voxModeService.ensureUserId();
        const dbMessages = await voxModeService.getAllQuickVoxMessages({ limit: DIRECT_PAGE_SIZE });
        const loadedRecordings = await mapMessagesToRecordings(dbMessages, myId);
        setRecordings(loadedRecordings);
        // A full page back implies there may be older history to page in.
        setHasOlderMessages(dbMessages.length >= DIRECT_PAGE_SIZE);
        // dbMessages is ascending, so [0] is the oldest loaded — the cursor.
        setOldestLoadedAt(dbMessages.length > 0 ? dbMessages[0].createdAt.toISOString() : null);
        // Mark everything I've received as delivered so senders get the receipt
        // (S1-2). Recipient-scoped RPC; sender-only UPDATE RLS blocks a direct write.
        voxModeService.markQuickVoxDeliveredAll().catch(() => {});
      } catch (error) {
        console.error('Error loading recordings:', error);
      }
    };
    loadRecordings();
  }, [mapMessagesToRecordings]);

  // Page in the next-older window of Direct history. Prepends to `recordings`
  // (de-duped) and anchors the viewport so the view stays put rather than
  // jumping — the auto-scroll effect below ignores prepends (newest id unchanged).
  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !oldestLoadedAt) return;
    setIsLoadingOlder(true);
    const scrollEl = threadScrollRef.current;
    const prevHeight = scrollEl?.scrollHeight ?? 0;
    const prevTop = scrollEl?.scrollTop ?? 0;
    try {
      const myId = await voxModeService.ensureUserId();
      const older = await voxModeService.getAllQuickVoxMessages({
        limit: DIRECT_PAGE_SIZE,
        before: oldestLoadedAt,
      });
      if (older.length === 0) {
        setHasOlderMessages(false);
        return;
      }
      const olderRecordings = await mapMessagesToRecordings(older, myId);
      setRecordings((prev) => {
        const existing = new Set(prev.map((r) => r.id));
        const fresh = olderRecordings.filter((r) => !existing.has(r.id));
        return [...fresh, ...prev];
      });
      setOldestLoadedAt(older[0].createdAt.toISOString());
      setHasOlderMessages(older.length >= DIRECT_PAGE_SIZE);
      requestAnimationFrame(() => {
        const el = threadScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      });
    } catch (e) {
      console.error('Error loading older messages:', e);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [isLoadingOlder, oldestLoadedAt, mapMessagesToRecordings]);

  // Realtime inbound: new quick_vox messages addressed to me appear live in the
  // open thread (and feed the people list) without a refresh — the delivery half
  // of S0-1. Channels already proves this pattern (TeamVoxMode); Direct now
  // matches it. subscribeToQuickVox filters server-side to recipient_id = me.
  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    voxModeService
      .subscribeToQuickVox((msg) => {
        setRecordings((prev) => {
          if (prev.some((r) => r.id === msg.id)) return prev;
          return [
            ...prev,
            {
              id: msg.id,
              blob: new Blob(),
              url: msg.audioUrl || '',
              duration: msg.duration || 0,
              timestamp: msg.createdAt,
              transcription: msg.transcript || undefined,
              isTranscribing: false,
              sender: 'other' as const,
              contactId: msg.senderId,
              status: 'delivered' as const,
              analysis: msg.analysis || undefined,
              replyToId: msg.analysis?.reply_to_id || undefined,
            },
          ];
        });
        // Tell the sender it was delivered (S1-2).
        voxModeService.markQuickVoxDeliveredAll().catch(() => {});
      })
      .then((sub) => {
        if (cancelled) {
          try { if (sub) supabase.removeChannel(sub); } catch { /* noop */ }
        } else {
          channel = sub;
        }
      });
    return () => {
      cancelled = true;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, []);

  // Realtime receipts (S1-2): when the recipient marks a vox I SENT as
  // delivered/played, patch that row's status live so my checkmarks update
  // without a refresh. RLS lets the sender see UPDATEs to their own rows.
  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    voxModeService
      .subscribeToQuickVoxSentStatus((msg) => {
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === msg.id
              ? { ...r, status: msg.playedAt ? 'read' : msg.deliveredAt ? 'delivered' : r.status }
              : r,
          ),
        );
      })
      .then((sub) => {
        if (cancelled) {
          try { if (sub) supabase.removeChannel(sub); } catch { /* noop */ }
        } else {
          channel = sub;
        }
      });
    return () => {
      cancelled = true;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, []);

  // Load Pulse users on mount (for contacts with existing conversations)
  useEffect(() => {
    const loadInitialPulseUsers = async () => {
      try {
        const users = await userContactService.getAllPulseUsers({
          excludeBlocked: true,
          limit: 100
        });
        setPulseUsers(users);
      } catch (error) {
        console.error('Error loading initial Pulse users:', error);
      }
    };
    loadInitialPulseUsers();
  }, []);

  // Reload Pulse users when modal opens with search
  useEffect(() => {
    if (showNewVoxModal) {
      const loadPulseUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const users = await userContactService.getAllPulseUsers({
            searchQuery: modalSearchQuery || undefined,
            excludeBlocked: true,
            limit: 50,
            // Scope to the workspace the send will stamp (same source as
            // sendQuickVox) so the picker only offers deliverable recipients.
            workspaceId: getCurrentWorkspaceId() ?? undefined,
          });
          setPickableUsers(users);
        } catch (error) {
          console.error('Error loading Pulse users:', error);
          toast.error('Failed to load contacts');
        } finally {
          setIsLoadingUsers(false);
        }
      };
      loadPulseUsers();
    } else {
      // Reset modal search when closed
      setModalSearchQuery('');
    }
  }, [showNewVoxModal, modalSearchQuery]);

  // Auto-scroll to bottom when a NEW (newest) message arrives or the contact
  // changes. Keyed on the newest message id rather than the whole `recordings`
  // array so paging in OLDER history (prepend) doesn't yank the view to the
  // bottom — and incidental status-only mutations no longer re-scroll either.
  const newestRecordingId = recordings.length > 0 ? recordings[recordings.length - 1].id : null;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newestRecordingId, activeContactId]);

  // voxer_recordings.contact_id is a CRM contacts.id for existing/seeded DMs
  // (verified live: 19/19 resolve against contacts, 0 against pulse_users) but a
  // pulse_users.id for convos started from the picker. Resolve from BOTH so the
  // people list and header populate either way — the prior pulse_users-only
  // lookup left every existing voice DM invisible in this surface.
  const [contactsById, setContactsById] = useState<Map<string, { name: string | null; avatar_url: string | null; phone: string | null }>>(new Map());
  useEffect(() => {
    const ids = Array.from(new Set(
      recordings.map(r => r.contactId).filter((id): id is string => !!id && /^[0-9a-f-]{36}$/i.test(id)),
    ));
    if (ids.length === 0) { setContactsById(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('contacts').select('id, name, avatar_url, phone').in('id', ids);
      if (cancelled) return;
      const m = new Map<string, { name: string | null; avatar_url: string | null; phone: string | null }>();
      for (const c of (data ?? []) as any[]) m.set(c.id, { name: c.name, avatar_url: c.avatar_url, phone: c.phone });
      setContactsById(m);
    })();
    return () => { cancelled = true; };
  }, [recordings]);

  const pulseUserById = useMemo(() => {
    const m = new Map<string, EnrichedUserProfile>();
    for (const u of pulseUsers) m.set(u.id, u);
    return m;
  }, [pulseUsers]);

  // Resolve a contact_id to a normalized participant from whichever identity
  // table owns it (pulse_users first for the richer profile, then contacts).
  const resolveParticipant = useCallback((id: string): DirectParticipant => {
    const pu = pulseUserById.get(id);
    if (pu) return pu;
    const c = contactsById.get(id);
    if (c) return { id, displayName: c.name ?? undefined, avatarUrl: c.avatar_url ?? undefined, phoneNumber: c.phone ?? undefined };
    return { id };
  }, [pulseUserById, contactsById]);

  // Contacts with Vox conversations — one participant per distinct contact_id
  // that has recordings, resolved from whichever identity table owns it.
  const contactsWithVoxes = useMemo<DirectParticipant[]>(() => {
    const ids = Array.from(new Set(recordings.map(r => r.contactId).filter(Boolean)));
    return ids.map(id => resolveParticipant(id));
  }, [recordings, resolveParticipant]);

  // Filtered contacts for sidebar (only those with recordings)
  const filteredContacts = useMemo(() => {
    return contactsWithVoxes.filter(u => {
      const displayName = u.displayName || u.fullName || u.handle || '';
      const role = u.role || '';
      return displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             role.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [contactsWithVoxes, searchQuery]);

  // Active contact recordings
  const activeThreadRecordings = useMemo(() => {
    return recordings
      .filter(r => r.contactId === activeContactId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [recordings, activeContactId]);

  // Tier 3 (Path C): bucket the conversation into Today / Yesterday / Last week
  // / older runs so the thread reads like the mock's day-grouped timeline.
  // Recordings are already sorted ascending, so consecutive items share a label.
  const groupedThreadRecordings = useMemo(() => {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(new Date());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
    const labelFor = (ts: Date): string => {
      const d = startOfDay(ts);
      if (d.getTime() === today.getTime()) return 'Today';
      if (d.getTime() === yesterday.getTime()) return 'Yesterday';
      if (d >= weekAgo) return 'Last week';
      return ts.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    };
    const groups: { label: string; items: Recording[] }[] = [];
    for (const r of activeThreadRecordings) {
      const label = labelFor(new Date(r.timestamp));
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(r);
      else groups.push({ label, items: [r] });
    }
    return groups;
  }, [activeThreadRecordings]);

  const activeContact = activeContactId ? resolveParticipant(activeContactId) : undefined;

  // ============================================
  // PHASE 5: AI ENHANCEMENT HANDLERS
  // ============================================

  // Summarize conversation
  const handleSummarizeConversation = useCallback(async () => {
    if (activeThreadRecordings.length === 0) return;

    setIsSummarizing(true);
    try {
      const messages = activeThreadRecordings.map(rec => ({
        id: rec.id,
        transcription: rec.transcription || '',
        sender: rec.sender,
        senderName: rec.sender === 'other' ? activeContact?.displayName || activeContact?.handle : undefined,
        timestamp: rec.timestamp,
        duration: rec.duration,
      }));

      const summary = await summarizeConversation(apiKey, messages);
      if (summary) {
        setConversationSummary(summary);
        setShowSummary(true);
        toast.success('Conversation summarized!');
      } else {
        toast.error('Failed to generate summary');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      toast.error('Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  }, [activeThreadRecordings, activeContact, apiKey]);

  // ============================================
  // RECORDING FUNCTIONS
  // ============================================

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        let blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = (Date.now() - startTimeRef.current) / 1000;

        // Apply audio enhancement if enabled
        if (settings.audioEnhancement) {
          try {
            toast.loading('Enhancing audio...', { id: 'audio-enhance' });
            const enhancedResult = await audioEnhancementService.enhanceAudio(blob, {
              noiseReduction: settings.noiseReduction,
              normalize: true,
              enhanceClarity: settings.enhanceVoiceClarity,
              enhanceVoice: settings.enhanceVoiceClarity,
            });
            blob = enhancedResult.blob;
            toast.success(`Audio enhanced (${enhancedResult.appliedEnhancements.join(', ')})`, { id: 'audio-enhance' });
          } catch (e) {
            console.error('Audio enhancement error:', e);
            toast.error('Enhancement failed, using original', { id: 'audio-enhance' });
          }
        }

        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.add(url);

        // Decode audio for waveform
        let audioBuffer: AudioBuffer | undefined;
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new AudioContext();
          audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
          console.error('Error decoding audio:', e);
        }

        setPendingRecording({ blob, url, duration, audioBuffer });

        // Start transcription based on engine selection
        if (settings.autoTranscribe) {
          setIsAnalyzing(true);
          try {
            if (settings.transcriptionEngine === 'whisper') {
              // Use OpenAI Whisper API
              const isWhisperConfigured = await whisperService.isConfigured();
              if (isWhisperConfigured) {
                toast.loading('Transcribing with Whisper...', { id: 'transcribe' });
                const result = await whisperService.transcribeWithWordTimestamps(blob);
                setTranscript(result.text || '');
                toast.success(`Transcribed (${result.language || 'detected'})`, { id: 'transcribe' });
              } else {
                // Fallback to Gemini if Whisper not configured
                toast.loading('Transcribing...', { id: 'transcribe' });
                const base64 = await blobToBase64(blob);
                const transcriptText = await transcribeMedia(base64, 'audio/webm');
                setTranscript(transcriptText || '');
                toast.success('Transcribed', { id: 'transcribe' });
              }
            } else {
              // Use Gemini
              toast.loading('Transcribing with Gemini...', { id: 'transcribe' });
              const base64 = await blobToBase64(blob);
              const transcriptText = await transcribeMedia(base64, 'audio/webm');
              setTranscript(transcriptText || '');
              toast.success('Transcribed', { id: 'transcribe' });
            }
          } catch (e) {
            console.error('Transcription error:', e);
            toast.error('Transcription failed', { id: 'transcribe' });
          }
          setIsAnalyzing(false);
        }
      };

      startTimeRef.current = Date.now();
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      voxModeService.updateQuickVoxStatus(true).catch(() => {});

      // Update duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((Date.now() - startTimeRef.current) / 1000);

        // Update audio level
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
        }
      }, 50);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  }, [apiKey]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioLevel(0);
      voxModeService.updateQuickVoxStatus(false).catch(() => {});
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const cancelRecording = useCallback(() => {
    // Revoke the blob URL from the discarded pending recording to free memory
    if (pendingRecording?.url) {
      URL.revokeObjectURL(pendingRecording.url);
      blobUrlsRef.current.delete(pendingRecording.url);
    }
    setPendingRecording(null);
    setTranscript('');
  }, [pendingRecording]);

  const sendRecording = useCallback(async () => {
    if (!pendingRecording || !activeContactId) return;

    const isReply = !!replyingTo;
    const replyToId = replyingTo?.id || undefined;
    const analysis = replyToId ? { reply_to_id: replyToId } : undefined;
    const blob = pendingRecording.blob;
    const duration = pendingRecording.duration;
    const transcriptText = transcript || undefined;

    // Optimistic bubble with a temp id; reconciled to the real row id on success,
    // rolled back on failure so we never show a false "sent" (S0-3).
    const tempId = `rec-${Date.now()}`;
    const optimistic: Recording = {
      id: tempId,
      blob,
      url: pendingRecording.url,
      duration,
      timestamp: new Date(),
      transcription: transcriptText,
      sender: 'me',
      contactId: activeContactId,
      status: 'sent',
      replyToId,
    };
    setRecordings(prev => [...prev, optimistic]);

    // Deliver through the real 2-party engine: uploads audio, inserts a
    // quick_vox_messages row (sender = me, recipient = activeContactId), notifies
    // the recipient, and fires their realtime sub. activeContactId is a Pulse
    // user id — the composer + thread only ever surface Pulse users.
    const sent = await voxModeService.uploadAndSendQuickVox(
      activeContactId,
      blob,
      duration,
      transcriptText,
      analysis,
    );

    if (!sent) {
      // Honest failure: drop the optimistic bubble, keep the preview so the user
      // can retry, and surface the error instead of a fake "Message sent!".
      setRecordings(prev => prev.filter(r => r.id !== tempId));
      toast.error('Could not send your voice message. Please try again.');
      return;
    }

    // Success: swap the temp row for the durable id, clear the composer. Keep the
    // local blob URL for instant in-session playback (storage holds the copy).
    setRecordings(prev =>
      prev.map(r => (r.id === tempId ? { ...r, id: sent.id, status: 'sent' } : r)),
    );
    setPendingRecording(null);
    setTranscript('');
    setReplyingTo(null);
    toast.success(isReply ? 'Reply sent!' : 'Message sent!');
  }, [pendingRecording, activeContactId, transcript, replyingTo]);

  const retryRecording = useCallback(() => {
    // Revoke the blob URL from the discarded pending recording to free memory
    if (pendingRecording?.url) {
      URL.revokeObjectURL(pendingRecording.url);
      blobUrlsRef.current.delete(pendingRecording.url);
    }
    setPendingRecording(null);
    setTranscript('');
    startRecording();
  }, [startRecording, pendingRecording]);

  // Tier 2 (unify trigger): the studio shell's FloatingMic + footer RECORDING
  // surface drive Direct's own MediaRecorder; the in-pane record button is
  // retired. Enabled only when a contact is selected (the send target). The
  // RecordingPreview (audio enhancement + transcription) → send stays in-pane.
  useRelayModeRecorder({
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    recording: isRecording,
    enabled: !!activeContactId,
  });

  // ============================================
  // PLAYBACK FUNCTIONS
  // ============================================

  const playRecording = useCallback((recording: Recording) => {
    studio.play({
      id: recording.id,
      sender: recording.sender === 'me'
        ? 'You'
        : (activeContact?.displayName || activeContact?.handle || 'Direct'),
      dur: formatDuration(recording.duration),
      type: 'DM',
      transcript: recording.transcription ?? null,
      source: 'direct',
      audioUrl: recording.url,
    });
    // Listened receipt (S1-2): playing a vox I received marks it played so the
    // sender sees the "listened" state. Reflect it locally too (idempotent RPC).
    if (recording.sender === 'other' && recording.status !== 'read') {
      voxModeService.markQuickVoxPlayed(recording.id).catch(() => {});
      setRecordings((prev) =>
        prev.map((r) => (r.id === recording.id ? { ...r, status: 'read' } : r)),
      );
    }
  }, [studio, activeContact]);

  const pausePlayback = useCallback(() => {
    studio.togglePlay();
  }, [studio]);

  const toggleStar = useCallback((recordingId: string) => {
    // Local-only for now: quick_vox_messages is a shared 2-party row with
    // sender-only UPDATE (RLS), so a per-viewer star can't be persisted there.
    // Keep the optimistic toggle; durable per-viewer flags are a follow-up.
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, starred: !r.starred } : r
    ));
  }, []);

  const performDelete = useCallback(async (recordingId: string) => {
    // Revoke the blob URL for the deleted recording to free memory
    const recording = recordings.find(r => r.id === recordingId);
    if (recording?.url && recording.url.startsWith('blob:')) {
      URL.revokeObjectURL(recording.url);
      blobUrlsRef.current.delete(recording.url);
    }
    setRecordings(prev => prev.filter(r => r.id !== recordingId));
    // RLS allows deleting only messages I sent; received ones are removed from my
    // view locally (the row stays for the sender). deleteQuickVox handles both.
    await voxModeService.deleteQuickVox(recordingId);
    toast.success('Message deleted');
  }, [recordings]);

  // Confirm before destroying — voxer_recordings deletes are not reversible.
  // Matches the safety the Inbox uses so the two surfaces feel like one product.
  const deleteRecording = useCallback((recordingId: string) => {
    toast((t) => (
      <span className="flex flex-col gap-2 min-w-[14rem]">
        <span className="text-sm">Delete this voice message forever? This can't be undone.</span>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { toast.dismiss(t.id); performDelete(recordingId); }}
            className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white"
          >
            Delete
          </button>
        </div>
      </span>
    ), { duration: 8000 });
  }, [performDelete]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get last vox for contact
  const getLastVox = (contactId: string) => {
    return recordings.filter(r => r.contactId === contactId).pop();
  };

  // ============================================
  // VOX MESSAGE ACTIONS
  // ============================================

  // Download a single Vox message
  const downloadVoxMessage = useCallback(async (recording: Recording) => {
    try {
      const contact = resolveParticipant(recording.contactId);
      const contactName = contact?.displayName || contact?.handle || 'unknown';
      const dateStr = recording.timestamp.toISOString().split('T')[0];
      const timeStr = recording.timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `vox_${contactName}_${dateStr}_${timeStr}.webm`;

      // Create download link
      const url = URL.createObjectURL(recording.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Message downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download message');
    }
  }, [resolveParticipant]);

  // Archive a single Vox message via VoxMessageMenu
  const handleArchiveMessage = useCallback(async (recording: Recording) => {
    const item: VoxSelectionItem = {
      id: recording.id,
      type: 'audio',
      url: recording.url || '',
      duration: recording.duration || 0,
      timestamp: recording.timestamp instanceof Date ? recording.timestamp : new Date(recording.timestamp),
      sender: recording.sender,
      transcription: recording.transcription,
      mode: 'classic',
      contactName: activeContact?.displayName || activeContact?.handle,
    };
    const loadingToast = toast.loading('Archiving…');
    try {
      await archiveRelayConversation([item], activeContact?.displayName || activeContact?.handle || 'Unknown');
      toast.dismiss(loadingToast);
      toast.success('Archived to Pulse Archives');
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Failed to archive');
    }
  }, [activeContact]);

  // Open VoxDownloadModal for a single Vox message
  const handleDownloadMessage = useCallback((recording: Recording) => {
    const item: VoxSelectionItem = {
      id: recording.id,
      type: 'audio',
      url: recording.url || '',
      duration: recording.duration || 0,
      timestamp: recording.timestamp instanceof Date ? recording.timestamp : new Date(recording.timestamp),
      sender: recording.sender,
      transcription: recording.transcription,
      mode: 'classic',
      contactName: activeContact?.displayName || activeContact?.handle,
    };
    setDownloadItem(item);
    setShowDownloadModal(true);
  }, [activeContact]);

  // Archive all messages from a conversation
  const archiveConversation = useCallback(async (contactId: string) => {
    try {
      const contact = resolveParticipant(contactId);
      const contactName = contact?.displayName || contact?.handle || 'unknown';
      const conversationRecordings = recordings.filter(r => r.contactId === contactId);

      if (conversationRecordings.length === 0) {
        toast.error('No messages to archive');
        return;
      }

      // Create a manifest file with metadata
      const manifest = {
        contact: contactName,
        contactId,
        exportDate: new Date().toISOString(),
        messageCount: conversationRecordings.length,
        messages: conversationRecordings.map(r => ({
          id: r.id,
          sender: r.sender,
          duration: r.duration,
          timestamp: r.timestamp.toISOString(),
          transcription: r.transcription,
          starred: r.starred,
          bookmarked: r.bookmarked,
        })),
      };

      // Create zip-like structure using data URLs (simplified for browser)
      // In production, you'd use JSZip or similar
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(manifestBlob);
      const a = document.createElement('a');
      a.href = manifestUrl;
      a.download = `relay_archive_${contactName}_${new Date().toISOString().split('T')[0]}_manifest.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(manifestUrl);

      // Download each audio file
      for (let i = 0; i < conversationRecordings.length; i++) {
        const rec = conversationRecordings[i];
        setTimeout(() => downloadVoxMessage(rec), i * 500); // Stagger downloads
      }

      toast.success(`Archiving ${conversationRecordings.length} messages...`);
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('Failed to archive conversation');
    }
  }, [resolveParticipant, recordings, downloadVoxMessage]);

  // Toggle bookmark on a message
  const toggleBookmark = useCallback((recordingId: string) => {
    // Local-only persistence (see toggleStar) — quick_vox can't hold a per-viewer
    // bookmark under sender-only UPDATE RLS.
    const recording = recordings.find(r => r.id === recordingId);
    setRecordings(prev => prev.map(r =>
      r.id === recordingId ? { ...r, bookmarked: !r.bookmarked } : r
    ));
    toast.success(recording?.bookmarked ? 'Bookmark removed' : 'Bookmarked!');
  }, [recordings]);

  // Add reaction to a message
  const addReaction = useCallback(async (recordingId: string, emoji: string) => {
    setRecordings(prev => prev.map(r => {
      if (r.id === recordingId) {
        const reactions = r.reactions || [];
        const existingIdx = reactions.findIndex(rx => rx.emoji === emoji);
        if (existingIdx >= 0) {
          // Remove if same emoji
          return { ...r, reactions: reactions.filter((_, i) => i !== existingIdx) };
        }
        return { ...r, reactions: [...reactions, { emoji, userId: 'me', timestamp: new Date() }] };
      }
      return r;
    }));
    setShowReactionPicker(null);
    toast.success('Reaction added!');
  }, []);

  // Forward a message (copy to clipboard or select new recipient)
  const forwardMessage = useCallback((recording: Recording) => {
    // For now, copy the URL to clipboard
    navigator.clipboard.writeText(`Voice message: ${recording.transcription || 'Voice message'}`);
    toast.success('Message copied to clipboard');
    setShowMessageMenu(null);
  }, []);

  // Set reply context
  const setReplyContext = useCallback((recording: Recording) => {
    setReplyingTo(recording);
    setShowMessageMenu(null);
  }, []);

  // ============================================
  // PHASE 5: AI ENHANCEMENT HANDLERS (CONTINUED)
  // ============================================

  // Generate meeting notes
  const handleGenerateMeetingNotes = async () => {
    if (activeThreadRecordings.length === 0) return;

    setIsGeneratingNotes(true);
    try {
      const messages = activeThreadRecordings.map(rec => ({
        id: rec.id,
        transcription: rec.transcription || '',
        sender: rec.sender,
        senderName: rec.sender === 'other' ? activeContact?.displayName || activeContact?.handle : undefined,
        timestamp: rec.timestamp,
        duration: rec.duration,
      }));

      const notes = await generateMeetingNotes(
        apiKey,
        messages,
        `Conversation with ${activeContact?.displayName || activeContact?.handle || 'Contact'}`
      );

      if (notes) {
        setMeetingNotes(notes);
        toast.success('Meeting notes generated!');
      } else {
        toast.error('Failed to generate meeting notes');
      }
    } catch (error) {
      console.error('Meeting notes error:', error);
      toast.error('Failed to generate meeting notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Generate chapters for messages with transcription (min 30s)
  const handleGenerateChapters = async (recording: Recording) => {
    if (!recording.transcription) {
      toast.error('No transcription available. Record and wait for AI to transcribe first.');
      return;
    }
    if (recording.duration < 30) {
      toast.error('Message too short for chapters (need 30+ seconds)');
      return;
    }

    try {
      toast.loading('Generating chapters...', { id: 'chapters' });
      const chapters = await generateAutoChapters(
        apiKey,
        recording.transcription,
        recording.duration
      );

      if (chapters.length > 0) {
        setActiveChapters(chapters);
        setChapterRecordingId(recording.id);
        toast.success(`${chapters.length} chapters generated!`, { id: 'chapters' });
      } else {
        toast.error('Failed to generate chapters', { id: 'chapters' });
      }
    } catch (error) {
      console.error('Chapters error:', error);
      toast.error('Failed to generate chapters', { id: 'chapters' });
    }
  };

  // ============================================
  // PHASE 6: KEYBOARD SHORTCUTS (After all handlers defined)
  // ============================================

  useRelayKeyboardShortcuts({
    onToggleRecording: () => {
      if (!isRecording) startRecording();
      else stopRecording();
    },
    onStopRecording: () => {
      // Priority 1: close any open modal/overlay first
      if (showMessageMenu) { setShowMessageMenu(null); return; }
      if (showReactionPicker) { setShowReactionPicker(null); return; }
      if (meetingNotes) { setMeetingNotes(null); return; }
      if (showSummary) { setShowSummary(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showNewVoxModal) { setShowNewVoxModal(false); return; }
      // Priority 2: discard active recording
      if (isRecording) { stopRecording(); return; }
      // Priority 3: exit selection mode
      if (isSelectionMode) { exitSelectionMode(); return; }
      // Priority 4: go back to contact list
      if (activeContactId) setActiveContactId('');
    },
    onGoBack: () => {
      if (activeContactId) setActiveContactId('');
    },
    onSwitchMode: (_mode) => {
      // Switch mode by navigating back to the mode selector
      onBack();
    },
    onDownload: () => {
      if (isSelectionMode && selectionCount > 0) {
        // Download selected items - use first selected item
        const firstSelectedId = Array.from(selectedItems)[0];
        const rec = recordings.find(r => r.id === firstSelectedId);
        if (rec) handleDownloadMessage(rec);
      } else if (studio.nowPlaying) {
        // Download the currently playing message
        const playing = recordings.find(r => r.id === studio.nowPlaying!.id);
        if (playing) handleDownloadMessage(playing);
      }
    },
    onArchive: () => {
      if (isSelectionMode && selectionCount > 0) {
        (async () => {
          try {
            await archiveRelayConversation(Array.from(selectedItems), activeContact?.displayName || activeContact?.handle || 'Classic');
            exitSelectionMode();
            toast.success(`Archived ${selectionCount} message${selectionCount > 1 ? 's' : ''}`);
          } catch {
            toast.error('Failed to archive');
          }
        })();
      } else {
        toast.error('Select messages first (click selection button)');
      }
    },
    onSummarize: handleSummarizeConversation,
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  // ============================================
  // RENDER
  // ============================================

  // Playback active-state helpers — derived from the shared studio transport.
  const isItemActive = (id: string) => studio.nowPlaying?.id === id;
  const isItemPlaying = (id: string) => isItemActive(id) && studio.isPlaying;

  return (
    <div className={`classic-mode ${isDarkMode ? 'dark' : 'light'} ${studio.singlePane ? 'classic--single-pane' : ''}`}>
      {/* Audio playback is owned by the shared RelayStudioProvider (single
          <audio>), so there's no local element here anymore. */}

      {/* People List Sidebar — PathC people column (mono PEOPLE header +
          search + flat people rows). The classic-sidebar wrapper + mobileView
          gating are preserved so single-pane swap doesn't regress. */}
      <aside className={`classic-sidebar ${mobileView === 'list' ? 'visible' : 'hidden-mobile'}`}>
        {/* PEOPLE · {count} header + new-conversation button */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            People · {filteredContacts.length}
          </span>
          <button
            type="button"
            onClick={() => setShowNewVoxModal(true)}
            className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="New message"
            aria-label="Start new voice conversation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="classic-search">
          <Search className="w-4 h-4" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* People List — flat rows: avatar(colorForId) + online dot, name,
            unread count, "{last} · {ago}". Active row = pulse-surface-raised. */}
        <div className="classic-contacts">
          {filteredContacts.length === 0 ? (
            <div className="classic-empty">
              <MessageCircle className="w-8 h-8" />
              <p>No conversations yet</p>
              <span>Start a new voice message to begin</span>
            </div>
          ) : (
            filteredContacts.map(user => {
              const lastVox = getLastVox(user.id);
              const isActive = activeContactId === user.id;
              const displayName = user.displayName || user.fullName || user.handle || 'Unknown';
              const online = user.onlineStatus === 'online';
              const ago = lastVox
                ? lastVox.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                : '';
              const lastLabel = lastVox
                ? `${lastVox.sender === 'me' ? 'You: ' : ''}Voice message`
                : 'Tap to start';

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setActiveContactId(user.id);
                    setMobileView('thread');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-800'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="relative shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={displayName}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ${avatarColorForId(user.id)}`}>
                        {avatarInitials(displayName)}
                      </div>
                    )}
                    {online && (
                      <span
                        className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0a0a0a]"
                        style={{ background: '#22c55e' }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {displayName}
                      </span>
                      {lastVox && lastVox.sender === 'other' && lastVox.status !== 'read' && (
                        <span className="ml-auto font-mono text-[10px] text-rose-600 dark:text-rose-400">1</span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {ago ? `${lastLabel} · ${ago}` : lastLabel}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Thread Area */}
      <main className={`classic-main ${mobileView === 'thread' ? 'visible' : 'hidden-mobile'}`}>
        {activeContact ? (
          <>
            {/* Conversation header — PathCDirect: avatar + online dot, DIRECT
                VOICE eyebrow, name, "{N} voices in thread" subtitle, and a
                right cluster carrying the AI actions + selection + archive +
                search / bookmark / settings. */}
            {(() => {
              const headerName = activeContact.displayName || activeContact.fullName || activeContact.handle || 'Conversation';
              const headerOnline = activeContact.onlineStatus === 'online';
              const hasContent = activeThreadRecordings.length > 0;
              return (
                <header className="flex items-center gap-3 px-5 py-4 border-b border-[var(--pulse-border)]">
                  {studio.singlePane && (
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="shrink-0 -ml-1 p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      aria-label="Back to people list"
                      title="Back to people"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                  <div className="relative shrink-0">
                    {activeContact.avatarUrl ? (
                      <img
                        src={activeContact.avatarUrl}
                        alt={headerName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold text-white ${avatarColorForId(activeContact.id)}`}>
                        {avatarInitials(headerName)}
                      </div>
                    )}
                    {headerOnline && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#0a0a0a]"
                        style={{ background: '#22c55e' }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      Direct Voice
                    </div>
                    <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {headerName}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {headerOnline ? 'Active now' : (activeContact.handle ? `@${activeContact.handle}` : 'Direct')}
                      {` · ${activeThreadRecordings.length} ${activeThreadRecordings.length === 1 ? 'voice' : 'voices'} in thread`}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    {/* AI actions — server-side; mono pill triggers like Notes' masthead. */}
                    {hasContent && (
                      <>
                        <button
                          type="button"
                          onClick={handleSummarizeConversation}
                          disabled={isSummarizing}
                          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[0.12em] text-rose-700 dark:text-rose-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
                          title="AI summarize conversation"
                        >
                          {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlignLeft className="w-3 h-3" />}
                          <span className="hidden lg:inline">Summarize</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateMeetingNotes}
                          disabled={isGeneratingNotes}
                          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[0.12em] text-rose-700 dark:text-rose-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
                          title="Generate meeting notes"
                        >
                          {isGeneratingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                          <span className="hidden lg:inline">Notes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => (isSelectionMode ? exitSelectionMode() : enterSelectionMode())}
                          title={isSelectionMode ? 'Exit selection' : 'Select messages'}
                          aria-label={isSelectionMode ? 'Exit selection' : 'Select messages'}
                          className={`p-1.5 rounded-md transition ${
                            isSelectionMode
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveConversation(activeContactId)}
                          title="Archive conversation"
                          aria-label="Archive conversation"
                          className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const playing = recordings.find(r => r.id === studio.nowPlaying?.id && r.contactId === activeContactId);
                        if (playing) toggleBookmark(playing.id);
                        else toast('Play a message to bookmark it');
                      }}
                      title="Bookmark"
                      aria-label="Bookmark"
                      className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowShortcutsHelp(true)}
                      title="Keyboard shortcuts"
                      aria-label="Keyboard shortcuts"
                      className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <Keyboard className="w-4 h-4" />
                    </button>
                  </div>
                </header>
              );
            })()}

            {/* Messages */}
            <div className="classic-messages" ref={threadScrollRef}>
              {hasOlderMessages && activeThreadRecordings.length > 0 && (
                <div className="flex justify-center pb-1">
                  <button
                    type="button"
                    onClick={loadOlderMessages}
                    disabled={isLoadingOlder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 border border-[var(--pulse-border)] hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
                  >
                    {isLoadingOlder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                    {isLoadingOlder ? 'Loading…' : 'Load older messages'}
                  </button>
                </div>
              )}
              {activeThreadRecordings.length === 0 ? (
                <VoxEmptyState
                  {...emptyConfig}
                  eyebrow="Direct"
                  isDarkMode={isDarkMode}
                  action={{
                    label: 'Start Recording',
                    onClick: () => {
                      if (!isRecording) startRecording();
                    },
                  }}
                  secondaryAction={inviteSecondaryAction}
                />
              ) : (
                // PathCDirect rows: flat StudioMessageCard (NOT chat bubbles).
                // me rows indent ml-12, them rows mr-12; me => rose "You"
                // avatar. All behaviors (play, selection, reactions, reply,
                // star/bookmark/menu, status, chapters, speed) ride the card's
                // slots; the reaction-picker + VoxMessageMenu stay as sibling
                // overlays inside the #vox-msg anchor wrapper (reply scroll).
                groupedThreadRecordings.map(group => (
                  <React.Fragment key={group.label}>
                    {/* Day separator — Today / Yesterday / Last week (Path C). */}
                    <div className="flex items-center gap-3 my-3 px-1 select-none">
                      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 shrink-0">
                        {group.label}
                      </span>
                      <span className="flex-1 h-px" style={{ background: 'var(--pulse-border)' }} aria-hidden="true" />
                    </div>
                    <div className="space-y-2.5">
                    {group.items.map(recording => {
                      const isMe = recording.sender === 'me';
                      const active = isItemActive(recording.id);
                      const contactName = activeContact?.displayName || activeContact?.handle || 'Contact';
                      return (
                  <div
                    key={recording.id}
                    id={`vox-msg-${recording.id}`}
                    className="relative group"
                  >
                    <StudioMessageCard
                      active={active}
                      isPlaying={isItemPlaying(recording.id)}
                      progress={active ? studio.progress : 0}
                      canPlay={!!recording.url}
                      onPlay={() => playRecording(recording)}
                      indent={isMe ? 'me' : 'them'}
                      padding="p-3.5"
                      playSize="sm"
                      waveCount={50}
                      waveSeed={recording.id}
                      bodyIndent={44}
                      avatar={{
                        label: isMe ? 'You' : avatarInitials(contactName),
                        colorClass: avatarColorForId(recording.contactId || recording.id),
                        rose: isMe,
                      }}
                      title={isMe ? 'You' : contactName}
                      meta={`${recording.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${formatDuration(recording.duration)}`}
                      headerExtras={isMe ? (
                        <span
                          className={`classic-status-icon ml-1 ${
                            recording.status === 'read'
                              ? 'text-sky-500 dark:text-sky-400'
                              : 'text-zinc-400 dark:text-zinc-500'
                          }`}
                          title={recording.status === 'read' ? 'Listened' : recording.status === 'delivered' ? 'Delivered' : 'Sent'}
                        >
                          {/* sent → single check; delivered/listened → double check;
                              listened tints sky (read-receipt convention — coral is
                              reserved for AI surfaces per CLAUDE.md). S1-2. */}
                          {recording.status === 'sent'
                            ? <Check className="w-3 h-3" />
                            : <CheckCheck className="w-3 h-3" />}
                        </span>
                      ) : undefined}
                      selectionCheckbox={isSelectionMode ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const selectionItem: VoxSelectionItem = {
                              id: recording.id,
                              type: 'audio',
                              url: recording.url,
                              duration: recording.duration,
                              timestamp: recording.timestamp,
                              sender: recording.sender,
                              transcript: recording.transcription,
                              mode: 'classic',
                              contactId: recording.contactId,
                              contactName: activeContact?.displayName || activeContact?.handle,
                            };
                            toggleSelection(selectionItem);
                          }}
                          className={`w-7 h-7 shrink-0 self-center rounded-lg flex items-center justify-center transition-all ${
                            isSelected(recording.id)
                              ? 'bg-[#f43f5e] border-2 border-[#e11d48]'
                              : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                          }`}
                          aria-label={isSelected(recording.id) ? 'Deselect message' : 'Select message'}
                        >
                          {isSelected(recording.id) && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ) : undefined}
                      actions={!isSelectionMode ? (
                        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleStar(recording.id); }}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                              recording.starred
                                ? 'text-amber-500'
                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
                            }`}
                            aria-label={recording.starred ? 'Unstar message' : 'Star message'}
                            title="Star"
                          >
                            <Star className="w-3.5 h-3.5" fill={recording.starred ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(recording.id); }}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                              recording.bookmarked
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
                            }`}
                            aria-label={recording.bookmarked ? 'Remove bookmark' : 'Bookmark message'}
                            title="Bookmark"
                          >
                            {recording.bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setReplyContext(recording); }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            aria-label="Reply"
                            title="Reply"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === recording.id ? null : recording.id); }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            aria-label="React"
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuAnchorRect(rect);
                              setShowMessageMenu(showMessageMenu === recording.id ? null : recording.id);
                            }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            aria-label="More actions"
                            title="More"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : undefined}
                    >
                      {/* Reply-to context — above the transcript */}
                      {recording.replyToId && (() => {
                        const parent = activeThreadRecordings.find(r => r.id === recording.replyToId);
                        return (
                          <button
                            type="button"
                            className="classic-reply-indicator mb-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              const el = document.getElementById(`vox-msg-${recording.replyToId}`);
                              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            <Reply className="w-3 h-3 shrink-0 opacity-60" />
                            <span className="truncate text-xs opacity-70">
                              {parent?.transcription?.slice(0, 40) || 'Voice message'}
                              {parent?.transcription && parent.transcription.length > 40 ? '...' : ''}
                            </span>
                          </button>
                        );
                      })()}

                      {/* Transcript */}
                      {recording.transcription && (
                        <div className="text-[12.5px] text-zinc-900 dark:text-zinc-100 leading-relaxed">
                          {recording.transcription}
                        </div>
                      )}

                      {/* Reactions */}
                      {recording.reactions && recording.reactions.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {recording.reactions.map((reaction, idx) => (
                            <span key={idx} className="classic-reaction-badge">{reaction.emoji}</span>
                          ))}
                        </div>
                      )}

                      {/* Footer extras — playback speed + chapters */}
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        <PlaybackSpeedControl
                          speed={studio.playbackRate}
                          onSpeedChange={studio.setPlaybackRate}
                          isDarkMode={isDarkMode}
                          compact={true}
                        />
                        {recording.transcription && recording.duration >= 30 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleGenerateChapters(recording); }}
                            className="text-xs text-[#e11d48] dark:text-[#fb7185] hover:underline flex items-center gap-1"
                            title="Generate AI chapter markers for this message"
                          >
                            <List className="w-3 h-3" />
                            {chapterRecordingId === recording.id
                              ? 'Chapters shown below ↓'
                              : `Generate Chapters (${Math.round(recording.duration)}s)`}
                          </button>
                        )}
                      </div>
                    </StudioMessageCard>

                    {/* Reaction picker — sibling overlay near the row */}
                    {showReactionPicker === recording.id && (
                      <div className="classic-reaction-picker">
                        {QUICK_REACTIONS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addReaction(recording.id, emoji)}
                            className="classic-reaction-btn"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message menu — sibling overlay anchored to the More button */}
                    {showMessageMenu === recording.id && (
                      <VoxMessageMenu
                        isDarkMode={isDarkMode}
                        accentColor={accentColor}
                        anchorRect={menuAnchorRect!}
                        onArchive={() => handleArchiveMessage(recording)}
                        onDownload={() => handleDownloadMessage(recording)}
                        onDelete={() => {
                          deleteRecording(recording.id);
                          setShowMessageMenu(null);
                        }}
                        onClose={() => setShowMessageMenu(null)}
                      />
                    )}
                  </div>
                      );
                    })}
                    </div>
                  </React.Fragment>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Recording Preview */}
            {pendingRecording && (
              <div className="classic-preview-overlay">
                <div className="classic-preview-card">
                  <RecordingPreview
                    recordingData={{
                      blob: pendingRecording.blob,
                      url: pendingRecording.url,
                      duration: pendingRecording.duration,
                      audioBuffer: pendingRecording.audioBuffer,
                    }}
                    onSend={sendRecording}
                    onCancel={cancelRecording}
                    onRetry={retryRecording}
                    isAnalyzing={isAnalyzing}
                    transcript={transcript}
                    color={accentColor}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
            )}

            {/* The in-pane record button is retired (Tier 2: the FloatingMic
                + StudioFooter RECORDING surface drive capture via the studio
                recorder). The RecordingPreview above owns review → send. */}
          </>
        ) : (
          /* No-selection empty — routed through the shared VoxEmptyState so
              Direct matches every other source. The CTA opens the new-message
              picker (the clean states used to describe the action in prose
              with nothing clickable). */
          <div className="flex-1 min-h-0">
            <VoxEmptyState
              mode="classic"
              icon={Radio}
              eyebrow="Direct"
              title="No conversation selected"
              description="Pick a contact to hear their voice, or start a new conversation."
              action={{ label: 'New message', onClick: () => setShowNewVoxModal(true) }}
              hint="Hold space to record · ? for shortcuts"
            />
          </div>
        )}
      </main>

      {/* New Vox Modal - Pulse Users Only */}
      {showNewVoxModal && (
        <div className="classic-modal-overlay" onClick={() => setShowNewVoxModal(false)}>
          <div className="classic-modal" onClick={e => e.stopPropagation()}>
            <header className="classic-modal-header">
              <h3>New message</h3>
              <button type="button" onClick={() => setShowNewVoxModal(false)} title="Close">
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="classic-modal-search">
              <Search className="w-4 h-4" />
              <input
                type="text"
                placeholder="Search Pulse users..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
              />
            </div>
            <div className="classic-modal-contacts">
              {isLoadingUsers ? (
                <div className="classic-modal-loading">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Loading Pulse users...</span>
                </div>
              ) : pickableUsers.length === 0 ? (
                <div className="classic-modal-empty">
                  <Users className="w-8 h-8" />
                  <p>No one else in this workspace</p>
                  <span>Invite a teammate to message them here</span>
                </div>
              ) : (
                pickableUsers.map(user => {
                  const displayName = user.displayName || user.fullName || user.handle || 'Unknown';
                  const initials = displayName.charAt(0).toUpperCase();
                  const subtitle = user.role || (user.handle ? `@${user.handle}` : user.company) || '';

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setActiveContactId(user.id);
                        setMobileView('thread');
                        setShowNewVoxModal(false);
                      }}
                      className="classic-modal-contact"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={displayName}
                          className="classic-avatar-img"
                        />
                      ) : (
                        <div className="classic-avatar classic-avatar-placeholder">
                          {initials}
                        </div>
                      )}
                      <div className={`classic-modal-status ${user.onlineStatus === 'online' ? 'online' : ''}`} />
                      <div className="classic-modal-contact-info">
                        <h4>{displayName}</h4>
                        <span>{subtitle}</span>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reply Context Bar */}
      {replyingTo && (
        <div className="classic-reply-bar">
          <Reply className="w-4 h-4" />
          <span>Replying to: {replyingTo.transcription?.slice(0, 50) || 'Voice message'}...</span>
          <button type="button" onClick={() => setReplyingTo(null)} title="Cancel reply">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={() => {
            const allItems: VoxSelectionItem[] = activeThreadRecordings.map(rec => ({
              id: rec.id,
              type: 'audio' as const,
              url: rec.url,
              duration: rec.duration,
              timestamp: rec.timestamp,
              sender: rec.sender,
              transcript: rec.transcription,
              mode: 'classic' as const,
              contactId: rec.contactId,
              contactName: activeContact?.displayName || activeContact?.handle,
            }));
            selectAll(allItems);
          }}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName={activeContact?.displayName || activeContact?.handle}
          isDarkMode={isDarkMode}
          accentColor="#f43f5e"
          allSelected={selectionCount === activeThreadRecordings.length && activeThreadRecordings.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Panels */}

      {/* Conversation Summary Modal */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <MessageAIPanel
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {/* Meeting Notes Modal */}
      {meetingNotes && (
        <div
          className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setMeetingNotes(null)}
        >
          <div
            className="max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageAIPanel
              meetingNotes={meetingNotes}
              isDarkMode={isDarkMode}
              onClose={() => setMeetingNotes(null)}
              defaultOpen={{ meetingNotes: true }}
            />
          </div>
        </div>
      )}

      {/* Auto-Chapters Panel */}
      {activeChapters.length > 0 && chapterRecordingId && (
        <div className="fixed bottom-[calc(1rem+var(--pulse-bottom-bar))] left-4 right-4 z-[200] max-w-2xl mx-auto">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setActiveChapters([]);
                setChapterRecordingId(null);
              }}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-[#f43f5e] text-white hover:bg-[#e11d48] transition flex items-center justify-center shadow-lg"
              title="Close chapters"
            >
              <X className="w-4 h-4" />
            </button>
            <MessageAIPanel
              chapters={activeChapters}
              currentTime={0}
              onSeek={(time) => {
                const rec = recordings.find(r => r.id === chapterRecordingId);
                if (!rec || !rec.duration) return;
                // Load the chapter's recording into the shared transport if it
                // isn't already, then seek to the chapter start (seek takes a
                // 0→1 fraction).
                if (studio.nowPlaying?.id !== rec.id) playRecording(rec);
                studio.seek(Math.min(1, Math.max(0, time / rec.duration)));
              }}
              isDarkMode={isDarkMode}
              defaultOpen={{ chapters: true }}
            />
          </div>
        </div>
      )}

      {/* Phase 6: Keyboard Shortcuts Help Modal */}
      <VoxKeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        isDarkMode={isDarkMode}
      />

      {/* Download Modal */}
      {showDownloadModal && downloadItem && (
        <VoxDownloadModal
          isOpen={showDownloadModal}
          onClose={() => { setShowDownloadModal(false); setDownloadItem(null); }}
          items={[downloadItem]}
          isDarkMode={isDarkMode}
          accentColor={accentColor}
        />
      )}
    </div>
  );
};

export default ClassicMode;
