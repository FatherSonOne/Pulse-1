// Live Vox Session Component
// Real-time conversation with AI as a third participant taking notes

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Contact } from '../../types';
import { 
  RealtimeTranscriptionService, 
  RealtimeTranscriptSegment,
  RealtimeTranscriptionState 
} from '../../services/voxer/realtimeTranscriptionService';
import { processWithModel } from '../../services/geminiService';

// ============================================
// TYPES
// ============================================

interface LiveVoxSessionProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Contact[];
  currentUserId: string;
  geminiApiKey?: string;
}

interface TranscriptEntry {
  id: string;
  speaker: string;
  speakerName: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface AINote {
  id: string;
  type: 'summary' | 'action_item' | 'question' | 'key_point' | 'decision' | 'follow_up';
  content: string;
  timestamp: Date;
  relatedTranscriptIds?: string[];
}

interface SessionStats {
  duration: number;
  totalWords: number;
  speakerBreakdown: Record<string, { words: number; time: number }>;
}

// ============================================
// LIVE VOX SESSION COMPONENT
// ============================================

export const LiveVoxSession: React.FC<LiveVoxSessionProps> = ({
  isOpen,
  onClose,
  participants,
  currentUserId,
  geminiApiKey,
}) => {
  // State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [aiNotes, setAiNotes] = useState<AINote[]>([]);
  const [transcriptionState, setTranscriptionState] = useState<RealtimeTranscriptionState>('idle');
  const [currentSpeaker, setCurrentSpeaker] = useState<string>(currentUserId);
  const [showNotes, setShowNotes] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    duration: 0,
    totalWords: 0,
    speakerBreakdown: {},
  });
  const [interimText, setInterimText] = useState('');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  // Refs
  const transcriptRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const transcriptionServiceRef = useRef<RealtimeTranscriptionService | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const aiProcessingRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef<string>('');
  const lastProcessedIndexRef = useRef<number>(0);

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  const startSession = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      setAudioStream(stream);

      // Initialize transcription service
      transcriptionServiceRef.current = new RealtimeTranscriptionService();

      await transcriptionServiceRef.current.start(
        stream,
        {
          onTranscript: handleTranscript,
          onError: (error) => console.error('Transcription error:', error),
          onStateChange: setTranscriptionState,
        },
        { enableSpeakerDiarization: true }
      );

      setIsSessionActive(true);
      setSessionStartTime(new Date());

      // Start duration timer
      timerRef.current = setInterval(() => {
        setSessionStats(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Start AI processing interval
      aiProcessingRef.current = setInterval(() => {
        processWithAI();
      }, 30000); // Process every 30 seconds

    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, []);

  const stopSession = useCallback(() => {
    // Stop transcription
    if (transcriptionServiceRef.current) {
      transcriptionServiceRef.current.stop();
      transcriptionServiceRef.current = null;
    }

    // Stop audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (aiProcessingRef.current) {
      clearInterval(aiProcessingRef.current);
      aiProcessingRef.current = null;
    }

    setIsSessionActive(false);

    // Final AI processing
    processWithAI(true);
  }, [audioStream]);

  // ============================================
  // TRANSCRIPT HANDLING
  // ============================================

  const handleTranscript = useCallback((segment: RealtimeTranscriptSegment) => {
    const speakerName = participants.find(p => p.id === currentSpeaker)?.name || 'You';

    if (segment.isFinal) {
      const entry: TranscriptEntry = {
        id: segment.id,
        speaker: currentSpeaker,
        speakerName,
        text: segment.text,
        timestamp: new Date(),
        isFinal: true,
      };

      setTranscript(prev => [...prev, entry]);
      fullTranscriptRef.current += `${speakerName}: ${segment.text}\n`;
      setInterimText('');

      // Update stats
      const wordCount = segment.text.split(/\s+/).length;
      setSessionStats(prev => ({
        ...prev,
        totalWords: prev.totalWords + wordCount,
        speakerBreakdown: {
          ...prev.speakerBreakdown,
          [speakerName]: {
            words: (prev.speakerBreakdown[speakerName]?.words || 0) + wordCount,
            time: prev.speakerBreakdown[speakerName]?.time || 0,
          },
        },
      }));
    } else {
      setInterimText(segment.text);
    }
  }, [currentSpeaker, participants]);

  // ============================================
  // AI PROCESSING
  // ============================================

  const processWithAI = useCallback(async (isFinal = false) => {
    if (!geminiApiKey || transcript.length === lastProcessedIndexRef.current) return;

    const newEntries = transcript.slice(lastProcessedIndexRef.current);
    if (newEntries.length === 0) return;

    lastProcessedIndexRef.current = transcript.length;
    setAiThinking(true);

    const transcriptText = newEntries.map(e => `${e.speakerName}: ${e.text}`).join('\n');

    const prompt = `You are an AI assistant in a live voice conversation. Analyze this conversation segment and extract useful notes.
${isFinal ? 'This is the final segment of the conversation.' : 'This is an ongoing conversation.'}

Conversation segment:
${transcriptText}

Return a JSON object with arrays for each type of note found:
{
  "key_points": ["array of key points discussed"],
  "action_items": ["array of action items or tasks mentioned"],
  "questions": ["array of questions that were asked"],
  "decisions": ["array of decisions that were made"],
  "follow_ups": ["array of things that need follow-up"]${isFinal ? ',\n  "summary": "A brief summary of the conversation"' : ''}
}

Only include arrays that have items. Return ONLY valid JSON.`;

    try {
      const result = await processWithModel(geminiApiKey, prompt);
      if (result) {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const newNotes: AINote[] = [];

          const typeMap: Record<string, AINote['type']> = {
            key_points: 'key_point',
            action_items: 'action_item',
            questions: 'question',
            decisions: 'decision',
            follow_ups: 'follow_up',
          };

          Object.entries(typeMap).forEach(([key, type]) => {
            const items = parsed[key];
            if (Array.isArray(items)) {
              items.forEach(item => {
                newNotes.push({
                  id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type,
                  content: item,
                  timestamp: new Date(),
                });
              });
            }
          });

          if (isFinal && parsed.summary) {
            newNotes.unshift({
              id: `note-${Date.now()}-summary`,
              type: 'summary',
              content: parsed.summary,
              timestamp: new Date(),
            });
          }

          if (newNotes.length > 0) {
            setAiNotes(prev => [...prev, ...newNotes]);
          }
        }
      }
    } catch (error) {
      console.error('AI processing error:', error);
    } finally {
      setAiThinking(false);
    }
  }, [geminiApiKey, transcript]);

  // ============================================
  // AI COMMANDS
  // ============================================

  const askAI = useCallback(async (command: 'summarize' | 'repeat' | 'advice' | 'clarify') => {
    if (!geminiApiKey) return;

    setAiThinking(true);
    const transcriptText = transcript.map(e => `${e.speakerName}: ${e.text}`).join('\n');

    const prompts: Record<string, string> = {
      summarize: `Summarize this conversation so far in 2-3 sentences:\n${transcriptText}`,
      repeat: `What were the last few key points mentioned in this conversation?\n${transcriptText}`,
      advice: `Based on this conversation, what advice or suggestions would you give to help move it forward?\n${transcriptText}`,
      clarify: `Are there any unclear points or potential misunderstandings in this conversation that should be clarified?\n${transcriptText}`,
    };

    try {
      const result = await processWithModel(geminiApiKey, prompts[command]);
      if (result) {
        const responseNote: AINote = {
          id: `note-${Date.now()}-${command}`,
          type: command === 'summarize' ? 'summary' : 'key_point',
          content: `[${command.toUpperCase()}] ${result}`,
          timestamp: new Date(),
        };
        setAiNotes(prev => [...prev, responseNote]);
      }
    } catch (error) {
      console.error('AI command error:', error);
    } finally {
      setAiThinking(false);
    }
  }, [geminiApiKey, transcript]);

  // ============================================
  // SCROLL TO BOTTOM
  // ============================================

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.scrollTop = notesRef.current.scrollHeight;
    }
  }, [aiNotes]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (aiProcessingRef.current) clearInterval(aiProcessingRef.current);
      if (audioStream) audioStream.getTracks().forEach(t => t.stop());
    };
  }, [audioStream]);

  // ============================================
  // HELPERS
  // ============================================

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getNoteIcon = (type: AINote['type']): string => {
    switch (type) {
      case 'summary': return 'fa-file-lines';
      case 'action_item': return 'fa-check-circle';
      case 'question': return 'fa-question-circle';
      case 'key_point': return 'fa-lightbulb';
      case 'decision': return 'fa-gavel';
      case 'follow_up': return 'fa-clock';
      default: return 'fa-sticky-note';
    }
  };

  const getNoteColor = (type: AINote['type']): string => {
    switch (type) {
      case 'summary': return 'text-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'action_item': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'question': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'key_point': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'decision': return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'follow_up': return 'text-pink-500 bg-pink-50 dark:bg-pink-900/20';
      default: return 'text-zinc-500 bg-zinc-50 dark:bg-zinc-800';
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-zinc-950 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-zinc-800 shadow-2xl animate-scaleIn">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-zinc-900 to-zinc-950">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-800'}`}>
              <i className="fa-solid fa-podcast text-xl text-white"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Live Vox Session
                {isSessionActive && (
                  <span className="text-xs px-2 py-1 bg-red-500 rounded-full animate-pulse">LIVE</span>
                )}
              </h2>
              <p className="text-sm text-zinc-400">
                {participants.map(p => p.name).join(', ')} • AI Note-Taker Active
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Session Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-white">{formatDuration(sessionStats.duration)}</div>
                <div className="text-xs text-zinc-500">Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-emerald-400">{sessionStats.totalWords}</div>
                <div className="text-xs text-zinc-500">Words</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-zinc-800 flex items-center justify-center transition text-zinc-400 hover:text-white"
            >
              <i className="fa-solid fa-times text-lg"></i>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Transcript Panel */}
          <div className="flex-1 flex flex-col border-r border-zinc-800">
            {/* Transcript Header */}
            <div className="px-4 py-3 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <i className="fa-solid fa-closed-captioning text-orange-500"></i>
                Live Transcript
              </h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  transcriptionState === 'transcribing' ? 'bg-emerald-500/20 text-emerald-400' :
                  transcriptionState === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                  transcriptionState === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {transcriptionState === 'transcribing' ? 'Listening...' :
                   transcriptionState === 'connecting' ? 'Connecting...' :
                   transcriptionState === 'error' ? 'Error' : 'Ready'}
                </span>
              </div>
            </div>

            {/* Transcript Content */}
            <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcript.length === 0 && !isSessionActive && (
                <div className="text-center py-12 text-zinc-500">
                  <i className="fa-solid fa-microphone-lines text-4xl mb-4 opacity-50"></i>
                  <p>Start the session to begin transcription</p>
                </div>
              )}
              
              {transcript.map((entry) => (
                <div key={entry.id} className="animate-slide-up">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full ${entry.speaker === currentUserId ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {entry.speakerName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-white text-sm">{entry.speakerName}</span>
                        <span className="text-[10px] text-zinc-500">{entry.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed mt-0.5">{entry.text}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Interim Text */}
              {interimText && (
                <div className="animate-pulse">
                  <div className="flex items-start gap-3 opacity-60">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {participants.find(p => p.id === currentSpeaker)?.name.charAt(0) || 'Y'}
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-white text-sm">
                        {participants.find(p => p.id === currentSpeaker)?.name || 'You'}
                      </span>
                      <p className="text-zinc-400 text-sm italic mt-0.5">{interimText}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Speaker Selector */}
            <div className="px-4 py-3 bg-zinc-900/50 border-t border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">Speaking as:</span>
                <div className="flex gap-2">
                  {participants.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setCurrentSpeaker(p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                        currentSpeaker === p.id 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Notes Panel */}
          <div className={`w-96 flex flex-col bg-zinc-900/30 transition-all ${showNotes ? '' : 'w-12'}`}>
            {showNotes ? (
              <>
                {/* Notes Header */}
                <div className="px-4 py-3 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <i className="fa-solid fa-robot text-purple-500"></i>
                    AI Notes
                    {aiThinking && (
                      <i className="fa-solid fa-circle-notch fa-spin text-purple-400 text-xs"></i>
                    )}
                  </h3>
                  <button 
                    onClick={() => setShowNotes(false)}
                    className="text-zinc-400 hover:text-white transition"
                  >
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>

                {/* AI Commands */}
                <div className="px-3 py-2 border-b border-zinc-800 flex flex-wrap gap-2">
                  <button
                    onClick={() => askAI('summarize')}
                    disabled={!isSessionActive || aiThinking}
                    className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-xs transition disabled:opacity-50"
                  >
                    <i className="fa-solid fa-compress mr-1"></i> Summarize
                  </button>
                  <button
                    onClick={() => askAI('repeat')}
                    disabled={!isSessionActive || aiThinking}
                    className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs transition disabled:opacity-50"
                  >
                    <i className="fa-solid fa-redo mr-1"></i> Repeat
                  </button>
                  <button
                    onClick={() => askAI('advice')}
                    disabled={!isSessionActive || aiThinking}
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs transition disabled:opacity-50"
                  >
                    <i className="fa-solid fa-lightbulb mr-1"></i> Advice
                  </button>
                  <button
                    onClick={() => askAI('clarify')}
                    disabled={!isSessionActive || aiThinking}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs transition disabled:opacity-50"
                  >
                    <i className="fa-solid fa-question mr-1"></i> Clarify
                  </button>
                </div>

                {/* Notes Content */}
                <div ref={notesRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                  {aiNotes.length === 0 && (
                    <div className="text-center py-8 text-zinc-500">
                      <i className="fa-solid fa-brain text-3xl mb-3 opacity-50"></i>
                      <p className="text-sm">AI notes will appear here as the conversation progresses</p>
                    </div>
                  )}
                  
                  {aiNotes.map((note) => (
                    <div 
                      key={note.id} 
                      className={`p-3 rounded-xl ${getNoteColor(note.type)} animate-slide-up`}
                    >
                      <div className="flex items-start gap-2">
                        <i className={`fa-solid ${getNoteIcon(note.type)} mt-0.5`}></i>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium uppercase opacity-70">{note.type.replace('_', ' ')}</span>
                          <p className="text-sm mt-1 leading-relaxed">{note.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowNotes(true)}
                className="h-full flex items-center justify-center text-zinc-400 hover:text-white transition"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950">
          <div className="flex items-center justify-center gap-4">
            {!isSessionActive ? (
              <button
                onClick={startSession}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold transition transform hover:scale-105 flex items-center gap-2"
              >
                <i className="fa-solid fa-play"></i>
                Start Session
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition transform hover:scale-105 flex items-center gap-2"
              >
                <i className="fa-solid fa-stop"></i>
                End Session
              </button>
            )}

            {isSessionActive && (
              <>
                <button className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition flex items-center justify-center">
                  <i className="fa-solid fa-microphone"></i>
                </button>
                <button className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition flex items-center justify-center">
                  <i className="fa-solid fa-video"></i>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveVoxSession;
