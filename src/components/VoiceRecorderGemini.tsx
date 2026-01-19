import { useState, useRef, useEffect } from 'react';
import { AudioVoiceServiceGemini } from '../services/audioVoiceServiceGemini';
import { VoiceMessage, TranscriptionResult, TaskFromVoice, DecisionFromVoice, VoiceSummary } from '../types';
import './VoiceRecorder.css';

/**
 * Voice Recorder Component with Gemini Integration
 * Record, transcribe with Gemini, and extract insights from voice messages
 */

interface VoiceRecorderProps {
  apiKey: string;
}

export default function VoiceRecorderGemini({ apiKey }: VoiceRecorderProps) {
  const [voiceService] = useState(() => new AudioVoiceServiceGemini(apiKey));
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceMessage | null>(null);
  const [selectedTranscription, setSelectedTranscription] = useState<TranscriptionResult | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<TaskFromVoice[]>([]);
  const [extractedDecisions, setExtractedDecisions] = useState<DecisionFromVoice[]>([]);
  const [summary, setSummary] = useState<VoiceSummary | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      setError(null);
      // Record for 10 seconds
      const voice = await voiceService.recordVoiceMessage(10000);
      setIsRecording(false);
      setSelectedVoice(voice);
      setVoiceMessages((prev) => [...prev, voice]);
    } catch (err) {
      console.error('Recording failed:', err);
      setError(err instanceof Error ? err.message : 'Recording failed');
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleTranscribe = async (voiceId: string) => {
    try {
      setLoading(true);
      setError(null);

      const transcription = await voiceService.transcribeAudio(voiceId);
      setSelectedTranscription(transcription);
      setTranscriptions((prev) => [...prev, transcription]);

      // Index for search
      voiceService.indexVoiceTranscription(transcription.id);
    } catch (err) {
      console.error('Transcription failed:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeepAnalyze = async (voiceId: string) => {
    try {
      setLoading(true);
      setError(null);

      const result = await voiceService.deepAnalyzeVoice(voiceId);

      setSelectedTranscription(result.transcription);
      setTranscriptions((prev) => [...prev, result.transcription]);
      setSummary(result.summary);
      setExtractedTasks(result.tasks);
      setExtractedDecisions(result.decisions);

      // Index for search
      voiceService.indexVoiceTranscription(result.transcription.id);
    } catch (err) {
      console.error('Deep analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Deep analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!apiKey) {
    return (
      <div className="voice-recorder">
        <div className="error-state">
          <p>⚠️ Gemini API key not configured</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            Please set your API_KEY environment variable to use voice transcription.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-recorder">
      <div className="recorder-header">
        <h2>🎙️ Voice Intelligence (Gemini Powered)</h2>
        <p className="subtitle">Record, transcribe with Gemini, and extract actionable insights</p>
      </div>

      {/* Recording Controls */}
      <div className="recorder-controls">
        <div className="recording-area">
          <div className={`record-button ${isRecording ? 'recording' : ''}`}>
            {!isRecording ? (
              <button onClick={handleStartRecording} className="start-record-btn">
                <span className="mic-icon">🎤</span>
                <span>Start Recording</span>
              </button>
            ) : (
              <div className="recording-active">
                <div className="pulse-ring"></div>
                <div className="recording-time">{formatTime(recordingTime)}</div>
                <button onClick={handleStopRecording} className="stop-record-btn">
                  ⏹ Stop
                </button>
              </div>
            )}
          </div>

          {isRecording && (
            <div className="recording-indicator">
              <span className="red-dot"></span>
              Recording in progress...
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="voice-stats">
          <div className="stat-card-small">
            <div className="stat-value-small">{voiceMessages.length}</div>
            <div className="stat-label-small">Recordings</div>
          </div>
          <div className="stat-card-small">
            <div className="stat-value-small">{transcriptions.length}</div>
            <div className="stat-label-small">Transcriptions</div>
          </div>
        </div>
      </div>

      {/* Loading/Error */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Processing with Gemini...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Voice Messages List */}
      {voiceMessages.length > 0 && (
        <div className="voice-messages-section">
          <h3>📼 Recorded Messages</h3>
          <div className="voice-messages-list">
            {voiceMessages.map((voice) => (
              <div
                key={voice.id}
                className={`voice-message-card ${
                  selectedVoice?.id === voice.id ? 'selected' : ''
                }`}
                onClick={() => setSelectedVoice(voice)}
              >
                <div className="voice-header">
                  <span className="voice-icon">🎵</span>
                  <span className="voice-duration">
                    {formatTime(Math.floor(voice.duration / 1000))}
                  </span>
                  <span className={`voice-status status-${voice.status}`}>
                    {voice.status}
                  </span>
                </div>

                <div className="voice-date">
                  {new Date(voice.recordedAt).toLocaleString()}
                </div>

                {voice.audioUrl && (
                  <audio controls className="audio-player" src={voice.audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTranscribe(voice.id);
                    }}
                    className="transcribe-btn"
                    style={{ flex: 1 }}
                    disabled={voice.status === 'processing' || loading}
                  >
                    📝 Transcribe
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeepAnalyze(voice.id);
                    }}
                    className="transcribe-btn"
                    style={{ flex: 1, background: '#34A853' }}
                    disabled={voice.status === 'processing' || loading}
                  >
                    🧠 Deep Analyze
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcription Panel */}
      {selectedTranscription && (
        <div className="transcription-panel">
          <h3>📄 Transcription (Gemini)</h3>

          <div className="transcription-content">
            <div className="transcription-meta">
              <span className="confidence">
                Confidence: {(selectedTranscription.confidence * 100).toFixed(0)}%
              </span>
              <span className="language">Language: {selectedTranscription.language}</span>
            </div>

            <div className="transcription-text">{selectedTranscription.transcript}</div>
          </div>

          {/* Summary */}
          {summary && (
            <div className="extracted-section">
              <h4>📊 Summary</h4>
              <div className="summary-content">{summary.summary}</div>
              {summary.keyPoints.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <strong>Key Points:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {summary.keyPoints.map((point, i) => (
                      <li key={i} style={{ marginBottom: '5px' }}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Extracted Tasks */}
          {extractedTasks.length > 0 && (
            <div className="extracted-section">
              <h4>📋 Extracted Tasks ({extractedTasks.length})</h4>
              <div className="tasks-list">
                {extractedTasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div className="task-header">
                      <span className="task-title">{task.title}</span>
                      <span className={`task-priority priority-${task.priority}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="task-description">{task.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Decisions */}
          {extractedDecisions.length > 0 && (
            <div className="extracted-section">
              <h4>✅ Extracted Decisions ({extractedDecisions.length})</h4>
              <div className="decisions-list">
                {extractedDecisions.map((decision) => (
                  <div key={decision.id} className="decision-card">
                    <div className="decision-title">{decision.decision}</div>
                    <div className="decision-context">{decision.context}</div>
                    <div className="decision-meta">
                      <span>By: {decision.decidedBy}</span>
                      <span>{new Date(decision.decisionDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
