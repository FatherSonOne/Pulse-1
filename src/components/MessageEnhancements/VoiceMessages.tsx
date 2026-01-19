import React, { useState, useRef, useCallback, useEffect } from 'react';

// Types
interface VoiceMessage {
  id: string;
  audioUrl: string;
  duration: number;
  timestamp: Date;
  sender: string;
  isMe: boolean;
  transcription?: string;
  isTranscribing?: boolean;
  waveformData?: number[];
}

interface VoiceMessagesProps {
  onSendVoice?: (audioBlob: Blob, duration: number) => void;
  onTranscribe?: (messageId: string) => Promise<string>;
}

interface VoicePlayerProps {
  message: VoiceMessage;
  onTranscribe?: () => void;
}

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  recorder: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  recorderHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px'
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  recordButton: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    fontSize: '24px'
  },
  recordButtonIdle: {
    backgroundColor: '#EF4444',
    color: 'white',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
  },
  recordButtonRecording: {
    backgroundColor: '#DC2626',
    color: 'white',
    animation: 'pulse 1.5s infinite',
    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.5)'
  },
  recordingInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '20px 0'
  },
  timer: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#f1f5f9',
    fontFamily: 'monospace'
  },
  waveform: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    height: '48px'
  },
  waveformBar: {
    width: '4px',
    borderRadius: '2px',
    backgroundColor: '#EF4444',
    transition: 'height 0.1s ease'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '16px'
  },
  controlButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease'
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#94a3b8'
  },
  sendButton: {
    backgroundColor: '#10B981',
    color: 'white'
  },
  player: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '12px 16px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  playerMe: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.2)'
  },
  playButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#8B5CF6',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    flexShrink: 0
  },
  playerWaveform: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    height: '32px',
    cursor: 'pointer'
  },
  playerBar: {
    width: '3px',
    borderRadius: '1.5px',
    transition: 'all 0.1s ease'
  },
  playerInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '4px',
    flexShrink: 0
  },
  duration: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  transcribeButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  transcription: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.5,
    fontStyle: 'italic'
  },
  transcribing: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#64748b',
    fontSize: '12px'
  },
  speedControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  speedButton: {
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 600
  },
  speedButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    color: '#a78bfa'
  }
};

// Generate mock waveform data
const generateWaveform = (count: number = 40): number[] => {
  return Array.from({ length: count }, () => Math.random() * 0.8 + 0.2);
};

// Format time as mm:ss
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Voice Player Component
export const VoicePlayer: React.FC<VoicePlayerProps> = ({ message, onTranscribe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformData = message.waveformData || generateWaveform();

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((index: number) => {
    if (audioRef.current) {
      const seekTime = (index / waveformData.length) * message.duration;
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  }, [message.duration, waveformData.length]);

  const changeSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const progress = message.duration > 0 ? currentTime / message.duration : 0;

  return (
    <div>
      <audio
        ref={audioRef}
        src={message.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <div style={{ ...styles.player, ...(message.isMe ? styles.playerMe : {}) }}>
        <button
          style={styles.playButton}
          onClick={togglePlay}
        >
          <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
        </button>

        <div style={styles.playerWaveform}>
          {waveformData.map((height, i) => {
            const isPlayed = i / waveformData.length <= progress;
            return (
              <div
                key={i}
                style={{
                  ...styles.playerBar,
                  height: `${height * 100}%`,
                  backgroundColor: isPlayed ? '#8B5CF6' : 'rgba(255, 255, 255, 0.2)'
                }}
                onClick={() => handleSeek(i)}
              />
            );
          })}
        </div>

        <div style={styles.playerInfo}>
          <span style={styles.duration}>
            {formatTime(isPlaying ? currentTime : message.duration)}
          </span>
          <div style={styles.speedControl}>
            {[1, 1.5, 2].map(speed => (
              <button
                key={speed}
                style={{
                  ...styles.speedButton,
                  ...(playbackSpeed === speed ? styles.speedButtonActive : {})
                }}
                onClick={() => changeSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {message.transcription && (
        <div style={styles.transcription}>
          "{message.transcription}"
        </div>
      )}

      {message.isTranscribing && (
        <div style={{ ...styles.transcription, ...styles.transcribing }}>
          <i className="fa-solid fa-circle-notch fa-spin" />
          Transcribing audio...
        </div>
      )}

      {!message.transcription && !message.isTranscribing && onTranscribe && (
        <button
          style={{ ...styles.transcribeButton, marginTop: '8px' }}
          onClick={onTranscribe}
        >
          <i className="fa-solid fa-closed-captioning" />
          Transcribe
        </button>
      )}
    </div>
  );
};

// Voice Recorder Component
export const VoiceRecorder: React.FC<VoiceMessagesProps> = ({ onSendVoice }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveformValues, setWaveformValues] = useState<number[]>(Array(20).fill(0.3));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Set up audio analysis for waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start waveform animation
      const updateWaveform = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const values = Array.from(dataArray.slice(0, 20)).map(v => v / 255 * 0.8 + 0.2);
          setWaveformValues(values);
        }
        animationRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setWaveformValues(Array(20).fill(0.3));
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  }, [stopRecording]);

  const sendRecording = useCallback(() => {
    if (audioBlob && onSendVoice) {
      onSendVoice(audioBlob, duration);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
    }
  }, [audioBlob, duration, onSendVoice]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div style={styles.recorder}>
      <div style={styles.recorderHeader}>
        <div style={styles.title}>
          <i className="fa-solid fa-microphone" />
          Voice Message
        </div>
        {!isRecording && !audioUrl && (
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Tap to record
          </span>
        )}
      </div>

      <div style={styles.recordingInfo}>
        {!audioUrl ? (
          <>
            <button
              style={{
                ...styles.recordButton,
                ...(isRecording ? styles.recordButtonRecording : styles.recordButtonIdle)
              }}
              onClick={isRecording ? stopRecording : startRecording}
            >
              <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`} />
            </button>

            {isRecording && (
              <>
                <div style={styles.timer}>{formatTime(duration)}</div>
                <div style={styles.waveform}>
                  {waveformValues.map((height, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.waveformBar,
                        height: `${height * 48}px`
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {!isRecording && (
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Hold or tap to start recording
              </span>
            )}
          </>
        ) : (
          <>
            <VoicePlayer
              message={{
                id: 'preview',
                audioUrl: audioUrl,
                duration: duration,
                timestamp: new Date(),
                sender: 'You',
                isMe: true,
                waveformData: generateWaveform()
              }}
            />
            <div style={styles.controls}>
              <button
                style={{ ...styles.controlButton, ...styles.cancelButton }}
                onClick={cancelRecording}
              >
                <i className="fa-solid fa-trash" />
                Discard
              </button>
              <button
                style={{ ...styles.controlButton, ...styles.sendButton }}
                onClick={sendRecording}
              >
                <i className="fa-solid fa-paper-plane" />
                Send Voice
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Compact voice message button for message input
export const VoiceMessageButton: React.FC<{
  onRecordComplete?: (audioBlob: Blob, duration: number) => void;
}> = ({ onRecordComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          if (onRecordComplete) {
            onRecordComplete(blob, duration);
          }
          stream.getTracks().forEach(track => track.stop());
          setDuration(0);
        };

        mediaRecorder.start();
        setIsRecording(true);
        setDuration(0);

        timerRef.current = window.setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  }, [isRecording, duration, onRecordComplete]);

  return (
    <button
      onClick={toggleRecording}
      style={{
        padding: '8px 12px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: isRecording ? '#EF4444' : 'rgba(255, 255, 255, 0.1)',
        color: isRecording ? 'white' : '#94a3b8',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        fontWeight: 500,
        transition: 'all 0.2s ease'
      }}
    >
      <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`} />
      {isRecording ? formatTime(duration) : 'Voice'}
    </button>
  );
};

export default VoiceRecorder;
