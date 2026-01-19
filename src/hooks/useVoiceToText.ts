/**
 * useVoiceToText Hook
 *
 * A reusable hook for speech-to-text functionality with dual provider support:
 * 1. Web Speech API (browser-native, instant, no API key required)
 * 2. OpenAI gpt-4o-transcribe (higher accuracy, requires API key)
 *
 * Features:
 * - Automatic fallback between providers
 * - Interim results for real-time feedback
 * - Append mode for accumulating transcripts
 * - Proper cleanup on unmount
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============= TYPES =============

export type VoiceToTextProvider = 'web-speech' | 'openai';

export interface UseVoiceToTextOptions {
  /** Language code (e.g., 'en-US', 'es-ES') */
  language?: string;
  /** Keep listening after each result (for continuous dictation) */
  continuous?: boolean;
  /** Preferred provider. If not set, uses automatic fallback */
  provider?: VoiceToTextProvider;
  /** OpenAI API key (required for 'openai' provider) */
  openaiApiKey?: string;
  /** Called with partial transcript while speaking */
  onInterimResult?: (text: string) => void;
  /** Called with final transcript when speech ends */
  onFinalResult?: (text: string) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Enable keyboard shortcut (hold key to dictate). Default: false */
  enableKeyboardShortcut?: boolean;
  /** Key to hold for dictation. Default: ' ' (space) */
  shortcutKey?: string;
}

export interface UseVoiceToTextReturn {
  /** Whether currently listening for speech */
  isListening: boolean;
  /** Whether voice-to-text is supported (at least one provider available) */
  isSupported: boolean;
  /** Which provider is currently being used */
  activeProvider: VoiceToTextProvider | null;
  /** Accumulated transcript from all dictation sessions */
  transcript: string;
  /** Current partial transcript (while speaking) */
  interimTranscript: string;
  /** Error message if any */
  error: string | null;
  /** Start listening for speech */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Toggle listening state */
  toggleListening: () => void;
  /** Clear accumulated transcript */
  clearTranscript: () => void;
  /** Switch to a different provider */
  switchProvider: (provider: VoiceToTextProvider) => void;
}

// ============= BROWSER SPEECH API =============

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ============= HOOK IMPLEMENTATION =============

const getWebSpeechRecognition = (): (new () => SpeechRecognition) | null => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export function useVoiceToText(options: UseVoiceToTextOptions = {}): UseVoiceToTextReturn {
  const {
    language = 'en-US',
    continuous = false,
    provider: preferredProvider,
    openaiApiKey,
    onInterimResult,
    onFinalResult,
    onError,
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<VoiceToTextProvider | null>(null);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Determine provider support
  const SpeechRecognitionClass = getWebSpeechRecognition();
  const webSpeechSupported = SpeechRecognitionClass !== null;
  const openaiSupported = !!openaiApiKey;
  const isSupported = webSpeechSupported || openaiSupported;

  // Determine which provider to use
  const determineProvider = useCallback((): VoiceToTextProvider | null => {
    if (preferredProvider === 'openai' && openaiSupported) return 'openai';
    if (preferredProvider === 'web-speech' && webSpeechSupported) return 'web-speech';
    if (webSpeechSupported) return 'web-speech';
    if (openaiSupported) return 'openai';
    return null;
  }, [preferredProvider, webSpeechSupported, openaiSupported]);

  // Initialize provider on mount
  useEffect(() => {
    setActiveProvider(determineProvider());
  }, [determineProvider]);

  // ============= WEB SPEECH API IMPLEMENTATION =============

  const startWebSpeech = useCallback(() => {
    if (!SpeechRecognitionClass) {
      setError('Web Speech API not supported');
      onError?.('Web Speech API not supported');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

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
          setTranscript(prev => {
            const newTranscript = prev + (prev && !prev.endsWith(' ') ? ' ' : '') + final;
            return newTranscript;
          });
          onFinalResult?.(final);
        }

        setInterimTranscript(interim);
        if (interim) {
          onInterimResult?.(interim);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMessages: Record<string, string> = {
          'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
          'no-speech': 'No speech detected. Please try again.',
          'audio-capture': 'No microphone found. Please check your device.',
          'network': 'Network error. Please check your connection.',
          'aborted': 'Speech recognition was aborted.',
          'service-not-allowed': 'Speech recognition service not allowed.',
        };

        const errorMsg = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
        setError(errorMsg);
        onError?.(errorMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start speech recognition';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [SpeechRecognitionClass, continuous, language, onFinalResult, onInterimResult, onError]);

  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // ============= OPENAI WHISPER TRANSCRIPTION IMPLEMENTATION =============

  const startOpenAI = useCallback(async () => {
    if (!openaiApiKey) {
      setError('OpenAI API key required');
      onError?.('OpenAI API key required');
      return;
    }

    try {
      console.log('🎤 Starting Whisper API recording...');
      
      // Request microphone access with optimal settings for Whisper
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Whisper prefers 16kHz
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Determine supported MIME type - Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎤 Recording stopped, processing with Whisper...');
        
        // Process the recorded audio
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Skip if no audio data
        if (audioBlob.size === 0) {
          console.warn('⚠️ No audio data recorded');
          setIsListening(false);
          return;
        }

        console.log(`📊 Audio blob size: ${(audioBlob.size / 1024).toFixed(2)} KB`);

        try {
          // Use Whisper API via our service
          const { WhisperService } = await import('../services/whisperService');
          const whisperService = new WhisperService(openaiApiKey);

          // Transcribe with Whisper
          const result = await whisperService.transcribe(audioBlob, {
            language: language ? language.split('-')[0] : undefined, // 'en-US' -> 'en'
            temperature: 0.2, // Lower temperature for better accuracy
            prompt: 'Transcribe this voice command or message accurately with proper punctuation.',
            response_format: 'verbose_json',
          });

          const text = result.text?.trim();
          console.log('✅ Whisper transcription:', text);

          if (text) {
            setTranscript(prev => {
              const newTranscript = prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text;
              return newTranscript;
            });
            onFinalResult?.(text);
          } else {
            console.warn('⚠️ Whisper returned empty transcription');
            setError('No speech detected');
            onError?.('No speech detected');
          }
        } catch (err) {
          console.error('❌ Whisper transcription error:', err);
          const errorMsg = err instanceof Error ? err.message : 'Transcription failed';
          setError(`Whisper error: ${errorMsg}`);
          onError?.(`Whisper error: ${errorMsg}`);
        } finally {
          setIsListening(false);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setError(null);
      console.log('🎤 Recording started...');
    } catch (err) {
      console.error('❌ Microphone access error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [openaiApiKey, language, onFinalResult, onError]);

  const stopOpenAI = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setInterimTranscript('');
  }, []);

  // ============= PUBLIC API =============

  const startListening = useCallback(() => {
    if (isListening) return;

    const provider = determineProvider();
    setActiveProvider(provider);

    if (provider === 'web-speech') {
      startWebSpeech();
    } else if (provider === 'openai') {
      startOpenAI();
    } else {
      setError('No speech recognition provider available');
      onError?.('No speech recognition provider available');
    }
  }, [isListening, determineProvider, startWebSpeech, startOpenAI, onError]);

  const stopListening = useCallback(() => {
    if (activeProvider === 'web-speech') {
      stopWebSpeech();
    } else if (activeProvider === 'openai') {
      stopOpenAI();
    }
  }, [activeProvider, stopWebSpeech, stopOpenAI]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const switchProvider = useCallback((newProvider: VoiceToTextProvider) => {
    if (isListening) {
      stopListening();
    }
    setActiveProvider(newProvider);
  }, [isListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Keyboard shortcut support (hold key to dictate)
  useEffect(() => {
    if (!options.enableKeyboardShortcut) return;

    const shortcutKey = options.shortcutKey || ' '; // Default: spacebar
    let isKeyHeld = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea (unless it's the designated shortcut)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // For spacebar, only trigger when NOT in an input field
      if (shortcutKey === ' ' && isInput) return;

      // For other keys (like Ctrl+Shift+D), allow anywhere
      if (e.key === shortcutKey && !isKeyHeld && !e.repeat) {
        isKeyHeld = true;
        startListening();
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && isKeyHeld) {
        isKeyHeld = false;
        stopListening();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [options.enableKeyboardShortcut, options.shortcutKey, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    activeProvider,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    switchProvider,
  };
}

export default useVoiceToText;
