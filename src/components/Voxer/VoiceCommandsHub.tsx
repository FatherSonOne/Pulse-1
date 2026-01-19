// Voice Commands Hub Component
// Voice control system for hands-free operation

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  VoiceCommand, 
  VoiceCommandResult, 
  VoiceCommandHistory,
  VoiceCommandCategory,
  WakeWordConfig,
  VOICE_COMMANDS,
  DEFAULT_WAKE_WORD_CONFIG 
} from '../../services/voxer/advancedVoxerTypes';

// ============================================
// TYPES
// ============================================

interface VoiceCommandsHubProps {
  isEnabled: boolean;
  onToggle: () => void;
  wakeWordConfig: WakeWordConfig;
  onUpdateConfig: (config: Partial<WakeWordConfig>) => void;
  onExecuteCommand: (command: VoiceCommand, params: Record<string, any>) => void;
  contactNames: string[];
}

interface CommandListProps {
  commands: VoiceCommand[];
  category?: VoiceCommandCategory;
  onSelectCommand: (command: VoiceCommand) => void;
}

interface VoiceListeningOverlayProps {
  isListening: boolean;
  transcript: string;
  matchedCommand?: VoiceCommand;
  onCancel: () => void;
}

// ============================================
// CATEGORY CONFIG
// ============================================

const CATEGORY_CONFIG: Record<VoiceCommandCategory, { icon: string; color: string; label: string }> = {
  navigation: { icon: 'fa-compass', color: 'text-blue-500', label: 'Navigation' },
  playback: { icon: 'fa-play', color: 'text-emerald-500', label: 'Playback' },
  recording: { icon: 'fa-microphone', color: 'text-red-500', label: 'Recording' },
  messaging: { icon: 'fa-paper-plane', color: 'text-purple-500', label: 'Messaging' },
  search: { icon: 'fa-search', color: 'text-amber-500', label: 'Search' },
  settings: { icon: 'fa-gear', color: 'text-zinc-500', label: 'Settings' },
  ai: { icon: 'fa-robot', color: 'text-pink-500', label: 'AI' },
};

// ============================================
// VOICE LISTENING OVERLAY
// ============================================

const VoiceListeningOverlay: React.FC<VoiceListeningOverlayProps> = ({
  isListening,
  transcript,
  matchedCommand,
  onCancel,
}) => {
  if (!isListening) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[100] animate-fadeIn">
      <div className="text-center max-w-md mx-4">
        {/* Animated Orb */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 animate-ping opacity-75" />
          <div className="absolute inset-4 rounded-full bg-black flex items-center justify-center">
            <i className="fa-solid fa-microphone text-4xl text-white animate-pulse"></i>
          </div>
        </div>

        {/* Status Text */}
        <div className="text-white mb-4">
          <p className="text-xl font-light mb-2">
            {matchedCommand ? 'Command recognized!' : 'Listening...'}
          </p>
          {transcript && (
            <p className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
              "{transcript}"
            </p>
          )}
        </div>

        {/* Matched Command */}
        {matchedCommand && (
          <div className="bg-white/10 rounded-2xl p-4 mb-6 animate-scaleIn">
            <div className="flex items-center justify-center gap-3 text-white">
              <i className={`fa-solid ${CATEGORY_CONFIG[matchedCommand.category].icon} ${CATEGORY_CONFIG[matchedCommand.category].color}`}></i>
              <span className="font-medium">{matchedCommand.description}</span>
            </div>
          </div>
        )}

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium transition"
        >
          Cancel
        </button>

        {/* Hint */}
        <p className="text-white/50 text-sm mt-6">
          Say a command like "Play my unread voxes" or "Send vox to Sarah"
        </p>
      </div>
    </div>
  );
};

// ============================================
// COMMAND LIST COMPONENT
// ============================================

const CommandList: React.FC<CommandListProps> = ({
  commands,
  category,
  onSelectCommand,
}) => {
  const filteredCommands = category 
    ? commands.filter(c => c.category === category)
    : commands;

  return (
    <div className="space-y-2">
      {filteredCommands.map(command => {
        const catConfig = CATEGORY_CONFIG[command.category];
        return (
          <button
            key={command.id}
            onClick={() => onSelectCommand(command)}
            className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left group"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 shadow-sm ${catConfig.color}`}>
                <i className={`fa-solid ${catConfig.icon} text-sm`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm dark:text-white mb-1">
                  {command.description}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {command.phrases.slice(0, 2).map((phrase, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded-full text-zinc-600 dark:text-zinc-400"
                    >
                      "{phrase}"
                    </span>
                  ))}
                  {command.phrases.length > 2 && (
                    <span className="text-[10px] text-zinc-400">
                      +{command.phrases.length - 2} more
                    </span>
                  )}
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400 dark:group-hover:text-zinc-500 transition"></i>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ============================================
// MAIN VOICE COMMANDS HUB
// ============================================

export const VoiceCommandsHub: React.FC<VoiceCommandsHubProps> = ({
  isEnabled,
  onToggle,
  wakeWordConfig,
  onUpdateConfig,
  onExecuteCommand,
  contactNames,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matchedCommand, setMatchedCommand] = useState<VoiceCommand | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VoiceCommandCategory | null>(null);
  const [commandHistory, setCommandHistory] = useState<VoiceCommandHistory[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        const transcriptText = result[0].transcript;
        setTranscript(transcriptText);

        if (result.isFinal) {
          processCommand(transcriptText);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Process voice command
  const processCommand = useCallback((text: string) => {
    const normalizedText = text.toLowerCase().trim();
    
    // Try to match a command
    for (const command of VOICE_COMMANDS) {
      for (const phrase of command.phrases) {
        if (normalizedText.includes(phrase.toLowerCase())) {
          setMatchedCommand(command);
          
          // Extract parameters if any
          const params: Record<string, any> = {};
          
          if (command.parameters) {
            for (const param of command.parameters) {
              if (param.type === 'contact') {
                // Try to find contact name in text
                for (const name of contactNames) {
                  if (normalizedText.includes(name.toLowerCase())) {
                    params[param.name] = name;
                    break;
                  }
                }
              } else if (param.type === 'text') {
                // Extract text after the command phrase
                const phraseIndex = normalizedText.indexOf(phrase.toLowerCase());
                if (phraseIndex >= 0) {
                  params[param.name] = normalizedText.substring(phraseIndex + phrase.length).trim();
                }
              }
            }
          }

          // Execute after short delay for visual feedback
          setTimeout(() => {
            onExecuteCommand(command, params);
            
            // Add to history
            setCommandHistory(prev => [{
              id: `history-${Date.now()}`,
              transcript: text,
              command,
              result: { success: true, response: 'Command executed' },
              timestamp: new Date(),
            }, ...prev.slice(0, 9)]);

            setIsListening(false);
            setTranscript('');
            setMatchedCommand(null);
          }, 1000);

          return;
        }
      }
    }

    // No match found
    setTimeout(() => {
      setIsListening(false);
      setMatchedCommand(null);
    }, 2000);
  }, [contactNames, onExecuteCommand]);

  // Start listening
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setMatchedCommand(null);
      setIsListening(true);
      recognitionRef.current.start();

      // Auto-stop after timeout
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, wakeWordConfig.listenTimeout * 1000);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsListening(false);
    setTranscript('');
    setMatchedCommand(null);
  };

  const categories = Object.keys(CATEGORY_CONFIG) as VoiceCommandCategory[];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
      {/* Listening Overlay */}
      <VoiceListeningOverlay
        isListening={isListening}
        transcript={transcript}
        matchedCommand={matchedCommand || undefined}
        onCancel={stopListening}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-microphone-lines text-orange-500"></i>
            Voice Commands
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                showSettings 
                  ? 'bg-orange-500 text-white' 
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              <i className="fa-solid fa-gear"></i>
            </button>
            <button
              onClick={onToggle}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                isEnabled
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {isEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Big Listen Button */}
        <button
          onClick={startListening}
          disabled={!isEnabled || isListening}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:from-zinc-300 disabled:to-zinc-400 text-white rounded-2xl font-bold text-lg transition transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <i className="fa-solid fa-microphone text-xl"></i>
          {isListening ? 'Listening...' : `Say "${wakeWordConfig.wakeWord}"`}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showSettings ? (
          // Settings Panel
          <div className="p-4 space-y-4">
            <h4 className="font-semibold dark:text-white">Voice Settings</h4>
            
            {/* Wake Word */}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Wake Word</label>
              <input
                type="text"
                value={wakeWordConfig.wakeWord}
                onChange={(e) => onUpdateConfig({ wakeWord: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
            </div>

            {/* Sensitivity */}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">
                Sensitivity: {wakeWordConfig.sensitivity}
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => onUpdateConfig({ sensitivity: level })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition capitalize ${
                      wakeWordConfig.sensitivity === level
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Listen Timeout */}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">
                Listen Timeout: {wakeWordConfig.listenTimeout}s
              </label>
              <input
                type="range"
                min={5}
                max={30}
                value={wakeWordConfig.listenTimeout}
                onChange={(e) => onUpdateConfig({ listenTimeout: parseInt(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </div>

            {/* Confirmation Sound */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm dark:text-white">Confirmation Sound</div>
                <div className="text-xs text-zinc-500">Play sound when command recognized</div>
              </div>
              <button
                onClick={() => onUpdateConfig({ confirmationSound: !wakeWordConfig.confirmationSound })}
                className={`w-12 h-6 rounded-full transition ${wakeWordConfig.confirmationSound ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${wakeWordConfig.confirmationSound ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        ) : (
          // Commands List
          <div className="p-4">
            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === null
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                    selectedCategory === cat
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <i className={`fa-solid ${CATEGORY_CONFIG[cat].icon}`}></i>
                  {CATEGORY_CONFIG[cat].label}
                </button>
              ))}
            </div>

            {/* Commands */}
            <CommandList
              commands={VOICE_COMMANDS}
              category={selectedCategory || undefined}
              onSelectCommand={(cmd) => {
                // Show command details or execute
                startListening();
              }}
            />

            {/* Recent History */}
            {commandHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Recent Commands</h4>
                <div className="space-y-2">
                  {commandHistory.slice(0, 5).map(history => (
                    <div
                      key={history.id}
                      className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                    >
                      <i className={`fa-solid ${history.result.success ? 'fa-check-circle text-emerald-500' : 'fa-times-circle text-red-500'}`}></i>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm dark:text-white truncate">"{history.transcript}"</p>
                        <p className="text-xs text-zinc-500">
                          {history.command?.description || 'Unknown command'}
                        </p>
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(history.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// FLOATING VOICE BUTTON (for global access)
// ============================================

interface FloatingVoiceButtonProps {
  onPress: () => void;
  isEnabled: boolean;
  isListening: boolean;
}

export const FloatingVoiceButton: React.FC<FloatingVoiceButtonProps> = ({
  onPress,
  isEnabled,
  isListening,
}) => {
  if (!isEnabled) return null;

  return (
    <button
      onClick={onPress}
      className={`fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-50 transition transform hover:scale-110 ${
        isListening
          ? 'bg-red-500 animate-pulse'
          : 'bg-gradient-to-br from-orange-500 to-pink-500'
      }`}
    >
      <i className={`fa-solid fa-microphone text-xl text-white ${isListening ? 'animate-bounce' : ''}`}></i>
    </button>
  );
};

export default VoiceCommandsHub;
