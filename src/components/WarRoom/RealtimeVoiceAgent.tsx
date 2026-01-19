/**
 * Realtime Voice Agent Component
 * OpenAI speech-to-speech voice interface for the War Room
 * 
 * Features:
 * - WebRTC-based real-time voice communication
 * - Visual audio feedback (waveform, speaking indicators)
 * - Live transcription display
 * - Agent switching UI
 * - Tool approval dialogs
 * - Conversation history
 * - Interruption handling
 */

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import {
  RealtimeVoiceSession,
  RealtimeSessionConfig,
  RealtimeHistoryItem,
  ToolApprovalRequest,
  WAR_ROOM_AGENTS,
  createRealtimeSession,
  generateEphemeralToken,
} from '../../services/realtimeAgentService';
import { registerWarRoomTools } from '../../services/warRoomToolsService';
import { contextBankService } from '../../services/contextBankService';
import { MarkdownRenderer } from '../shared';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import '../shared/PulseTypography.css';
import toast from 'react-hot-toast';

// ============= TYPES =============

type VoiceOption = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';
type TurnDetectionOption = 'semantic_vad' | 'server_vad';
type NoiseReductionOption = 'near_field' | 'far_field';

// Language options supported by OpenAI Realtime
type LanguageOption = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'ru' | 'ja' | 'ko' | 'zh';

interface VoiceSettings {
  voice: VoiceOption;
  turnDetection: TurnDetectionOption;
  noiseReduction: NoiseReductionOption;
  language: LanguageOption;
}

export interface ContextFile {
  id: string;
  name: string;
  type: 'file' | 'text' | 'url';
  content: string;
  size?: number;
}

export type AIParticipantMode = 'active' | 'observer';

interface RealtimeVoiceAgentProps {
  userId: string;
  projectId?: string;
  sessionId?: string;
  openaiApiKey?: string;
  voiceSettings?: VoiceSettings;
  contextFiles?: ContextFile[];
  aiMode?: AIParticipantMode;
  onTranscript?: (text: string, role: 'user' | 'assistant', isFinal: boolean) => void;
  onHistoryUpdate?: (history: RealtimeHistoryItem[]) => void;
  onAgentSwitch?: (fromAgent: string, toAgent: string) => void;
  onConnectionChange?: (isConnected: boolean, isConnecting: boolean) => void;
  onAudioLevel?: (level: number, isListening: boolean, isSpeaking: boolean) => void;
  className?: string;
}

export interface RealtimeVoiceAgentRef {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
}

export type { VoiceSettings, VoiceOption, TurnDetectionOption, NoiseReductionOption, LanguageOption };

interface TranscriptLine {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
  timestamp: Date;
}

// ============= COMPONENT =============

export const RealtimeVoiceAgent = React.forwardRef<RealtimeVoiceAgentRef, RealtimeVoiceAgentProps>(({
  userId,
  projectId,
  sessionId,
  openaiApiKey,
  voiceSettings,
  contextFiles = [],
  aiMode = 'active',
  onTranscript,
  onHistoryUpdate,
  onAgentSwitch,
  onConnectionChange,
  onAudioLevel,
  className = '',
}, ref) => {
  // Default settings
  const effectiveSettings: VoiceSettings = voiceSettings || {
    voice: 'alloy',
    turnDetection: 'semantic_vad',
    noiseReduction: 'near_field',
    language: 'en',
  };
  // Session state
  const [session, setSession] = useState<RealtimeVoiceSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);

  // Agent state
  const [currentAgent, setCurrentAgent] = useState('general');
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  // Transcript state
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<{ role: 'user' | 'assistant'; text: string } | null>(null);

  // Approval state
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | null>(null);

  // Audio visualization
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | undefined>(undefined);

  // Refs
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Refs for imperative methods (defined below)
  const connectRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const disconnectRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // ============= SESSION MANAGEMENT =============

  const connect = useCallback(async () => {
    if (!openaiApiKey) {
      setError('OpenAI API key is required for voice agents');
      toast.error('OpenAI API key not configured');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Generate ephemeral token
      // Use gpt-4o-realtime-preview as the model name
      const ephemeralKey = await generateEphemeralToken(openaiApiKey, {
        model: 'gpt-4o-realtime-preview',
        voice: effectiveSettings.voice,
      });

      // Create session with configurable settings
      // Using 'low' eagerness and higher thresholds to prevent echo/feedback loops
      const config: Partial<RealtimeSessionConfig> = {
        model: 'gpt-realtime',
        voice: effectiveSettings.voice as any, // Cast to any since VoiceOption includes new voices
        turnDetection: {
          type: effectiveSettings.turnDetection,
          eagerness: 'low', // Low eagerness to prevent responding to echoes
          interruptResponse: true,
          createResponse: true,
          threshold: 0.75, // Higher threshold to reduce echo sensitivity
          silenceDurationMs: 1200, // Longer silence to ensure user finished speaking
        },
        inputAudioTranscription: {
          model: 'gpt-4o-transcribe',
          language: effectiveSettings.language || 'en',
        },
        noiseReduction: effectiveSettings.noiseReduction,
        preferredLanguage: effectiveSettings.language || 'en',
      };

      const newSession = createRealtimeSession(userId, config, projectId, sessionId);

      // Set participant mode (active vs observer)
      newSession.setParticipantMode(aiMode);

      // Set context documents if provided
      if (contextFiles.length > 0) {
        newSession.setContextDocuments(
          contextFiles.map(f => ({
            name: f.name,
            content: f.content,
            type: f.type,
          }))
        );

        // Index context files in the ContextBankService for RAG search
        const geminiApiKey = localStorage.getItem('gemini_api_key') || '';
        if (geminiApiKey) {
          const effectiveSessionId = sessionId || 'default';
          console.log(`📚 Indexing ${contextFiles.length} context files for RAG...`);

          // Index files in parallel (don't await - let it happen in background)
          Promise.all(
            contextFiles.map(async (file) => {
              try {
                await contextBankService.addDocument(
                  effectiveSessionId,
                  userId,
                  {
                    id: file.id,
                    name: file.name,
                    type: file.type,
                    content: file.content,
                  },
                  geminiApiKey
                );
                console.log(`✅ Indexed: ${file.name}`);
              } catch (error) {
                console.warn(`⚠️ Failed to index ${file.name}:`, error);
              }
            })
          ).then(() => {
            console.log('📚 All context files indexed for RAG search');
            toast.success(`${contextFiles.length} files indexed for search`);
          });
        }
      }

      // Register tools
      registerWarRoomTools(newSession);

      // Register guardrails
      newSession.registerGuardrail({
        name: 'Content Safety',
        execute: async ({ agentOutput }) => {
          // Basic content safety check
          const unsafePatterns = [
            /\b(password|secret|api[_-]?key)\s*[:=]/i,
            /\b(credit\s*card|ssn|social\s*security)\b/i,
          ];
          const isUnsafe = unsafePatterns.some(pattern => pattern.test(agentOutput));
          return {
            tripwireTriggered: isUnsafe,
            outputInfo: { reason: 'Potential sensitive information detected' },
          };
        },
      });

      // Set up event listeners
      setupEventListeners(newSession);

      // Connect
      await newSession.connect(ephemeralKey);

      setSession(newSession);
      setIsConnected(true);
      setCurrentAgent(newSession.currentAgent);
      toast.success('Voice agent connected');

    } catch (err) {
      console.error('Connection error:', err);
      let errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      
      // Provide more helpful error messages for common issues
      if (errorMessage.includes('Microphone not found') || errorMessage.includes('NotFoundError')) {
        errorMessage = 'Microphone not available. Please check that your microphone is connected and enabled, then try again.';
      } else if (errorMessage.includes('not accessible') || errorMessage.includes('NotReadableError')) {
        errorMessage = 'Microphone is not accessible. It may be in use by another application. Please close other apps using the microphone and try again.';
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and try again.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setIsConnecting(false);
    }
  }, [userId, projectId, sessionId, openaiApiKey, effectiveSettings, contextFiles]);

  const disconnect = useCallback(async () => {
    if (session) {
      await session.disconnect();
      setSession(null);
      setIsConnected(false);
      setTranscripts([]);
      setInterimTranscript(null);

      // Clear context bank for this session
      const effectiveSessionId = sessionId || 'default';
      contextBankService.clearBank(effectiveSessionId);

      toast.success('Voice agent disconnected');
    }
  }, [session, sessionId]);

  // Update refs for imperative handle
  connectRef.current = connect;
  disconnectRef.current = disconnect;

  // ============= IMPERATIVE HANDLE =============
  // Expose connect/disconnect methods to parent via ref
  useImperativeHandle(ref, () => ({
    connect: async () => {
      await connectRef.current?.();
    },
    disconnect: async () => {
      await disconnectRef.current?.();
    },
    isConnected,
    isConnecting,
  }), [isConnected, isConnecting]);

  // Notify parent of connection state changes
  useEffect(() => {
    onConnectionChange?.(isConnected, isConnecting);
  }, [isConnected, isConnecting, onConnectionChange]);

  // CRITICAL: Cleanup on unmount - ensure voice is disconnected when component unmounts
  useEffect(() => {
    return () => {
      console.log('[RealtimeVoiceAgent] Component unmounting - cleaning up...');
      if (disconnectRef.current) {
        disconnectRef.current().catch((err) => {
          console.error('[RealtimeVoiceAgent] Error during cleanup disconnect:', err);
        });
      }
    };
  }, []);

  const setupEventListeners = (session: RealtimeVoiceSession) => {
    session.on('connected', () => {
      console.log('🎤 Voice session connected');
    });

    session.on('disconnected', (event) => {
      console.log('🎤 Voice session disconnected:', event);
      setIsConnected(false);
    });

    session.on('transcript_delta', (event) => {
      if (event.type !== 'transcript_delta') return;
      
      if (event.isFinal) {
        // Add to permanent transcripts
        const newLine: TranscriptLine = {
          id: `${Date.now()}-${Math.random()}`,
          role: event.role,
          text: event.delta,
          isFinal: true,
          timestamp: new Date(),
        };
        setTranscripts(prev => [...prev, newLine]);
        setInterimTranscript(null);
        onTranscript?.(event.delta, event.role, true);
      } else {
        // Update interim transcript
        setInterimTranscript({ role: event.role, text: event.delta });
        onTranscript?.(event.delta, event.role, false);
      }
    });

    session.on('history_updated', (event) => {
      if (event.type !== 'history_updated') return;
      onHistoryUpdate?.(event.history);
    });

    session.on('agent_switched', (event) => {
      if (event.type !== 'agent_switched') return;
      setCurrentAgent(event.toAgent);
      onAgentSwitch?.(event.fromAgent, event.toAgent);
      toast.success(`Switched to ${WAR_ROOM_AGENTS[event.toAgent]?.name || event.toAgent}`);
    });

    session.on('tool_approval_requested', (event) => {
      if (event.type !== 'tool_approval_requested') return;
      setPendingApproval(event.request);
    });

    session.on('tool_call_started', (event) => {
      if (event.type !== 'tool_call_started') return;
      toast.loading(`Running ${event.toolName}...`, { id: `tool-${event.toolName}` });
    });

    session.on('tool_call_completed', (event) => {
      if (event.type !== 'tool_call_completed') return;
      toast.success(`${event.toolName} completed`, { id: `tool-${event.toolName}` });
    });

    session.on('guardrail_tripped', (event) => {
      if (event.type !== 'guardrail_tripped') return;
      toast.error(`Safety guardrail triggered: ${event.guardrailName}`);
    });

    session.on('audio_interrupted', () => {
      setIsSpeaking(false);
    });

    session.on('error', (event) => {
      if (event.type !== 'error') return;
      console.error('Voice session error:', event.error);
      toast.error(event.error.message);
    });

    // Update speaking/listening states
    session.on('*', (event) => {
      if (session) {
        setIsSpeaking(session.isSpeaking);
        setIsListening(session.isListening);
      }
    });
  };

  // ============= AUDIO VISUALIZATION =============

  // Ref for simulated speaking animation
  const speakingAnimationRef = useRef<number | undefined>(undefined);
  const speakingStartTimeRef = useRef<number>(0);

  // Listen mode - real microphone audio level
  useEffect(() => {
    if (!isConnected || !isListening) {
      if (!isSpeaking) {
        setAudioLevel(0);
        onAudioLevel?.(0, false, false);
      }
      return;
    }

    const initAudioVisualization = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        source.connect(analyser);
        analyser.fftSize = 256;

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const updateLevel = () => {
          if (!analyserRef.current) return;

          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const level = average / 255;
          setAudioLevel(level);
          onAudioLevel?.(level, true, false);

          animationRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (err) {
        console.error('Audio visualization error:', err);
      }
    };

    initAudioVisualization();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isConnected, isListening, isSpeaking, onAudioLevel]);

  // Speaking mode - simulated audio level for visual feedback
  useEffect(() => {
    if (!isConnected || !isSpeaking) {
      if (speakingAnimationRef.current) {
        cancelAnimationFrame(speakingAnimationRef.current);
        speakingAnimationRef.current = undefined;
      }
      return;
    }

    speakingStartTimeRef.current = Date.now();

    const animateSpeaking = () => {
      const t = (Date.now() - speakingStartTimeRef.current) / 1000;

      // Create organic-feeling speech pattern with multiple sine waves
      // This simulates natural speech cadence with varying intensity
      const baseWave = Math.sin(t * 8) * 0.3;  // Fast oscillation for syllables
      const midWave = Math.sin(t * 3) * 0.25;  // Medium for word groupings
      const slowWave = Math.sin(t * 0.8) * 0.15; // Slow for sentence rhythm
      const breathPattern = Math.sin(t * 0.3) * 0.1; // Breathing/pause pattern

      // Add some randomness for natural feel
      const noise = (Math.random() - 0.5) * 0.15;

      // Combine and normalize to 0.3-0.9 range (speaking is never silent)
      const level = Math.max(0.3, Math.min(0.9, 0.55 + baseWave + midWave + slowWave + breathPattern + noise));

      setAudioLevel(level);
      onAudioLevel?.(level, false, true);

      speakingAnimationRef.current = requestAnimationFrame(animateSpeaking);
    };

    animateSpeaking();

    return () => {
      if (speakingAnimationRef.current) {
        cancelAnimationFrame(speakingAnimationRef.current);
      }
    };
  }, [isConnected, isSpeaking, onAudioLevel]);

  // ============= AUTO-MUTE DURING SPEAKING (Echo Prevention) =============
  // Automatically mute microphone while AI is speaking to prevent echo feedback loop

  useEffect(() => {
    if (!session) return;

    if (isSpeaking) {
      // Mute microphone when AI starts speaking
      session.setMuted(true);
    } else if (!isMuted) {
      // Restore microphone after a longer delay when AI stops speaking
      // The delay helps prevent immediate re-triggering from audio echo
      // Increased to 1500ms to allow echo to fully dissipate
      const unmuteDelay = setTimeout(() => {
        session.setMuted(false);
      }, 1500); // 1.5 second delay after speaking stops for echo to die down

      return () => clearTimeout(unmuteDelay);
    }
  }, [isSpeaking, isMuted, session]);

  // ============= SCROLL TO BOTTOM =============

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, interimTranscript]);

  // ============= HANDLERS =============

  const handleMuteToggle = () => {
    if (session) {
      session.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (session) {
      session.setVolume(newVolume);
    }
  };

  const handleInterrupt = () => {
    if (session) {
      session.interrupt();
    }
  };

  const handleAgentSwitch = (agentName: string) => {
    if (session) {
      session.switchAgent(agentName);
    }
    setShowAgentPicker(false);
  };

  const handleApprove = () => {
    if (session && pendingApproval) {
      session.approve(pendingApproval);
      setPendingApproval(null);
    }
  };

  const handleReject = () => {
    if (session && pendingApproval) {
      session.reject(pendingApproval);
      setPendingApproval(null);
    }
  };

  const handleSendText = (text: string) => {
    if (session && text.trim()) {
      session.sendMessage(text);
    }
  };

  // ============= RENDER =============

  return (
    <div className={`realtime-voice-agent ${className}`}>
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between p-3 bg-gray-900/80 backdrop-blur-sm border-b border-cyan-500/30">
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          }`} />
          
          <span className="text-sm text-gray-300">
            {isConnecting ? 'Connecting...' : isConnected ? 'Voice Active' : 'Disconnected'}
          </span>

          {/* Current Agent Badge */}
          {isConnected && (
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
            >
              {WAR_ROOM_AGENTS[currentAgent]?.name || currentAgent}
              <i className="fa fa-chevron-down ml-1 text-[10px]" />
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              {/* Mute Button */}
              <button
                onClick={handleMuteToggle}
                className={`p-2 rounded-lg transition-colors ${
                  isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <i className={`fa ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`} />
              </button>

              {/* Interrupt Button */}
              {isSpeaking && (
                <button
                  onClick={handleInterrupt}
                  className="p-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                  title="Interrupt"
                >
                  <i className="fa fa-hand-paper" />
                </button>
              )}

              {/* Disconnect Button */}
              <button
                onClick={disconnect}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Disconnect"
              >
                <i className="fa fa-phone-slash" />
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 transition-all"
            >
              {isConnecting ? (
                <>
                  <i className="fa fa-spinner fa-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <i className="fa fa-microphone mr-2" />
                  Start Voice
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Agent Picker Dropdown */}
      {showAgentPicker && (
        <div className="absolute z-50 mt-1 p-2 bg-gray-900 border border-cyan-500/30 rounded-lg shadow-xl">
          {Object.entries(WAR_ROOM_AGENTS).map(([key, agent]) => (
            <button
              key={key}
              onClick={() => handleAgentSwitch(key)}
              className={`w-full px-3 py-2 text-left rounded-lg transition-colors ${
                currentAgent === key
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs text-gray-500">{agent.handoffDescription}</div>
            </button>
          ))}
        </div>
      )}

      {/* Audio Visualization */}
      {isConnected && (
        <div className="p-4 flex justify-center items-center gap-1">
          {/* Waveform Bars */}
          {Array.from({ length: 20 }).map((_, i) => {
            const barHeight = isListening
              ? Math.max(8, audioLevel * 100 * Math.sin((i / 20) * Math.PI) + Math.random() * 20)
              : isSpeaking
              ? Math.max(8, 40 + Math.sin((Date.now() / 100 + i) * 0.5) * 30)
              : 8;
            
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isListening
                    ? 'bg-gradient-to-t from-cyan-500 to-blue-500'
                    : isSpeaking
                    ? 'bg-gradient-to-t from-purple-500 to-pink-500'
                    : 'bg-gray-700'
                }`}
                style={{ height: `${barHeight}px` }}
              />
            );
          })}
        </div>
      )}

      {/* Status Indicators */}
      {isConnected && (
        <div className="flex justify-center gap-4 pb-4">
          {isListening && (
            <div className="flex items-center gap-2 text-cyan-400 text-sm">
              <i className="fa fa-microphone animate-pulse" />
              Listening...
            </div>
          )}
          {isSpeaking && (
            <div className="flex items-center gap-2 text-purple-400 text-sm">
              <i className="fa fa-volume-up animate-pulse" />
              Speaking...
            </div>
          )}
        </div>
      )}

      {/* Transcript Area - Archives-style formatting */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
        {transcripts.map((line) => (
          <div
            key={line.id}
            className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl ${
                line.role === 'user'
                  ? 'bg-cyan-500/15 border border-cyan-500/20 text-cyan-100 rounded-br-md px-4 py-3'
                  : 'bg-zinc-900/80 border border-zinc-800 text-zinc-200 rounded-bl-md px-5 py-4'
              }`}
            >
              {/* Label - Archives mono style */}
              <div className="font-mono text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                {line.role === 'user' ? (
                  <span className="text-cyan-400">You</span>
                ) : (
                  <>
                    <span className="text-red-400">{WAR_ROOM_AGENTS[currentAgent]?.name || 'AI'}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500">{line.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>
              {/* Content - Markdown for AI, plain for user */}
              {line.role === 'assistant' ? (
                <MarkdownRenderer content={line.text} className="text-zinc-200" />
              ) : (
                <div className="text-sm leading-relaxed">{line.text}</div>
              )}
            </div>
          </div>
        ))}

        {/* Interim Transcript */}
        {interimTranscript && (
          <div className={`flex ${interimTranscript.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl opacity-70 ${
                interimTranscript.role === 'user'
                  ? 'bg-cyan-500/10 border border-cyan-500/10 text-cyan-200 rounded-br-md px-4 py-3'
                  : 'bg-zinc-900/50 border border-zinc-800/50 text-zinc-300 rounded-bl-md px-5 py-4'
              }`}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest mb-2 text-zinc-500 flex items-center gap-2">
                <span>{interimTranscript.role === 'user' ? 'You' : 'AI'}</span>
                <span className="animate-pulse">•••</span>
              </div>
              <div className="text-sm leading-relaxed">{interimTranscript.text}</div>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Tool Approval Modal */}
      {pendingApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <i className="fa fa-exclamation-triangle text-yellow-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Approval Required</h3>
                <p className="text-sm text-gray-400">The AI wants to perform an action</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-400 mb-1">Tool</div>
              <div className="text-white font-medium">{pendingApproval.toolName}</div>
              
              <div className="text-sm text-gray-400 mt-3 mb-1">Parameters</div>
              <pre className="text-cyan-400 text-sm overflow-x-auto">
                {JSON.stringify(pendingApproval.arguments, null, 2)}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <i className="fa fa-times mr-2" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-400 hover:to-emerald-400 transition-colors"
              >
                <i className="fa fa-check mr-2" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/10 border-t border-red-500/30 text-red-400 text-sm">
          <i className="fa fa-exclamation-circle mr-2" />
          {error}
        </div>
      )}

      {/* Text Input Fallback */}
      {isConnected && (
        <div className="p-3 border-t border-gray-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('textInput') as HTMLInputElement;
              if (input.value.trim()) {
                handleSendText(input.value);
                input.value = '';
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              name="textInput"
              placeholder="Type a message (or just speak)..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            {/* Voice-to-Text Button for text input */}
            <VoiceTextButton
              onTranscript={(text) => {
                const input = document.querySelector('input[name="textInput"]') as HTMLInputElement;
                if (input) {
                  input.value = input.value + (input.value && !input.value.endsWith(' ') ? ' ' : '') + text;
                  input.focus();
                }
              }}
              size="md"
              className="bg-gray-800 hover:bg-gray-700"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
            >
              <i className="fa fa-paper-plane" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
});

RealtimeVoiceAgent.displayName = 'RealtimeVoiceAgent';

export default RealtimeVoiceAgent;
