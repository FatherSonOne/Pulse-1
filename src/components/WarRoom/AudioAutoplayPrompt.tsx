import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Volume2 } from 'lucide-react';

interface AudioAutoplayPromptProps {
  visible: boolean;
  onTap: () => void;
}

export const AudioAutoplayPrompt: React.FC<AudioAutoplayPromptProps> = ({ visible, onTap }) => {
  // Native platforms handle autoplay natively
  if (!visible || Capacitor.isNativePlatform()) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onTap}
    >
      <button
        onClick={onTap}
        className="flex flex-col items-center gap-3 px-8 py-6 bg-gray-900/95 border border-rose-500/30 rounded-2xl shadow-2xl shadow-rose-500/20 transition-transform hover:scale-105"
      >
        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center">
          <Volume2 className="w-8 h-8 text-rose-400" />
        </div>
        <span className="text-white font-semibold text-lg">Tap to Enable Audio</span>
        <span className="text-gray-400 text-sm">Browser requires interaction to play audio</span>
      </button>
    </div>
  );
};
