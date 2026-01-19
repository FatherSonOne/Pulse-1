import React, { useState, useEffect, useRef } from 'react';

interface VoiceSynthesisProps {
  enabled: boolean;
  voice: 'male' | 'female' | 'neutral';
  speed?: number;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

export const VoiceSynthesis: React.FC<VoiceSynthesisProps> = ({
  enabled,
  voice,
  speed = 1.0,
  onSpeakingChange
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);

      // Select appropriate voice based on gender preference
      let preferredVoice: SpeechSynthesisVoice | null = null;

      if (voice === 'male') {
        // Look for male voices (common names)
        preferredVoice = voices.find(v => 
          v.name.includes('Male') ||
          v.name.includes('David') ||
          v.name.includes('Mark') ||
          v.name.includes('Alex') && v.name.includes('(Enhanced)') ||
          (v.lang.startsWith('en') && !v.name.includes('Female') && !v.name.includes('Samantha'))
        ) || voices[0];
      } else if (voice === 'female') {
        // Look for female voices (common names)
        preferredVoice = voices.find(v =>
          v.name.includes('Female') ||
          v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Victoria') ||
          v.name.includes('Zira')
        ) || voices[0];
      } else {
        // Neutral - just use default
        preferredVoice = voices.find(v => v.default) || voices[0];
      }

      setSelectedVoice(preferredVoice);
    };

    loadVoices();

    // Some browsers load voices asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [voice]);

  useEffect(() => {
    if (onSpeakingChange) {
      onSpeakingChange(isSpeaking);
    }
  }, [isSpeaking, onSpeakingChange]);

  const speak = (text: string) => {
    if (!enabled || !selectedVoice) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = speed;
    utterance.pitch = voice === 'male' ? 0.8 : voice === 'female' ? 1.2 : 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const pause = () => {
    window.speechSynthesis.pause();
  };

  const resume = () => {
    window.speechSynthesis.resume();
  };

  // Expose methods via ref (for parent components)
  React.useImperativeHandle(React.useRef(), () => ({
    speak,
    stop,
    pause,
    resume,
    isSpeaking
  }));

  return null; // This component doesn't render anything
};

// Voice model configurations matching settings
const voiceModelConfig: Record<string, { gender: 'male' | 'female' | 'neutral'; keywords: string[] }> = {
  alloy: { gender: 'neutral', keywords: ['Google', 'Natural', 'Neural'] },
  echo: { gender: 'male', keywords: ['David', 'Mark', 'Daniel', 'Natural', 'Male'] },
  fable: { gender: 'neutral', keywords: ['Enhanced', 'Premium', 'Natural'] },
  onyx: { gender: 'male', keywords: ['James', 'Thomas', 'Oliver', 'Deep'] },
  nova: { gender: 'female', keywords: ['Samantha', 'Karen', 'Moira', 'Natural'] },
  shimmer: { gender: 'female', keywords: ['Victoria', 'Fiona', 'Serena'] },
  sage: { gender: 'neutral', keywords: ['Alex', 'Natural', 'Google'] },
  coral: { gender: 'female', keywords: ['Zoe', 'Tessa', 'Anna', 'Linda'] },
  verse: { gender: 'neutral', keywords: ['Enhanced', 'Premium', 'Eloquence'] },
};

// Hook for easy use in components
export const useVoiceSynthesis = (enabled: boolean, voice: 'male' | 'female' | 'neutral' = 'neutral') => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      // Get saved voice model from settings
      const savedModel = localStorage.getItem('pulse_ai_voice_model') || 'alloy';
      const modelConfig = voiceModelConfig[savedModel] || voiceModelConfig.alloy;

      let preferredVoice: SpeechSynthesisVoice | null = null;

      // First try to find a voice matching the model's keywords
      for (const keyword of modelConfig.keywords) {
        preferredVoice = voices.find(v =>
          v.name.toLowerCase().includes(keyword.toLowerCase()) &&
          v.lang.startsWith('en')
        ) || null;
        if (preferredVoice) break;
      }

      // Fallback to gender-based selection
      if (!preferredVoice) {
        const genderToUse = modelConfig.gender || voice;
        if (genderToUse === 'male') {
          preferredVoice = voices.find(v =>
            v.name.includes('Male') ||
            v.name.includes('David') ||
            v.name.includes('Mark') ||
            (v.lang.startsWith('en') && !v.name.includes('Female'))
          ) || voices[0];
        } else if (genderToUse === 'female') {
          preferredVoice = voices.find(v =>
            v.name.includes('Female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Karen') ||
            v.name.includes('Victoria')
          ) || voices[0];
        } else {
          preferredVoice = voices.find(v => v.default) || voices[0];
        }
      }

      setSelectedVoice(preferredVoice);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Also listen for localStorage changes (settings updates)
    const handleStorageChange = () => loadVoices();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [voice]);

  const speak = (text: string, options?: { rate?: number; pitch?: number; volume?: number }) => {
    if (!enabled || !selectedVoice) return Promise.resolve();

    // Get speed/pitch from localStorage settings
    const savedSpeed = parseFloat(localStorage.getItem('pulse_ai_voice_speed') || '1.0');
    const savedPitch = parseFloat(localStorage.getItem('pulse_ai_voice_pitch') || '1.0');

    return new Promise<void>((resolve, reject) => {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice;
      utterance.rate = options?.rate || savedSpeed;
      utterance.pitch = options?.pitch || savedPitch;
      utterance.volume = options?.volume || 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        reject(event);
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const pause = () => {
    window.speechSynthesis.pause();
  };

  const resume = () => {
    window.speechSynthesis.resume();
  };

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    voiceName: selectedVoice?.name || 'Not available'
  };
};
