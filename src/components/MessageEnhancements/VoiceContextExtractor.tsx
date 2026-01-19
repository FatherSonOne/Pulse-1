// Voice Context Extractor - Enhanced Voice-to-Text with Context Extraction
import React, { useState, useRef, useEffect } from 'react';

interface ExtractedContext {
  transcription: string;
  summary: string;
  actionItems: string[];
  mentions: string[];
  dates: string[];
  decisions: string[];
  questions: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  confidence: number;
}

interface VoiceContextExtractorProps {
  onTranscriptionComplete: (context: ExtractedContext) => void;
  onError?: (error: string) => void;
  apiKey?: string;
  compact?: boolean;
}

// Mock extraction for demo (in production, this would call an AI service)
const extractContextFromTranscription = (text: string): Omit<ExtractedContext, 'transcription'> => {
  const lower = text.toLowerCase();

  // Extract action items
  const actionItems: string[] = [];
  const actionPatterns = [
    /need to ([^.!?]+)/gi,
    /should ([^.!?]+)/gi,
    /will ([^.!?]+)/gi,
    /have to ([^.!?]+)/gi,
    /please ([^.!?]+)/gi
  ];
  actionPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      actionItems.push(match[1].trim());
    }
  });

  // Extract mentions (@name or just capitalized names)
  const mentions: string[] = [];
  const mentionMatches = text.match(/@\w+/g);
  if (mentionMatches) {
    mentions.push(...mentionMatches.map(m => m.slice(1)));
  }

  // Extract dates
  const dates: string[] = [];
  const datePatterns = [
    /tomorrow/gi,
    /today/gi,
    /next week/gi,
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi,
    /\d{1,2}\/\d{1,2}/g,
    /january|february|march|april|may|june|july|august|september|october|november|december \d{1,2}/gi
  ];
  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  });

  // Extract decisions
  const decisions: string[] = [];
  const decisionPatterns = [
    /decided to ([^.!?]+)/gi,
    /we agreed ([^.!?]+)/gi,
    /the decision is ([^.!?]+)/gi,
    /we're going with ([^.!?]+)/gi
  ];
  decisionPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      decisions.push(match[1].trim());
    }
  });

  // Extract questions
  const questions = text.split(/[.!]/).filter(s => s.includes('?')).map(s => s.trim());

  // Determine sentiment
  let sentiment: ExtractedContext['sentiment'] = 'neutral';
  const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
  const positiveWords = ['great', 'excellent', 'thanks', 'good', 'perfect', 'happy'];
  const negativeWords = ['problem', 'issue', 'concern', 'worried', 'failed', 'wrong'];

  if (urgentWords.some(w => lower.includes(w))) {
    sentiment = 'urgent';
  } else if (positiveWords.filter(w => lower.includes(w)).length >= 2) {
    sentiment = 'positive';
  } else if (negativeWords.some(w => lower.includes(w))) {
    sentiment = 'negative';
  }

  // Generate summary
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  const summary = sentences.slice(0, 2).join('. ').trim() + (sentences.length > 2 ? '...' : '');

  return {
    summary: summary || text.slice(0, 100),
    actionItems: [...new Set(actionItems)].slice(0, 5),
    mentions: [...new Set(mentions)],
    dates: [...new Set(dates)],
    decisions: [...new Set(decisions)],
    questions: [...new Set(questions)].slice(0, 3),
    sentiment,
    confidence: 0.85
  };
};

export const VoiceContextExtractor: React.FC<VoiceContextExtractorProps> = ({
  onTranscriptionComplete,
  onError,
  compact = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [extractedContext, setExtractedContext] = useState<ExtractedContext | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);

  // Audio level visualization
  const updateAudioLevel = () => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
    }
    if (isRecording) {
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start audio level updates
      updateAudioLevel();
    } catch (error) {
      onError?.('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);

    try {
      // In production, this would send to a speech-to-text API
      // For demo, we'll simulate with a mock transcription
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockTranscription = "I need to follow up with Sarah about the project timeline. She mentioned we should have the design review done by Friday. Can you also remind me to schedule a call with the engineering team next week? I think the current approach is great and we're making good progress.";

      const context = extractContextFromTranscription(mockTranscription);
      const fullContext: ExtractedContext = {
        transcription: mockTranscription,
        ...context
      };

      setExtractedContext(fullContext);
      onTranscriptionComplete(fullContext);
    } catch (error) {
      onError?.('Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`p-2 rounded-lg transition-all ${
          isRecording
            ? 'bg-red-500 text-white animate-pulse'
            : isProcessing
            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
        }`}
        title={isRecording ? 'Stop recording' : 'Start voice message'}
      >
        <i className={`fa-solid ${isRecording ? 'fa-stop' : isProcessing ? 'fa-circle-notch fa-spin' : 'fa-microphone'} text-sm`} />
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
      {/* Recording controls */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : isProcessing
              ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <i className={`fa-solid ${isRecording ? 'fa-stop' : isProcessing ? 'fa-circle-notch fa-spin' : 'fa-microphone'} text-xl`} />
        </button>

        <div className="flex-1">
          {isRecording ? (
            <>
              <div className="text-sm font-bold text-red-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Recording...
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDuration(recordingDuration)}
              </div>
              {/* Audio level visualization */}
              <div className="mt-2 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </>
          ) : isProcessing ? (
            <>
              <div className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                Processing audio...
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Extracting context and action items
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                Voice Message with AI
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Record a message and AI will extract tasks, dates, and more
              </div>
            </>
          )}
        </div>
      </div>

      {/* Extracted context display */}
      {extractedContext && (
        <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          {/* Transcription */}
          <div>
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Transcription
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 italic">
              "{extractedContext.transcription}"
            </p>
          </div>

          {/* Sentiment badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              extractedContext.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
              extractedContext.sentiment === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
              extractedContext.sentiment === 'urgent' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
              'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
            }`}>
              <i className={`fa-solid ${
                extractedContext.sentiment === 'positive' ? 'fa-face-smile' :
                extractedContext.sentiment === 'negative' ? 'fa-face-frown' :
                extractedContext.sentiment === 'urgent' ? 'fa-bolt' :
                'fa-minus'
              } mr-1`} />
              {extractedContext.sentiment}
            </span>
            <span className="text-xs text-zinc-400">
              {Math.round(extractedContext.confidence * 100)}% confidence
            </span>
          </div>

          {/* Action items */}
          {extractedContext.actionItems.length > 0 && (
            <div>
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <i className="fa-solid fa-check-square text-emerald-500" />
                Action Items
              </div>
              <ul className="space-y-1">
                {extractedContext.actionItems.map((item, idx) => (
                  <li key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dates */}
          {extractedContext.dates.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                <i className="fa-solid fa-calendar text-blue-500 mr-1" />
                Dates:
              </span>
              {extractedContext.dates.map((date, idx) => (
                <span key={idx} className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {date}
                </span>
              ))}
            </div>
          )}

          {/* Mentions */}
          {extractedContext.mentions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                <i className="fa-solid fa-at text-purple-500 mr-1" />
                Mentions:
              </span>
              {extractedContext.mentions.map((mention, idx) => (
                <span key={idx} className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  @{mention}
                </span>
              ))}
            </div>
          )}

          {/* Questions */}
          {extractedContext.questions.length > 0 && (
            <div>
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <i className="fa-solid fa-question-circle text-amber-500" />
                Questions Asked
              </div>
              <ul className="space-y-1">
                {extractedContext.questions.map((q, idx) => (
                  <li key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 italic">
                    "{q.trim()}"
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceContextExtractor;
