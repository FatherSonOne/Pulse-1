import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

interface LivingAIProps {
  messages: any[];
  input: string;
  setInput: (input: string) => void;
  onSendMessage: () => void;
  isLoading: boolean;
  isAIStreaming: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (enabled: boolean) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  isDarkMode?: boolean;
}

type AIState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const LivingAI: React.FC<LivingAIProps> = ({
  messages,
  input,
  setInput,
  onSendMessage,
  isLoading,
  isAIStreaming,
  isSpeaking,
  voiceEnabled,
  onVoiceEnabledChange,
  onTranscript,
  isDarkMode = false,
}) => {
  const [aiState, setAIState] = useState<AIState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const frameCountRef = useRef(0);

  // Detect mobile for performance optimization
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
      setIsMobile(mobile);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update AI state based on props
  useEffect(() => {
    if (isSpeaking) {
      setAIState('speaking');
    } else if (isAIStreaming || isLoading) {
      setAIState('thinking');
    } else if (isRecording || voiceEnabled) {
      setAIState('listening');
    } else {
      setAIState('idle');
    }
  }, [isSpeaking, isAIStreaming, isLoading, isRecording, voiceEnabled]);

  // Initialize audio context and visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Start microphone access
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = microphone;
      microphone.connect(analyser);

      setIsRecording(true);
      onVoiceEnabledChange(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone');
    }
  }, [onVoiceEnabledChange]);

  // Stop microphone access
  const stopMicrophone = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    microphoneRef.current = null;
    setIsRecording(false);
    setAudioLevel(0);
    onVoiceEnabledChange(false);
  }, [onVoiceEnabledChange]);

  // Handle mic button press and hold
  const handleMicPress = useCallback(() => {
    setIsHoldingMic(true);
    if (!isRecording) {
      startMicrophone();
    }
  }, [isRecording, startMicrophone]);

  const handleMicRelease = useCallback(() => {
    setIsHoldingMic(false);
    if (isRecording && !voiceEnabled) {
      stopMicrophone();
    }
  }, [isRecording, voiceEnabled, stopMicrophone]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    // Canvas context failure fallback - prevents black screen
    if (!ctx) {
      console.warn('LivingAI: Failed to get canvas context');
      return;
    }

    const draw = () => {
      // Frame rate limiting on mobile (30fps instead of 60fps)
      frameCountRef.current++;
      if (isMobile && frameCountRef.current % 2 !== 0) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 - 60; // Offset upward

      // Get audio data if available
      let dataArray: Uint8Array | null = null;
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average audio level
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / bufferLength;
        setAudioLevel(avg / 255);
      }

      // Draw based on AI state
      switch (aiState) {
        case 'idle':
          drawIdleState(ctx, centerX, centerY, width, height, isDarkMode);
          break;
        case 'listening':
          drawListeningState(ctx, centerX, centerY, width, height, audioLevel, isDarkMode);
          break;
        case 'thinking':
          drawThinkingState(ctx, centerX, centerY, width, height, isDarkMode);
          break;
        case 'speaking':
          drawSpeakingState(ctx, centerX, centerY, width, height, isDarkMode);
          break;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [aiState, audioLevel, isDarkMode, isMobile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, [stopMicrophone]);

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-[#000000]' : 'bg-gradient-to-b from-white via-gray-50 to-white'}`}>
      {/* Main Visualizer Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Fallback gradient background for when canvas fails */}
        <div
          className={`absolute inset-0 ${
            isDarkMode
              ? 'bg-gradient-radial from-rose-500/10 via-transparent to-transparent'
              : 'bg-gradient-radial from-rose-200/30 via-transparent to-transparent'
          }`}
          style={{ zIndex: 0 }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'crisp-edges', zIndex: 1 }}
        />
        
        {/* Ambient breathing effect */}
        <div className={`absolute inset-0 pointer-events-none ${
          isDarkMode 
            ? 'bg-gradient-radial from-rose-500/5 via-transparent to-transparent' 
            : 'bg-gradient-radial from-rose-100/30 via-transparent to-transparent'
        } animate-pulse`} />
      </div>

      {/* Input Area */}
      <div className={`shrink-0 p-6 ${isDarkMode ? 'bg-black/50' : 'bg-white/80'} backdrop-blur-xl border-t ${isDarkMode ? 'border-rose-500/20' : 'border-gray-200'}`}>
        <div className="max-w-2xl mx-auto">
          <div className={`relative flex items-center gap-3 px-6 py-4 rounded-full shadow-lg transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/80 border border-rose-500/30 focus-within:border-rose-500/60 focus-within:shadow-rose-500/20'
              : 'bg-white border border-gray-300 focus-within:border-rose-400 focus-within:shadow-rose-200/50'
          }`}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
              placeholder="Ask anything..."
              className={`flex-1 bg-transparent outline-none text-sm ${
                isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              }`}
              disabled={isLoading}
            />
            
            {/* Mic Button */}
            <button
              ref={micButtonRef}
              onMouseDown={handleMicPress}
              onMouseUp={handleMicRelease}
              onMouseLeave={handleMicRelease}
              onTouchStart={handleMicPress}
              onTouchEnd={handleMicRelease}
              onClick={() => {
                if (isRecording) {
                  stopMicrophone();
                } else {
                  startMicrophone();
                }
              }}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                isRecording || isHoldingMic
                  ? isDarkMode
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 scale-110'
                    : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-110'
                  : isDarkMode
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-rose-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-rose-500'
              }`}
            >
              <i className={`fa fa-microphone ${isRecording || isHoldingMic ? 'animate-pulse' : ''}`}></i>
              {(isRecording || isHoldingMic) && (
                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75"></span>
              )}
            </button>

            {/* Send Button */}
            {input.trim() && (
              <button
                onClick={onSendMessage}
                disabled={isLoading}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-600 hover:to-pink-600 shadow-lg shadow-rose-500/30'
                    : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-600 hover:to-pink-600 shadow-md'
                } disabled:opacity-50`}
              >
                Send
              </button>
            )}
          </div>

          {/* Voice Status Indicator */}
          {(isRecording || isHoldingMic) && (
            <div className={`mt-3 text-center text-xs ${
              isDarkMode ? 'text-rose-400' : 'text-rose-600'
            }`}>
              <i className="fa fa-circle mr-1 animate-pulse"></i>
              {isHoldingMic ? 'Listening... Release to stop' : 'Voice input active'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Drawing functions for different AI states
function drawIdleState(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  isDarkMode: boolean
) {
  const time = Date.now() * 0.001;
  const baseColor = isDarkMode ? '#f43f5e' : '#f43f5e';
  const glowColor = isDarkMode ? '#ec4899' : '#f9a8d4';

  // Gentle breathing AI Mind (central pulsing orb)
  const pulse = 0.5 + Math.sin(time * 0.8) * 0.1;
  const radius = 40 * pulse;

  ctx.save();
  ctx.globalAlpha = 0.3;
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Main orb
  ctx.save();
  const mainGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  mainGradient.addColorStop(0, baseColor);
  mainGradient.addColorStop(0.7, glowColor);
  mainGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = mainGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Subtle neural network lines
  ctx.strokeStyle = isDarkMode ? 'rgba(244, 63, 94, 0.2)' : 'rgba(244, 63, 94, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + time * 0.2;
    const x = centerX + Math.cos(angle) * 80;
    const y = centerY + Math.sin(angle) * 80;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

function drawListeningState(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  audioLevel: number,
  isDarkMode: boolean
) {
  const time = Date.now() * 0.001;
  const baseColor = isDarkMode ? '#f43f5e' : '#f43f5e';
  const glowColor = isDarkMode ? '#ec4899' : '#f9a8d4';

  // AI Mind (central orb) - more active
  const pulse = 0.6 + Math.sin(time * 1.2) * 0.15 + audioLevel * 0.2;
  const radius = 45 * pulse;

  // Draw AI "ears" - two circular areas that pick up vibrations
  const earDistance = 120;
  const earSize = 30 + audioLevel * 20;
  const leftEarX = centerX - earDistance;
  const rightEarX = centerX + earDistance;

  // Left ear
  ctx.save();
  const leftEarGradient = ctx.createRadialGradient(leftEarX, centerY, 0, leftEarX, centerY, earSize);
  leftEarGradient.addColorStop(0, baseColor);
  leftEarGradient.addColorStop(0.6, glowColor);
  leftEarGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = leftEarGradient;
  ctx.globalAlpha = 0.4 + audioLevel * 0.4;
  ctx.beginPath();
  ctx.arc(leftEarX, centerY, earSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right ear
  ctx.save();
  const rightEarGradient = ctx.createRadialGradient(rightEarX, centerY, 0, rightEarX, centerY, earSize);
  rightEarGradient.addColorStop(0, baseColor);
  rightEarGradient.addColorStop(0.6, glowColor);
  rightEarGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = rightEarGradient;
  ctx.globalAlpha = 0.4 + audioLevel * 0.4;
  ctx.beginPath();
  ctx.arc(rightEarX, centerY, earSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Vibration waves from ears to mind
  const waveCount = 3;
  for (let i = 0; i < waveCount; i++) {
    const waveOffset = (time * 200 + i * 40) % 120;
    const waveAlpha = 1 - (waveOffset / 120);
    
    // Left ear to mind
    ctx.save();
    ctx.strokeStyle = isDarkMode ? `rgba(244, 63, 94, ${waveAlpha * 0.6})` : `rgba(244, 63, 94, ${waveAlpha * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftEarX + waveOffset, centerY);
    ctx.lineTo(centerX - 30, centerY);
    ctx.stroke();
    ctx.restore();

    // Right ear to mind
    ctx.save();
    ctx.strokeStyle = isDarkMode ? `rgba(244, 63, 94, ${waveAlpha * 0.6})` : `rgba(244, 63, 94, ${waveAlpha * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rightEarX - waveOffset, centerY);
    ctx.lineTo(centerX + 30, centerY);
    ctx.stroke();
    ctx.restore();
  }

  // Central AI Mind - pulsing with received vibrations
  ctx.save();
  const mainGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  mainGradient.addColorStop(0, baseColor);
  mainGradient.addColorStop(0.5, glowColor);
  mainGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = mainGradient;
  ctx.globalAlpha = 0.7 + audioLevel * 0.3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawThinkingState(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  isDarkMode: boolean
) {
  const time = Date.now() * 0.001;
  const baseColor = isDarkMode ? '#f43f5e' : '#f43f5e';
  const glowColor = isDarkMode ? '#ec4899' : '#f9a8d4';

  // Intense pulsing AI Mind
  const pulse = 0.7 + Math.sin(time * 2) * 0.2;
  const radius = 50 * pulse;

  // Multiple pulsing rings
  for (let i = 0; i < 4; i++) {
    const ringRadius = radius + i * 20;
    const ringAlpha = 0.3 - (i * 0.07);
    const ringPulse = Math.sin(time * 2 + i * 0.5) * 0.3 + 0.7;

    ctx.save();
    ctx.strokeStyle = isDarkMode 
      ? `rgba(244, 63, 94, ${ringAlpha * ringPulse})` 
      : `rgba(244, 63, 94, ${ringAlpha * ringPulse * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius * ringPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Central glowing mind
  ctx.save();
  const mainGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  mainGradient.addColorStop(0, baseColor);
  mainGradient.addColorStop(0.4, glowColor);
  mainGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = mainGradient;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Neural network pulses
  ctx.strokeStyle = isDarkMode ? 'rgba(244, 63, 94, 0.4)' : 'rgba(244, 63, 94, 0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + time * 0.5;
    const distance = 100 + Math.sin(time * 2 + i) * 20;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    const pulseAlpha = 0.3 + Math.sin(time * 3 + i) * 0.3;
    
    ctx.save();
    ctx.globalAlpha = pulseAlpha;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSpeakingState(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  isDarkMode: boolean
) {
  const time = Date.now() * 0.002;
  const baseColor = isDarkMode ? '#f43f5e' : '#f43f5e';
  const glowColor = isDarkMode ? '#ec4899' : '#f9a8d4';

  // AI Mind pulsing
  const pulse = 0.8 + Math.sin(time * 1.5) * 0.15;
  const radius = 45 * pulse;

  // Central mind
  ctx.save();
  const mainGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  mainGradient.addColorStop(0, baseColor);
  mainGradient.addColorStop(0.5, glowColor);
  mainGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = mainGradient;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Vocal cords - opening upward from the mind
  const cordCount = 8;
  const cordHeight = 150;
  const cordWidth = 40;
  const baseY = centerY + radius;

  for (let i = 0; i < cordCount; i++) {
    const x = centerX + (i - cordCount / 2) * (cordWidth / cordCount);
    const wave = Math.sin(time * 3 + i * 0.5) * 15;
    const width = 3 + Math.abs(wave) * 0.3;
    const alpha = 0.6 + Math.sin(time * 2 + i) * 0.3;

    ctx.save();
    ctx.strokeStyle = isDarkMode 
      ? `rgba(244, 63, 94, ${alpha})` 
      : `rgba(244, 63, 94, ${alpha * 0.7})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + wave, baseY + cordHeight / 2, x, baseY + cordHeight);
    ctx.stroke();
    ctx.restore();
  }

  // Sound waves emanating upward
  for (let i = 0; i < 5; i++) {
    const waveRadius = 80 + i * 30 + Math.sin(time * 2 + i) * 10;
    const waveAlpha = 0.3 - (i * 0.05);
    
    ctx.save();
    ctx.strokeStyle = isDarkMode 
      ? `rgba(236, 72, 153, ${waveAlpha})` 
      : `rgba(236, 72, 153, ${waveAlpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, baseY + cordHeight, waveRadius, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }
}
