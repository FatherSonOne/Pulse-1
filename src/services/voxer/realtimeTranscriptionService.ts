// Real-time Transcription Service
// WebSocket-based streaming transcription with multiple provider support

import { TranscriptionWord } from './voxerTypes';

// ============================================
// TYPES
// ============================================

export interface RealtimeTranscriptSegment {
  id: string;
  text: string;
  isFinal: boolean;
  confidence: number;
  speaker?: string;
  timestamp: number;
  words?: TranscriptionWord[];
}

export interface RealtimeTranscriptionCallbacks {
  onTranscript: (segment: RealtimeTranscriptSegment) => void;
  onError: (error: Error) => void;
  onStateChange: (state: RealtimeTranscriptionState) => void;
}

export type RealtimeTranscriptionState = 'idle' | 'connecting' | 'connected' | 'transcribing' | 'error' | 'closed';

export interface RealtimeTranscriptionConfig {
  language?: string;
  enableSpeakerDiarization?: boolean;
  sampleRate?: number;
  encoding?: string;
}

// ============================================
// REALTIME TRANSCRIPTION SERVICE
// ============================================

export class RealtimeTranscriptionService {
  private websocket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private processorNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private state: RealtimeTranscriptionState = 'idle';
  private callbacks: RealtimeTranscriptionCallbacks | null = null;
  private segmentId = 0;
  private fullTranscript = '';
  private assemblyaiApiKey: string;
  private deepgramApiKey: string;

  constructor(config: {
    assemblyaiApiKey?: string;
    deepgramApiKey?: string;
  } = {}) {
    this.assemblyaiApiKey = config.assemblyaiApiKey || '';
    this.deepgramApiKey = config.deepgramApiKey || '';
  }

  // ============================================
  // START REALTIME TRANSCRIPTION
  // ============================================

  async start(
    stream: MediaStream,
    callbacks: RealtimeTranscriptionCallbacks,
    config: RealtimeTranscriptionConfig = {}
  ): Promise<void> {
    this.callbacks = callbacks;
    this.fullTranscript = '';
    this.segmentId = 0;

    this.setState('connecting');

    try {
      // Use browser's built-in Web Speech API as fallback
      if (!this.assemblyaiApiKey && !this.deepgramApiKey) {
        await this.startWebSpeechAPI(stream, config);
        return;
      }

      // Use Deepgram if available (best for real-time)
      if (this.deepgramApiKey) {
        await this.startDeepgram(stream, config);
        return;
      }

      // Use AssemblyAI if available
      if (this.assemblyaiApiKey) {
        await this.startAssemblyAI(stream, config);
        return;
      }
    } catch (error) {
      this.setState('error');
      this.callbacks?.onError(error as Error);
    }
  }

  // ============================================
  // WEB SPEECH API (BROWSER FALLBACK)
  // ============================================

  private async startWebSpeechAPI(
    stream: MediaStream,
    config: RealtimeTranscriptionConfig
  ): Promise<void> {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = config.language || 'en-US';

    recognition.onstart = () => {
      this.setState('transcribing');
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;

        this.callbacks?.onTranscript({
          id: `segment-${++this.segmentId}`,
          text: transcript,
          isFinal,
          confidence: result[0].confidence || 0.9,
          timestamp: Date.now(),
        });

        if (isFinal) {
          this.fullTranscript += transcript + ' ';
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        this.setState('error');
        this.callbacks?.onError(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      // Restart if still in transcribing state
      if (this.state === 'transcribing') {
        recognition.start();
      }
    };

    recognition.start();
    (this as any).recognition = recognition;
    this.setState('connected');
  }

  // ============================================
  // DEEPGRAM REALTIME
  // ============================================

  private async startDeepgram(
    stream: MediaStream,
    config: RealtimeTranscriptionConfig
  ): Promise<void> {
    const wsUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=${config.sampleRate || 16000}&language=${config.language || 'en'}&punctuate=true&interim_results=true${config.enableSpeakerDiarization ? '&diarize=true' : ''}`;

    this.websocket = new WebSocket(wsUrl, ['token', this.deepgramApiKey]);

    this.websocket.onopen = () => {
      this.setState('connected');
      this.startAudioStreaming(stream).catch((err) => {
        this.setState('error');
        this.callbacks?.onError(err instanceof Error ? err : new Error(String(err)));
      });
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.channel?.alternatives?.[0]) {
          const alternative = data.channel.alternatives[0];
          const text = alternative.transcript;
          const isFinal = data.is_final || data.speech_final;

          if (text) {
            const segment: RealtimeTranscriptSegment = {
              id: `segment-${++this.segmentId}`,
              text,
              isFinal,
              confidence: alternative.confidence || 0.9,
              timestamp: Date.now(),
              speaker: data.channel.speaker,
              words: alternative.words?.map((w: any) => ({
                text: w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
                speaker: w.speaker,
              })),
            };

            this.callbacks?.onTranscript(segment);

            if (isFinal) {
              this.fullTranscript += text + ' ';
            }
          }
        }
      } catch (e) {
        console.error('Deepgram parse error:', e);
      }
    };

    this.websocket.onerror = (error) => {
      this.setState('error');
      this.callbacks?.onError(new Error('WebSocket error'));
    };

    this.websocket.onclose = () => {
      if (this.state !== 'closed') {
        this.setState('closed');
      }
    };
  }

  // ============================================
  // ASSEMBLYAI REALTIME
  // ============================================

  private async startAssemblyAI(
    stream: MediaStream,
    config: RealtimeTranscriptionConfig
  ): Promise<void> {
    // Get temporary token
    const tokenResponse = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'Authorization': this.assemblyaiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_in: 3600,
      }),
    });

    const { token } = await tokenResponse.json();

    const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${config.sampleRate || 16000}&token=${token}`;

    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      this.setState('connected');
      this.startAudioStreaming(stream).catch((err) => {
        this.setState('error');
        this.callbacks?.onError(err instanceof Error ? err : new Error(String(err)));
      });
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.message_type === 'PartialTranscript' || data.message_type === 'FinalTranscript') {
          const isFinal = data.message_type === 'FinalTranscript';
          const text = data.text;

          if (text) {
            const segment: RealtimeTranscriptSegment = {
              id: `segment-${++this.segmentId}`,
              text,
              isFinal,
              confidence: data.confidence || 0.9,
              timestamp: Date.now(),
              words: data.words?.map((w: any) => ({
                text: w.text,
                start: w.start / 1000,
                end: w.end / 1000,
                confidence: w.confidence,
              })),
            };

            this.callbacks?.onTranscript(segment);

            if (isFinal) {
              this.fullTranscript += text + ' ';
            }
          }
        }
      } catch (e) {
        console.error('AssemblyAI parse error:', e);
      }
    };

    this.websocket.onerror = () => {
      this.setState('error');
      this.callbacks?.onError(new Error('WebSocket error'));
    };

    this.websocket.onclose = () => {
      if (this.state !== 'closed') {
        this.setState('closed');
      }
    };
  }

  // ============================================
  // AUDIO STREAMING
  // ============================================

  /**
   * AudioWorklet processor source code (inlined as a Blob URL to avoid
   * shipping a separate .js file).  Runs on the audio rendering thread
   * and posts Float32 chunks back to the main thread via MessagePort.
   */
  private static readonly WORKLET_PROCESSOR_SRC = /* js */ `
    class PcmStreamProcessor extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0];
        if (input && input[0] && input[0].length > 0) {
          // Copy the Float32 samples so they survive the transfer
          this.port.postMessage(new Float32Array(input[0]));
        }
        return true; // keep processor alive
      }
    }
    registerProcessor('pcm-stream-processor', PcmStreamProcessor);
  `;

  private async startAudioStreaming(stream: MediaStream): Promise<void> {
    this.setState('transcribing');

    // Create audio context
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });

    const source = this.audioContext.createMediaStreamSource(stream);

    // Try AudioWorklet first (modern path), fall back to deprecated
    // ScriptProcessorNode for older browsers that lack support.
    if (this.audioContext.audioWorklet) {
      try {
        await this.startWithAudioWorklet(source);
        return;
      } catch (err) {
        console.warn('AudioWorklet setup failed, falling back to ScriptProcessorNode:', err);
      }
    }

    // Fallback: ScriptProcessorNode (deprecated but widely supported)
    this.startWithScriptProcessor(source);
  }

  /**
   * Modern path: register an AudioWorkletProcessor via Blob URL and
   * stream PCM data to the WebSocket from its message port.
   */
  private async startWithAudioWorklet(source: MediaStreamAudioSourceNode): Promise<void> {
    const blob = new Blob(
      [RealtimeTranscriptionService.WORKLET_PROCESSOR_SRC],
      { type: 'application/javascript' }
    );
    const workletUrl = URL.createObjectURL(blob);

    try {
      await this.audioContext!.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    const workletNode = new AudioWorkletNode(this.audioContext!, 'pcm-stream-processor');

    workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        const inputData = event.data;
        // Convert Float32 [-1,1] to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.websocket.send(pcmData.buffer);
      }
    };

    source.connect(workletNode);
    // AudioWorkletNode does not require connection to destination to
    // receive input, but some browsers need the graph to be "active".
    workletNode.connect(this.audioContext!.destination);

    this.processorNode = workletNode;
  }

  /**
   * Legacy fallback using the deprecated ScriptProcessorNode.
   * Kept for browsers that do not yet support AudioWorklet.
   */
  private startWithScriptProcessor(source: MediaStreamAudioSourceNode): void {
    const processor = this.audioContext!.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1,1] to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.websocket.send(pcmData.buffer);
      }
    };

    source.connect(processor);
    processor.connect(this.audioContext!.destination);

    this.processorNode = processor;
  }

  // ============================================
  // STOP TRANSCRIPTION
  // ============================================

  stop(): string {
    this.setState('closed');

    // Stop Web Speech API if used
    if ((this as any).recognition) {
      (this as any).recognition.stop();
      (this as any).recognition = null;
    }

    // Close WebSocket
    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.close();
      }
      this.websocket = null;
    }

    // Stop audio processing
    if (this.processorNode) {
      this.processorNode.disconnect();
      // Close the port if it's an AudioWorkletNode
      if ('port' in this.processorNode) {
        (this.processorNode as AudioWorkletNode).port.close();
      }
      this.processorNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    return this.fullTranscript.trim();
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  private setState(state: RealtimeTranscriptionState): void {
    this.state = state;
    this.callbacks?.onStateChange(state);
  }

  getState(): RealtimeTranscriptionState {
    return this.state;
  }

  getFullTranscript(): string {
    return this.fullTranscript.trim();
  }

  // ============================================
  // API KEY MANAGEMENT
  // ============================================

  setAssemblyAIApiKey(key: string): void {
    this.assemblyaiApiKey = key;
  }

  setDeepgramApiKey(key: string): void {
    this.deepgramApiKey = key;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let realtimeServiceInstance: RealtimeTranscriptionService | null = null;

export const getRealtimeTranscriptionService = (config?: {
  assemblyaiApiKey?: string;
  deepgramApiKey?: string;
}): RealtimeTranscriptionService => {
  if (!realtimeServiceInstance) {
    realtimeServiceInstance = new RealtimeTranscriptionService(config);
  }
  return realtimeServiceInstance;
};

export default RealtimeTranscriptionService;
