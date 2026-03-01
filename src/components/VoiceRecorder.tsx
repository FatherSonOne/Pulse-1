import { useState, useRef, useEffect } from 'react';
import { useMultiModalIntelligence } from '../hooks/useMultiModalIntelligence';
import { VoiceMessage, TranscriptionResult, TaskFromVoice, DecisionFromVoice } from '../types';
import { AnimatedIcon } from './ui/AnimatedIcon';
import './VoiceRecorder.css';

/**
 * Voice Recorder Component
 * Record, transcribe, and extract insights from voice messages
 */

export default function VoiceRecorder() {
  const {
    voiceMessages,
    transcriptions,
    recordVoiceMessage,
    transcribeVoice,
    extractTasksFromVoice,
    extractDecisionsFromVoice,
    summarizeVoiceMessage,
    loading,
    error,
  } = useMultiModalIntelligence();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<VoiceMessage | null>(null);
  const [selectedTranscription, setSelectedTranscription] = useState<TranscriptionResult | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<TaskFromVoice[]>([]);
  const [extractedDecisions, setExtractedDecisions] = useState<DecisionFromVoice[]>([]);
  const [summary, setSummary] = useState<string>('');

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
      // Record for 10 seconds
      const voice = await recordVoiceMessage(10000);
      setIsRecording(false);
      setSelectedVoice(voice);
    } catch (err) {
      console.error('Recording failed:', err);
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleTranscribe = async (voiceId: string) => {
    try {
      const transcription = await transcribeVoice(voiceId, 'gemini');
      setSelectedTranscription(transcription);
    } catch (err) {
      console.error('Transcription failed:', err);
    }
  };

  const handleExtractTasks = async () => {
    if (!selectedTranscription) return;

    try {
      const tasks = await extractTasksFromVoice(selectedTranscription.id);
      setExtractedTasks(tasks);
    } catch (err) {
      console.error('Task extraction failed:', err);
    }
  };

  const handleExtractDecisions = async () => {
    if (!selectedTranscription) return;

    try {
      const decisions = await extractDecisionsFromVoice(selectedTranscription.id);
      setExtractedDecisions(decisions);
    } catch (err) {
      console.error('Decision extraction failed:', err);
    }
  };

  const handleSummarize = async () => {
    if (!selectedTranscription) return;

    try {
      const voiceSummary = await summarizeVoiceMessage(selectedTranscription.id);
      setSummary(voiceSummary.summary);
    } catch (err) {
      console.error('Summarization failed:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder">
      <div className="recorder-header">
        <h2><AnimatedIcon icon="microphone" size={22} /> Voice Intelligence</h2>
        <p className="subtitle">Record, transcribe, and extract actionable insights</p>
      </div>

      {/* Recording Controls */}
      <div className="recorder-controls">
        <div className="recording-area">
          <div className={`record-button ${isRecording ? 'recording' : ''}`}>
            {!isRecording ? (
              <button onClick={handleStartRecording} className="start-record-btn">
                <span className="mic-icon"><AnimatedIcon icon="microphone" size={24} /></span>
                <span>Start Recording</span>
              </button>
            ) : (
              <div className="recording-active">
                <div className="pulse-ring"></div>
                <div className="recording-time">{formatTime(recordingTime)}</div>
                <button onClick={handleStopRecording} className="stop-record-btn">
                  Stop
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
          <p>Processing...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p><AnimatedIcon icon="cross" size={14} /> {error}</p>
        </div>
      )}

      {/* Voice Messages List */}
      {voiceMessages.length > 0 && (
        <div className="voice-messages-section">
          <h3><AnimatedIcon icon="microphone" size={16} /> Recorded Messages</h3>
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
                  <span className="voice-icon"><AnimatedIcon icon="microphone" size={16} /></span>
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

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTranscribe(voice.id);
                  }}
                  className="transcribe-btn"
                  disabled={voice.status === 'processing'}
                >
                  {voice.status === 'completed' ? <><AnimatedIcon icon="reply" size={14} /> Re-transcribe</> : <><AnimatedIcon icon="note" size={14} /> Transcribe</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcription Panel */}
      {selectedTranscription && (
        <div className="transcription-panel">
          <h3><AnimatedIcon icon="note" size={16} /> Transcription</h3>

          <div className="transcription-content">
            <div className="transcription-meta">
              <span className="confidence">
                Confidence: {(selectedTranscription.confidence * 100).toFixed(0)}%
              </span>
              <span className="language">Language: {selectedTranscription.language}</span>
            </div>

            <div className="transcription-text">{selectedTranscription.transcript}</div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button onClick={handleExtractTasks} className="action-btn extract-tasks">
              <AnimatedIcon icon="clipboard" size={14} /> Extract Tasks
            </button>
            <button onClick={handleExtractDecisions} className="action-btn extract-decisions">
              <AnimatedIcon icon="check" size={14} /> Extract Decisions
            </button>
            <button onClick={handleSummarize} className="action-btn summarize">
              <AnimatedIcon icon="chart" size={14} /> Summarize
            </button>
          </div>

          {/* Extracted Tasks */}
          {extractedTasks.length > 0 && (
            <div className="extracted-section">
              <h4><AnimatedIcon icon="clipboard" size={15} /> Extracted Tasks</h4>
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
                    {task.assignee && (
                      <div className="task-assignee"><AnimatedIcon icon="people" size={12} /> {task.assignee}</div>
                    )}
                    {task.dueDate && (
                      <div className="task-due"><AnimatedIcon icon="calendar" size={12} /> {new Date(task.dueDate).toLocaleDateString()}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Decisions */}
          {extractedDecisions.length > 0 && (
            <div className="extracted-section">
              <h4><AnimatedIcon icon="check" size={15} /> Extracted Decisions</h4>
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

          {/* Summary */}
          {summary && (
            <div className="extracted-section">
              <h4><AnimatedIcon icon="chart" size={15} /> Summary</h4>
              <div className="summary-content">{summary}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
