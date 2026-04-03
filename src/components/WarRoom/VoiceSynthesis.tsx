import { useState, useEffect } from 'react';

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
