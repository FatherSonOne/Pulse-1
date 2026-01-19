import React, { useState, useEffect, useRef } from 'react';

interface VoiceControlProps {
  enabled: boolean;
  mode: 'push-to-talk' | 'always-on' | 'wake-word';
  wakeWord?: string;
  onTranscript: (text: string, isFinal: boolean) => void;
  onCommand?: (command: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  onAudioLevel?: (level: number) => void;
  variant?: 'default' | 'compact';
  onToggleEnabled?: (enabled: boolean) => void;
  onChangeMode?: (mode: 'push-to-talk' | 'always-on' | 'wake-word') => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({
  enabled,
  mode,
  wakeWord = 'hey pulse',
  onTranscript,
  onCommand,
  onListeningChange,
  onAudioLevel,
  variant = 'default',
  onToggleEnabled,
  onChangeMode
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!enabled) {
      // Clean up when disabled
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    // Create new recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = mode !== 'push-to-talk';
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      setIsListening(true);
      onListeningChange?.(true);
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended');
      setIsListening(false);
      onListeningChange?.(false);

      // Restart if in always-on or wake-word mode and still enabled
      if (enabled && (mode === 'always-on' || mode === 'wake-word')) {
        setTimeout(() => {
          if (recognitionRef.current && enabled) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log('Recognition restart skipped');
            }
          }
        }, 100);
      }
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (final) {
        console.log('📝 Final transcript:', final);

        // Check for wake word in wake-word mode
        if (mode === 'wake-word') {
          const lowerFinal = final.toLowerCase();
          if (lowerFinal.includes(wakeWord.toLowerCase())) {
            console.log('🎯 Wake word detected!');
            setWakeWordDetected(true);
            onCommand?.('wake_word_detected');
            return;
          }
        }

        // Check for commands
        if (wakeWordDetected || mode !== 'wake-word') {
          const lowerFinal = final.toLowerCase();

          if (lowerFinal.includes('show thinking') || lowerFinal.includes('expand thinking')) {
            onCommand?.('show_thinking');
          } else if (lowerFinal.includes('hide thinking') || lowerFinal.includes('collapse thinking')) {
            onCommand?.('hide_thinking');
          } else if (lowerFinal.includes('neural terminal')) {
            onCommand?.('switch_mode:neural-terminal');
          } else if (lowerFinal.includes('sentient interface')) {
            onCommand?.('switch_mode:sentient-interface');
          } else if (lowerFinal.includes('x-ray mode') || lowerFinal.includes('xray mode')) {
            onCommand?.('switch_mode:xray-mode');
          } else if (lowerFinal.includes('command center')) {
            onCommand?.('switch_mode:command-center');
          } else {
            // Regular transcript
            onTranscript(final, true);
          }

          setWakeWordDetected(false);
        }
      } else if (interim) {
        onTranscript(interim, false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Speech recognition error:', event.error);
      // Don't stop listening on transient errors like 'no-speech'
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsListening(false);
        onListeningChange?.(false);
      }
    };

    recognitionRef.current = recognition;

    // Auto-start for always-on and wake-word modes
    if (mode === 'always-on' || mode === 'wake-word') {
      try {
        recognition.start();
        console.log('🎤 Auto-starting recognition for', mode, 'mode');
      } catch (e) {
        console.log('Recognition auto-start failed:', e);
      }
    }

    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [enabled, mode, wakeWord]);

  // Initialize audio level detection (persistent for always-on/wake-word modes)
  useEffect(() => {
    if (!enabled) {
      // Clean up when disabled
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.log('AudioContext cleanup'));
        audioContextRef.current = null;
      }
      return;
    }

    // Only initialize once when enabled
    if (audioContextRef.current) return;

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        
        source.connect(analyser);
        analyser.fftSize = 256;
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        
        const updateLevel = () => {
          if (!analyserRef.current || !audioContextRef.current) return;
          
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const level = average / 255;
          setAudioLevel(level);
          onAudioLevel?.(level);
          
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
      } catch (error) {
        console.error('Audio level detection error:', error);
      }
    };

    initAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.log('AudioContext cleanup'));
      }
    };
  }, [enabled, onAudioLevel]);

  // Handle push-to-talk keyboard
  useEffect(() => {
    if (mode !== 'push-to-talk') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isPushToTalkActive) {
        e.preventDefault();
        setIsPushToTalkActive(true);
        try {
          recognitionRef.current?.start();
        } catch (e) {
          console.log('Recognition already active');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPushToTalkActive) {
        e.preventDefault();
        setIsPushToTalkActive(false);
        recognitionRef.current?.stop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, isPushToTalkActive]);

  const togglePushToTalk = () => {
    if (mode !== 'push-to-talk') return;
    
    if (isPushToTalkActive) {
      setIsPushToTalkActive(false);
      recognitionRef.current?.stop();
    } else {
      setIsPushToTalkActive(true);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.log('Recognition already active');
      }
    }
  };

  // Compact variant for Elegant Interface
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {/* Mic Toggle Button */}
        <button
          onClick={() => onToggleEnabled?.(!enabled)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            enabled && isListening
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 animate-pulse'
              : enabled
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/30'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title={enabled ? 'Disable microphone' : 'Enable microphone'}
        >
          <i className={`fa ${enabled && isListening ? 'fa-microphone' : enabled ? 'fa-microphone' : 'fa-microphone-slash'} text-sm`}></i>
        </button>

        {/* Mode Selector (only when enabled) */}
        {enabled && onChangeMode && (
          <select
            value={mode}
            onChange={(e) => onChangeMode(e.target.value as any)}
            className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded-full px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          >
            <option value="push-to-talk">Push</option>
            <option value="always-on">Always On</option>
            <option value="wake-word">Wake Word</option>
          </select>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className="flex items-center gap-3">
      {/* Microphone Button */}
      <button
        onClick={togglePushToTalk}
        disabled={mode !== 'push-to-talk'}
        className={`relative px-4 py-2 rounded-lg font-medium transition-all ${
          isListening || isPushToTalkActive
            ? 'bg-red-600 text-white animate-pulse'
            : 'bg-gray-800 dark:bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        <i className={`fa ${isListening ? 'fa-microphone' : 'fa-microphone-slash'} mr-2`}></i>
        {mode === 'push-to-talk' && 'Hold Space'}
        {mode === 'always-on' && 'Listening'}
        {mode === 'wake-word' && (wakeWordDetected ? 'Ready' : 'Say "' + wakeWord + '"')}
      </button>

      {/* Audio Level Indicator */}
      {isListening && (
        <div className="flex items-center gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all ${
                audioLevel * 10 > i
                  ? 'h-6 bg-rose-500'
                  : 'h-3 bg-gray-700 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      )}

      {/* Interim Transcript */}
      {interimTranscript && (
        <div className="text-sm text-gray-400 italic">
          {interimTranscript}...
        </div>
      )}

      {/* Mode Indicator */}
      <div className="text-xs text-gray-500">
        {mode === 'push-to-talk' && '⌨ Push-to-Talk'}
        {mode === 'always-on' && '🔴 Always On'}
        {mode === 'wake-word' && '👂 Wake Word'}
      </div>
    </div>
  );
};
