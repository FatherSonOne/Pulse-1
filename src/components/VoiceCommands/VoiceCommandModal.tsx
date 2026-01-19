/**
 * VoiceCommandModal Component
 *
 * Full-screen voice command modal with OpenAI TTS voice feedback.
 * Provides an immersive voice command experience with visual feedback.
 *
 * Uses Web Speech API for real-time transcription (immediate visual feedback)
 * and OpenAI TTS for high-quality voice responses.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voiceCommandService } from '../../services/voiceCommandService';
import { VOICE_COMMAND_TEMPLATES } from '../../hooks/useVoiceCommands';
import './VoiceCommands.css';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: string) => void;
  openaiApiKey?: string;
  userId?: string;
}

// Voice options for OpenAI TTS
type VoiceOption = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// Use existing Window type augmentation from useVoiceToText.ts
type SpeechRecognitionConstructor = new () => SpeechRecognition;

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  openaiApiKey,
  userId,
}) => {
  // Voice commands should be silent by default (no TTS/audio playback).
  const enableAudioFeedback = false;

  // Voice command state
  const [mode, setMode] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>('alloy');
  const [error, setError] = useState<string | null>(null);

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Speech recognition ref (using Web Speech API for real-time feedback)
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  // Audio visualization
  const [audioLevel, setAudioLevel] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Speak function reference for callbacks
  const speakRef = useRef<((text: string) => Promise<void>) | null>(null);

  // Check if Web Speech API is supported
  const SpeechRecognitionClass: SpeechRecognitionConstructor | null = typeof window !== 'undefined'
    ? (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition ||
      null
    : null;

  // Initialize audio context for visualization
  useEffect(() => {
    if (isOpen && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      } catch (e) {
        console.warn('AudioContext not supported');
      }
    }
  }, [isOpen]);

  // Speak using OpenAI TTS API
  const speakWithTTS = useCallback(async (text: string) => {
    if (!enableAudioFeedback) return;
    if (!text.trim()) return;

    // Fallback to browser speech synthesis if no API key
    if (!openaiApiKey) {
      if (window.speechSynthesis) {
        setMode('speaking');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => setMode('idle');
        window.speechSynthesis.speak(utterance);
      }
      return;
    }

    setMode('speaking');
    try {
      // Call OpenAI TTS API
      const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: selectedVoice,
          response_format: 'mp3',
        }),
      });

      if (!ttsResponse.ok) {
        throw new Error(`TTS API error: ${ttsResponse.status}`);
      }

      const audioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Connect to analyser for visualization
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }

      audio.onended = () => {
        setMode('idle');
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setMode('idle');
        setError('Audio playback failed');
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();

    } catch (err) {
      console.error('TTS failed:', err);
      setMode('idle');
      // Fallback to browser speech synthesis
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setMode('idle');
        window.speechSynthesis.speak(utterance);
        setMode('speaking');
      }
    }
  }, [openaiApiKey, selectedVoice, enableAudioFeedback]);

  // Update speak ref
  useEffect(() => {
    speakRef.current = speakWithTTS;
  }, [speakWithTTS]);

  // Process voice command with timeout
  const processVoiceCommand = useCallback(async (text: string) => {
    if (!text.trim()) {
      setMode('idle');
      return;
    }

    setMode('processing');
    setTranscript(text);
    setInterimTranscript('');

    // Add timeout to prevent infinite processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setMode('idle');
      setError('Command processing timed out. Please try again.');
    }, 10000);

    try {
      // Parse and execute the command directly
      const command = await voiceCommandService.parseCommandWithAI(text, openaiApiKey);

      if (controller.signal.aborted) return;

      const result = await voiceCommandService.executeCommand(command);
      clearTimeout(timeoutId);

      if (controller.signal.aborted) return;

      setResponse(result.message);

      if (result.success) {
        // Handle navigation
        if (command.type === 'navigate' && result.data?.view) {
          onNavigate?.(result.data.view);
        }
        // Voice feedback (disabled)
        if (enableAudioFeedback) {
          await speakWithTTS(result.message);
        } else {
          setMode('idle');
        }
      } else {
        setMode('idle');
        setError(result.message);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (!controller.signal.aborted) {
        setError('Failed to process command');
        setMode('idle');
      }
    }
  }, [openaiApiKey, onNavigate, speakWithTTS]);

  // Start listening with Web Speech API (real-time feedback)
  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    setMode('listening');
    setTranscript('');
    setInterimTranscript('');
    setResponse('');
    setError(null);
    finalTranscriptRef.current = '';

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;

          if (result.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        if (final) {
          finalTranscriptRef.current += final;
          setTranscript(finalTranscriptRef.current);
        }

        setInterimTranscript(interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setError(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // Only set to idle if we're still in listening mode
        // (not if we've moved to processing)
        if (mode === 'listening') {
          setMode('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setError('Failed to start speech recognition');
      setMode('idle');
    }
  }, [SpeechRecognitionClass, mode]);

  // Stop listening and process command
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Get the final transcript
    const text = finalTranscriptRef.current || transcript || interimTranscript;

    if (text.trim()) {
      processVoiceCommand(text.trim());
    } else {
      setMode('idle');
    }
  }, [transcript, interimTranscript, processVoiceCommand]);

  // Audio visualization
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw circular waveform
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.3;

      // Number of bars
      const bars = 64;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        const amplitude = mode === 'listening' || mode === 'speaking'
          ? audioLevel * 50 + Math.sin(Date.now() / 100 + i) * 20
          : Math.sin(Date.now() / 500 + i) * 5;

        const innerRadius = baseRadius;
        const outerRadius = baseRadius + amplitude;

        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * outerRadius;
        const y2 = centerY + Math.sin(angle) * outerRadius;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        // Color based on mode
        const alpha = 0.5 + (amplitude / 100) * 0.5;
        if (mode === 'listening') {
          ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`; // Green
        } else if (mode === 'processing') {
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`; // Amber
        } else if (mode === 'speaking') {
          ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`; // Purple
        } else {
          ctx.strokeStyle = `rgba(156, 163, 175, ${alpha})`; // Gray
        }

        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = mode === 'listening' ? 'rgba(16, 185, 129, 0.2)' :
                      mode === 'processing' ? 'rgba(245, 158, 11, 0.2)' :
                      mode === 'speaking' ? 'rgba(99, 102, 241, 0.2)' :
                      'rgba(156, 163, 175, 0.1)';
      ctx.fill();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mode, audioLevel]);

  // Simulate audio level changes
  useEffect(() => {
    if (mode === 'listening' || mode === 'speaking') {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 0.5 + 0.5);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAudioLevel(0);
    }
  }, [mode]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Cancel any speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      setTranscript('');
      setInterimTranscript('');
      setResponse('');
      setError(null);
      setMode('idle');
      finalTranscriptRef.current = '';
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && mode === 'idle') {
        e.preventDefault();
        startListening();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === ' ' && mode === 'listening') {
        e.preventDefault();
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, mode, startListening, stopListening, onClose]);

  if (!isOpen) return null;

  return (
    <div className="voice-modal-overlay" onClick={onClose}>
      <div className="voice-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          className="voice-modal-close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close voice commands"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        {/* Voice settings */}
        <div className="voice-modal-settings">
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value as VoiceOption)}
            disabled={mode === 'speaking'}
          >
            <option value="alloy">Alloy</option>
            <option value="ash">Ash</option>
            <option value="ballad">Ballad</option>
            <option value="coral">Coral</option>
            <option value="echo">Echo</option>
            <option value="sage">Sage</option>
            <option value="shimmer">Shimmer</option>
            <option value="verse">Verse</option>
          </select>
          <span className={`voice-modal-status ${openaiApiKey ? 'connected' : ''}`}>
            {openaiApiKey ? 'Real-time + TTS' : 'Browser Speech'}
          </span>
        </div>

        {/* Visualization */}
        <div className="voice-modal-viz">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="voice-modal-canvas"
          />

          {/* Center icon */}
          <div className={`voice-modal-center-icon voice-modal-${mode}`}>
            {mode === 'listening' && (
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
            {mode === 'processing' && (
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" className="voice-spin">
                <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
              </svg>
            )}
            {mode === 'speaking' && (
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
            {mode === 'idle' && (
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="voice-modal-status-text">
          {mode === 'idle' && 'Press and hold Space to speak'}
          {mode === 'listening' && 'Listening...'}
          {mode === 'processing' && 'Processing...'}
          {mode === 'speaking' && 'Speaking...'}
        </div>

        {/* Transcript - show real-time feedback */}
        {(transcript || interimTranscript) && (
          <div className="voice-modal-transcript">
            <span className="voice-modal-transcript-label">
              {mode === 'listening' ? 'Hearing:' : 'You said:'}
            </span>
            <span className="voice-modal-transcript-text">
              "{transcript}{interimTranscript && (
                <span className="voice-modal-interim">{interimTranscript}</span>
              )}"
            </span>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="voice-modal-response">
            {response}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="voice-modal-error">
            {error}
          </div>
        )}

        {/* Action button */}
        <button
          className={`voice-modal-action ${mode === 'listening' ? 'active' : ''}`}
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={() => { if (mode === 'listening') stopListening(); }}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
        >
          {mode === 'listening' ? 'Release to send' : 'Hold to speak'}
        </button>

        {/* Quick commands */}
        <div className="voice-modal-quick-commands">
          <span className="voice-modal-quick-label">Try saying:</span>
          <div className="voice-modal-quick-list">
            {VOICE_COMMAND_TEMPLATES.navigation.slice(0, 4).map((item, i) => (
              <button
                key={i}
                className="voice-modal-quick-btn"
                onClick={() => processVoiceCommand(item.command)}
              >
                "{item.command}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCommandModal;
