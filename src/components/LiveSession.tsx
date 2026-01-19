import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, MessageLog } from '../types';
import { 
  createPcmBlob, 
  decodeAudioData, 
  blobToBase64, 
  PCM_SAMPLE_RATE, 
  OUTPUT_SAMPLE_RATE 
} from '../services/audioService';
import { saveArchiveItem } from '../services/dbService';
import AudioVisualizer from './AudioVisualizer';

const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const VIDEO_FRAME_RATE = 5; 
const JPEG_QUALITY = 0.5;

interface LiveSessionProps {
  apiKey: string;
  onClose: () => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ apiKey, onClose }) => {
  const [status, setStatus] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Audio Contexts & Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Playback timing
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Video Handling
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Gemini Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiClientRef = useRef<GoogleGenAI | null>(null);

  // Transcription buffers
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const initializedRef = useRef(false);

  // --- Initialization ---

  const initializeAudioContexts = () => {
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE,
      });
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
    }
    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: OUTPUT_SAMPLE_RATE,
      });
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);
    }
  };

  const startSession = async () => {
    if (!apiKey) {
      console.error("No API key provided");
      return;
    }

    setStatus(ConnectionState.CONNECTING);
    initializeAudioContexts();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      if (inputAudioContextRef.current && inputAnalyserRef.current) {
        const source = inputAudioContextRef.current.createMediaStreamSource(stream);
        const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        source.connect(inputAnalyserRef.current);
        inputAnalyserRef.current.connect(processor);
        processor.connect(inputAudioContextRef.current.destination);

        processor.onaudioprocess = (e) => {
          if (isMicMuted || status !== ConnectionState.CONNECTED) return;
          
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);

          if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          }
        };
      }

      aiClientRef.current = new GoogleGenAI({ apiKey });
      
      sessionPromiseRef.current = aiClientRef.current.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: 'You are Pulse, an intelligent, concise, and helpful AI assistant. You speak clearly and efficiently.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Session Opened");
            setStatus(ConnectionState.CONNECTED);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: 'Connected to Pulse.', timestamp: new Date() }]);
          },
          onmessage: handleServerMessage,
          onclose: () => {
            console.log("Session Closed");
            setStatus(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error("Session Error", err);
            setStatus(ConnectionState.ERROR);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: 'Connection error occurred.', timestamp: new Date() }]);
          },
        }
      });

    } catch (error: any) {
      console.error("Failed to start session:", error);
      setStatus(ConnectionState.ERROR);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'system', 
        text: `Connection failed: ${errorMessage}. ${errorMessage.includes('model') ? 'The model may not be available. Try checking your API key and model name.' : 'Please check your API key and try again.'}`, 
        timestamp: new Date() 
      }]);
    }
  };

  // --- Message Handling ---

  const handleServerMessage = async (message: LiveServerMessage) => {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && outputAudioContextRef.current && outputAnalyserRef.current) {
      try {
        const ctx = outputAudioContextRef.current;
        const buffer = await decodeAudioData(audioData, ctx, OUTPUT_SAMPLE_RATE);
        
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(outputAnalyserRef.current);
        
        source.addEventListener('ended', () => {
          sourcesRef.current.delete(source);
        });

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += buffer.duration;
        sourcesRef.current.add(source);
      } catch (e) {
        console.error("Error decoding audio", e);
      }
    }

    if (message.serverContent?.outputTranscription) {
      currentOutputTranscription.current += message.serverContent.outputTranscription.text;
    }
    if (message.serverContent?.inputTranscription) {
      currentInputTranscription.current += message.serverContent.inputTranscription.text;
    }

    if (message.serverContent?.turnComplete) {
      if (currentInputTranscription.current) {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + '-user',
          role: 'user',
          text: currentInputTranscription.current,
          timestamp: new Date()
        }]);
        currentInputTranscription.current = '';
      }
      if (currentOutputTranscription.current) {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + '-model',
          role: 'model',
          text: currentOutputTranscription.current,
          timestamp: new Date()
        }]);
        currentOutputTranscription.current = '';
      }
    }

    if (message.serverContent?.interrupted) {
      sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      currentOutputTranscription.current = ''; 
    }
  };

  // --- Video Streaming ---

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsVideoEnabled(true);
        
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        
        frameIntervalRef.current = window.setInterval(() => {
          captureAndSendFrame();
        }, 1000 / VIDEO_FRAME_RATE);
      }
    } catch (err) {
      console.error("Failed to access camera", err);
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsVideoEnabled(false);
  };

  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || status !== ConnectionState.CONNECTED) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = video.videoWidth * 0.5;
    canvas.height = video.videoHeight * 0.5;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob && sessionPromiseRef.current) {
        const base64 = await blobToBase64(blob);
        sessionPromiseRef.current.then(session => {
           session.sendRealtimeInput({
             media: { data: base64, mimeType: 'image/jpeg' }
           });
        });
      }
    }, 'image/jpeg', JPEG_QUALITY);
  };

  // --- Cleanup ---

  const disconnect = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
         (session as any).close(); 
      }).catch(e => console.error(e));
      sessionPromiseRef.current = null;
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
    }
    
    // Safely close audio contexts
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(e => console.error("Error closing input ctx", e));
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(e => console.error("Error closing output ctx", e));
    }
    outputAudioContextRef.current = null;

    stopVideo();
    setStatus(ConnectionState.DISCONNECTED);
  }, []);

  const saveTranscript = useCallback(() => {
    if (messages.length > 2) {
        const content = messages
          .filter(m => m.role !== 'system')
          .map(m => `${m.role.toUpperCase()}: ${m.text}`)
          .join('\n');
        
        await saveArchiveItem({
            type: 'transcript',
            title: `Live Session ${new Date().toLocaleString()}`,
            content: content,
            tags: ['live', 'voice']
        });
    }
  }, [messages]);

  useEffect(() => {
    if (!initializedRef.current && apiKey) {
      initializedRef.current = true;
      startSession();
    } else if (!apiKey) {
      setStatus(ConnectionState.ERROR);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'system', 
        text: 'Error: No API key provided. Please set VITE_GEMINI_API_KEY in your .env file.', 
        timestamp: new Date() 
      }]);
    }
    return () => {
      disconnect();
    };
  }, [apiKey]);

  // Save on close or unmount
  useEffect(() => {
      return () => {
          saveTranscript();
      };
  }, [saveTranscript]);

  // --- Render ---

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl animate-scale-in">
      <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status === ConnectionState.CONNECTED ? 'bg-emerald-500 animate-pulse' : status === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            <h2 className="text-lg font-semibold text-white tracking-wide">PULSE LIVE</h2>
            {status === ConnectionState.ERROR && (
              <button 
                onClick={() => {
                  initializedRef.current = false;
                  startSession();
                }}
                className="ml-4 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
              >
                <i className="fa-solid fa-rotate mr-1"></i> Retry
              </button>
            )}
        </div>
        <button onClick={() => { saveTranscript(); disconnect(); onClose(); }} className="text-zinc-400 hover:text-white transition">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row relative">
        <div className="flex-1 flex flex-col p-6 items-center justify-center relative bg-gradient-to-br from-zinc-900 to-zinc-950">
            <div className="absolute top-6 left-6 text-xs font-mono text-zinc-500">
                STATUS: {status} <br/>
                MODEL: {GEMINI_MODEL}
            </div>

            <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none ${isVideoEnabled ? 'block' : 'hidden'}`} muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            <div className="w-full max-w-md aspect-video flex flex-col items-center justify-center gap-4 z-10">
                <div className="w-full h-32 bg-zinc-950/50 backdrop-blur-sm rounded-xl border border-zinc-800 p-2 shadow-inner group hover:shadow-emerald-500/20 transition-all duration-500">
                   <AudioVisualizer 
                      analyser={outputAnalyserRef.current} 
                      isActive={status === ConnectionState.CONNECTED}
                      color="#10b981" 
                      apiKey={apiKey}
                   />
                </div>
                <div className="w-full h-16 bg-zinc-950/50 backdrop-blur-sm rounded-xl border border-zinc-800 p-2 shadow-inner flex items-center justify-center group hover:shadow-blue-500/20 transition-all duration-500">
                   <div className="text-zinc-500 text-xs font-mono absolute top-1 left-2">MIC INPUT</div>
                   <AudioVisualizer 
                      analyser={inputAnalyserRef.current} 
                      isActive={status === ConnectionState.CONNECTED && !isMicMuted}
                      color="#3b82f6"
                      apiKey={apiKey}
                   />
                </div>
            </div>

            <div className="flex gap-6 mt-8 z-10">
                <button 
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all shadow-lg hover:scale-110 ${isMicMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'}`}
                >
                   <i className={`fa-solid ${isMicMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                </button>

                <button 
                  onClick={isVideoEnabled ? stopVideo : startVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all shadow-lg hover:scale-110 ${isVideoEnabled ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/50' : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'}`}
                >
                   <i className={`fa-solid ${isVideoEnabled ? 'fa-video' : 'fa-video-slash'}`}></i>
                </button>
            </div>
        </div>

        <div className="hidden md:flex w-80 border-l border-zinc-800 bg-zinc-950/50 flex-col">
            <div className="p-3 border-b border-zinc-800 text-xs font-mono text-zinc-400 uppercase tracking-wider">Transcript</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-zinc-600 text-sm text-center italic mt-10">Conversation will appear here...</div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-slide-up`}>
                        <span className="text-[10px] text-zinc-500 mb-1 font-mono uppercase">{msg.role}</span>
                        <div className={`rounded-lg p-3 text-sm max-w-[90%] ${
                            msg.role === 'user' 
                                ? 'bg-zinc-800 text-zinc-200' 
                                : msg.role === 'system'
                                ? 'bg-transparent text-zinc-500 italic border border-zinc-800'
                                : 'bg-emerald-900/20 text-emerald-200 border border-emerald-900/30'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default LiveSession;