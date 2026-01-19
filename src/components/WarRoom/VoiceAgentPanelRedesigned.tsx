import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RealtimeVoiceAgent, VoiceSettings, VoiceOption, TurnDetectionOption, NoiseReductionOption, LanguageOption } from './RealtimeVoiceAgent';
import { VoiceAgentVisualizerEnhanced } from './VoiceAgentVisualizerEnhanced';
import { RealtimeHistoryItem } from '../../services/realtimeAgentService';
import toast from 'react-hot-toast';

interface VoiceAgentPanelRedesignedProps {
  userId: string;
  projectId?: string;
  sessionId?: string;
  openaiApiKey?: string;
  onClose?: () => void;
  className?: string;
  /** Auto-connect to OpenAI Realtime when mounted */
  autoConnect?: boolean;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

export const VoiceAgentPanelRedesigned: React.FC<VoiceAgentPanelRedesignedProps> = ({
  userId,
  projectId,
  sessionId,
  openaiApiKey,
  onClose,
  className = '',
  autoConnect = true,
}) => {
  const [history, setHistory] = useState<RealtimeHistoryItem[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentRole, setCurrentRole] = useState<'user' | 'assistant'>('user');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Mic and audio controls
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string>('default');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('default');

  // Session recording
  const [isRecording, setIsRecording] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [recordedMessages, setRecordedMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);

  // Push-to-talk
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);

  // Transcript panel
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);

  // Voice Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'alloy',
    turnDetection: 'semantic_vad',
    noiseReduction: 'near_field',
    language: 'en',
  });

  const agentRef = useRef<any>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-connect on mount so user can start speaking immediately (no extra clicks)
  useEffect(() => {
    if (!autoConnect) return;
    if (!openaiApiKey) return;

    let cancelled = false;

    // Connect in a microtask so refs mount first
    Promise.resolve().then(async () => {
      if (cancelled) return;
      try {
        await agentRef.current?.connect?.();
      } catch (e) {
        // RealtimeVoiceAgent already toasts; keep this quiet
        console.warn('Auto-connect failed:', e);
      }
    });

    return () => {
      cancelled = true;
      // Best-effort disconnect to release mic immediately on close
      agentRef.current?.disconnect?.().catch?.(() => {});
    };
  }, [autoConnect, openaiApiKey]);

  // Load audio devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();

        const inputs = devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 5)}` }));

        const outputs = devices
          .filter(d => d.kind === 'audiooutput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 5)}` }));

        setInputDevices(inputs);
        setOutputDevices(outputs);
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    };

    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
  }, []);

  const handleTranscript = useCallback((text: string, role: 'user' | 'assistant', isFinal: boolean) => {
    setCurrentTranscript(text);
    setCurrentRole(role);
    setIsListening(role === 'user' && !isFinal);
    setIsSpeaking(role === 'assistant' && !isFinal);

    // Record if recording is active and transcript is final
    if (isRecording && isFinal && text.trim()) {
      setRecordedMessages(prev => [...prev, {
        role,
        content: text,
        timestamp: new Date()
      }]);
    }
  }, [isRecording]);

  const handleHistoryUpdate = useCallback((newHistory: RealtimeHistoryItem[]) => {
    setHistory(newHistory);
  }, []);

  // Start/Stop recording
  const toggleRecording = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      toast.success(`Recording stopped. ${recordedMessages.length} messages captured.`);
    } else {
      // Start recording
      setIsRecording(true);
      setSessionStartTime(new Date());
      setRecordedMessages([]);
      toast.success('Recording started');
    }
  };

  // Export transcript as text
  const exportTranscriptText = () => {
    if (recordedMessages.length === 0) {
      toast.error('No messages to export');
      return;
    }

    const header = `Pulse Chat Transcript\nSession: ${sessionStartTime?.toLocaleString() || 'Unknown'}\n${'='.repeat(50)}\n\n`;
    const content = recordedMessages.map(msg => {
      const time = msg.timestamp.toLocaleTimeString();
      const speaker = msg.role === 'user' ? 'You' : 'Pulse';
      return `[${time}] ${speaker}:\n${msg.content}\n`;
    }).join('\n');

    const blob = new Blob([header + content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported');
  };

  // Export transcript as JSON
  const exportTranscriptJSON = () => {
    if (recordedMessages.length === 0) {
      toast.error('No messages to export');
      return;
    }

    const data = {
      sessionId: sessionId || 'unknown',
      startTime: sessionStartTime?.toISOString(),
      endTime: new Date().toISOString(),
      messages: recordedMessages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Session exported');
  };

  // Determine if AI is thinking (processing but not speaking yet)
  const isThinking = history.length > 0 &&
    history[history.length - 1].role === 'user' &&
    !isSpeaking &&
    !isListening;

  const thinkingText = isThinking ? 'Processing your request...' : '';

  // Settings panel rendered via portal to avoid layout issues
  const settingsPanel = showSettings && createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={() => setShowSettings(false)}>
      <div
        className="absolute w-80 war-room-panel p-4 space-y-4"
        style={{
          top: settingsButtonRef.current
            ? settingsButtonRef.current.getBoundingClientRect().bottom + 8
            : 60,
          right: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <i className="fa fa-sliders war-room-text-primary"></i>
          Voice Settings
        </h3>

         {/* Voice Selection */}
         <div>
           <label className="text-xs war-room-text-secondary block mb-1.5">AI Voice</label>
           <select
             value={voiceSettings.voice}
             onChange={(e) => setVoiceSettings(prev => ({ ...prev, voice: e.target.value as VoiceOption }))}
             className="war-room-select w-full"
           >
             <option value="alloy">Alloy (Neutral)</option>
             <option value="ash">Ash (Neutral)</option>
             <option value="ballad">Ballad (Female)</option>
             <option value="coral">Coral (Female)</option>
             <option value="echo">Echo (Male)</option>
             <option value="sage">Sage (Neutral)</option>
             <option value="shimmer">Shimmer (Female)</option>
             <option value="verse">Verse (Neutral)</option>
             <option value="marin">Marin (Female)</option>
             <option value="cedar">Cedar (Male)</option>
           </select>
         </div>

        {/* Input Device Selection */}
        <div>
          <label className="text-xs war-room-text-secondary block mb-1.5">Microphone Input</label>
          <select
            value={selectedInputDevice}
            onChange={(e) => setSelectedInputDevice(e.target.value)}
            className="war-room-select w-full"
          >
            {inputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {/* Output Device Selection */}
        <div>
          <label className="text-xs war-room-text-secondary block mb-1.5">Audio Output</label>
          <select
            value={selectedOutputDevice}
            onChange={(e) => setSelectedOutputDevice(e.target.value)}
            className="war-room-select w-full"
          >
            {outputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {/* Turn Detection */}
        <div>
          <label className="text-xs war-room-text-secondary block mb-1.5">Turn Detection</label>
          <select
            value={voiceSettings.turnDetection}
            onChange={(e) => setVoiceSettings(prev => ({ ...prev, turnDetection: e.target.value as TurnDetectionOption }))}
            className="war-room-select w-full"
          >
            <option value="semantic_vad">Semantic VAD (Smart)</option>
            <option value="server_vad">Server VAD (Fast)</option>
          </select>
        </div>

        {/* Noise Reduction */}
        <div>
          <label className="text-xs war-room-text-secondary block mb-1.5">Noise Reduction</label>
          <select
            value={voiceSettings.noiseReduction}
            onChange={(e) => setVoiceSettings(prev => ({ ...prev, noiseReduction: e.target.value as NoiseReductionOption }))}
            className="war-room-select w-full"
          >
            <option value="near_field">Near Field (Close Mic)</option>
            <option value="far_field">Far Field (Room Mic)</option>
          </select>
        </div>

        {/* Language Preference */}
        <div>
          <label className="text-xs war-room-text-secondary block mb-1.5">
            <i className="fa fa-globe mr-1"></i>
            Preferred Language
          </label>
          <select
            value={voiceSettings.language}
            onChange={(e) => setVoiceSettings(prev => ({ ...prev, language: e.target.value as LanguageOption }))}
            className="war-room-select w-full"
          >
            <option value="en">English</option>
            <option value="es">Español (Spanish)</option>
            <option value="fr">Français (French)</option>
            <option value="de">Deutsch (German)</option>
            <option value="it">Italiano (Italian)</option>
            <option value="pt">Português (Portuguese)</option>
            <option value="nl">Nederlands (Dutch)</option>
            <option value="pl">Polski (Polish)</option>
            <option value="ru">Русский (Russian)</option>
            <option value="ja">日本語 (Japanese)</option>
            <option value="ko">한국어 (Korean)</option>
            <option value="zh">中文 (Chinese)</option>
          </select>
          <p className="text-[10px] war-room-text-muted mt-1">
            AI will always respond in this language
          </p>
        </div>

        <p className="text-xs war-room-text-secondary pt-2 war-room-divider">
          Changes apply on next connection
        </p>
      </div>
    </div>,
    document.body
  );

  return (
    <div className={`h-full w-full flex flex-col war-room-container overflow-hidden ${className}`}>
      {/* Top Control Bar */}
      <div className="shrink-0 flex items-center justify-between p-3 war-room-header">
        {/* Left: Recording controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`war-room-btn flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${
              isRecording ? 'war-room-btn-primary war-room-pulse' : ''
            }`}
          >
            <i className={`fa ${isRecording ? 'fa-stop' : 'fa-circle'}`}></i>
            {isRecording ? 'Recording...' : 'Record'}
          </button>

          {recordedMessages.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={exportTranscriptText}
                className="war-room-btn px-2 py-1.5 text-xs"
                title="Export as Text"
              >
                <i className="fa fa-file-text mr-1"></i>
                TXT
              </button>
              <button
                onClick={exportTranscriptJSON}
                className="war-room-btn px-2 py-1.5 text-xs"
                title="Export as JSON"
              >
                <i className="fa fa-code mr-1"></i>
                JSON
              </button>
            </div>
          )}
        </div>

        {/* Right: Settings button */}
        <button
          ref={settingsButtonRef}
          onClick={() => setShowSettings(prev => !prev)}
          className={`war-room-btn war-room-btn-icon ${showSettings ? 'war-room-btn-primary' : ''}`}
          title="Voice Settings"
        >
          <i className="fa fa-cog"></i>
        </button>
      </div>

      {/* Settings Panel via Portal */}
      {settingsPanel}

      {/* Visualizer Area - enhanced with audio-responsive pulsating rings */}
      <div className="flex-1 relative overflow-hidden">
        <VoiceAgentVisualizerEnhanced
          isListening={isListening && isMicEnabled}
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          audioLevel={isMicEnabled ? audioLevel : 0}
          thinkingText={thinkingText}
          transcriptText={currentTranscript}
        />

        {/* Realtime Voice Agent (hidden but functional) */}
        <div className="absolute inset-0 opacity-0 pointer-events-none">
          <RealtimeVoiceAgent
            ref={agentRef}
            userId={userId}
            projectId={projectId}
            sessionId={sessionId}
            openaiApiKey={openaiApiKey}
            voiceSettings={voiceSettings}
            onTranscript={handleTranscript}
            onHistoryUpdate={handleHistoryUpdate}
            className="h-full"
          />
        </div>
      </div>

      {/* Conversation History */}
      {(history.length > 0 || currentTranscript) && (
        <div className="shrink-0 max-h-40 overflow-y-auto war-room-input-area p-3 war-room-scrollbar">
          <div className="space-y-2">
            {history.slice(-5).map((item, idx) => {
              if (item.type !== 'message') return null;

              return (
                <div
                  key={idx}
                  className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 ${
                      item.role === 'user'
                        ? 'war-room-message-user'
                        : 'war-room-message-ai'
                    }`}
                  >
                    <p className="text-sm">{item.content || item.transcript}</p>
                  </div>
                </div>
              );
            })}

            {/* Current interim transcript */}
            {currentTranscript && (
              <div className={`flex ${currentRole === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 opacity-60 ${
                    currentRole === 'user'
                      ? 'war-room-message-user'
                      : 'war-room-message-ai'
                  }`}
                >
                  <p className="text-sm italic">{currentTranscript}...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Control Bar - Mic/Audio Controls */}
      <div className="shrink-0 p-4 war-room-input-area">
        <div className="flex items-center justify-center gap-3">
          {/* Mic Mute Toggle */}
          <button
            onClick={() => setIsMicEnabled(prev => !prev)}
            className={`war-room-btn war-room-btn-icon ${!isMicEnabled ? 'text-red-500' : ''}`}
            title={isMicEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            <i className={`fa ${isMicEnabled ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
          </button>

          {/* Push-to-Talk Button - Large Central Button */}
          <button
            onMouseDown={() => {
              if (isMicEnabled) setIsPushToTalkActive(true);
            }}
            onMouseUp={() => setIsPushToTalkActive(false)}
            onMouseLeave={() => setIsPushToTalkActive(false)}
            onTouchStart={() => {
              if (isMicEnabled) setIsPushToTalkActive(true);
            }}
            onTouchEnd={() => setIsPushToTalkActive(false)}
            disabled={!isMicEnabled}
            className={`relative w-16 h-16 flex items-center justify-center transition-all ${
              isPushToTalkActive
                ? 'war-room-btn war-room-btn-primary war-room-glow scale-110'
                : isMicEnabled
                ? 'war-room-btn war-room-btn-primary'
                : 'war-room-btn opacity-50 cursor-not-allowed'
            }`}
            style={{ borderRadius: '50%' }}
            title="Hold to speak"
          >
            <i className={`fa fa-${isPushToTalkActive ? 'circle' : 'microphone'} text-xl`}></i>
            {isPushToTalkActive && (
              <span className="absolute inset-0 rounded-full border-4 border-rose-300 animate-ping"></span>
            )}
          </button>

          {/* Transcript Panel Toggle */}
          <button
            onClick={() => setShowTranscriptPanel(prev => !prev)}
            className={`war-room-btn war-room-btn-icon ${showTranscriptPanel ? 'war-room-btn-primary' : ''}`}
            title="View Transcript"
          >
            <i className="fa fa-file-text"></i>
          </button>

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 war-room-badge war-room-badge-primary flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Recording
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="text-center mt-2">
          {isPushToTalkActive && isMicEnabled && (
            <span className="text-sm war-room-text-primary font-medium animate-pulse">
              Release to send...
            </span>
          )}
          {isListening && !isPushToTalkActive && isMicEnabled && (
            <span className="text-sm war-room-text-primary font-medium animate-pulse">
              Listening...
            </span>
          )}
          {isSpeaking && (
            <span className="text-sm text-green-500 font-medium animate-pulse">
              Speaking...
            </span>
          )}
          {isThinking && (
            <span className="text-sm text-purple-500 font-medium animate-pulse">
              Thinking...
            </span>
          )}
          {!isListening && !isSpeaking && !isThinking && !isPushToTalkActive && (
            <span className="text-xs war-room-text-secondary">
              {isMicEnabled ? 'Hold button to speak' : 'Microphone muted'}
            </span>
          )}
        </div>
      </div>

      {/* Slide-out Transcript Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-80 war-room-panel transition-transform duration-300 z-30 flex flex-col ${
          showTranscriptPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ borderRadius: '0 0 0 16px' }}
      >
        {/* Panel Header */}
        <div className="shrink-0 flex items-center justify-between p-4 war-room-divider">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <i className="fa fa-comments war-room-text-primary"></i>
            Conversation Transcript
          </h3>
          <button
            onClick={() => setShowTranscriptPanel(false)}
            className="war-room-btn war-room-btn-icon-sm"
          >
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Transcript Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 war-room-scrollbar">
          {history.length === 0 && recordedMessages.length === 0 ? (
            <p className="text-sm war-room-text-secondary text-center py-8">
              No conversation yet.<br />Start talking to see the transcript here.
            </p>
          ) : (
            <>
              {/* Show recorded messages if recording, otherwise history */}
              {(recordedMessages.length > 0 ? recordedMessages : history.filter(h => h.type === 'message')).map((item, idx) => {
                const isUser = 'role' in item ? item.role === 'user' : false;
                const content = 'content' in item ? item.content : ('transcript' in item ? item.transcript : '');
                const timestamp = 'timestamp' in item ? item.timestamp : null;

                return (
                  <div key={idx} className="group relative">
                    <div className={`text-xs war-room-text-secondary mb-1 flex items-center justify-between`}>
                      <span>{isUser ? 'You' : 'Pulse'}</span>
                      {timestamp && (
                        <span className="war-room-text-muted">
                          {new Date(timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <div className={`p-3 rounded-xl ${
                      isUser
                        ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40'
                        : 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
                    }`}>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {content}
                      </p>
                    </div>
                    {/* Copy button on hover */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(content || '');
                        toast.success('Copied to clipboard');
                      }}
                      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600"
                      title="Copy"
                    >
                      <i className="fa fa-copy text-xs"></i>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Panel Footer - Export Options */}
        <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <button
            onClick={() => {
              const content = (recordedMessages.length > 0 ? recordedMessages : history.filter(h => h.type === 'message'))
                .map(item => {
                  const isUser = 'role' in item ? item.role === 'user' : false;
                  const text = 'content' in item ? item.content : ('transcript' in item ? item.transcript : '');
                  return `${isUser ? 'You' : 'Pulse'}: ${text}`;
                }).join('\n\n');
              navigator.clipboard.writeText(content);
              toast.success('Full transcript copied!');
            }}
            className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <i className="fa fa-copy"></i>
            Copy All
          </button>
          <div className="flex gap-2">
            <button
              onClick={exportTranscriptText}
              className="flex-1 py-2 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <i className="fa fa-file-text"></i>
              Export TXT
            </button>
            <button
              onClick={exportTranscriptJSON}
              className="flex-1 py-2 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <i className="fa fa-code"></i>
              Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
