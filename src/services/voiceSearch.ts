/**
 * Voice Search Service
 * Uses browser Web Speech API for voice input
 */

export interface VoiceSearchResult {
  transcript: string;
  confidence: number;
}

export class VoiceSearchService {
  private recognition: any = null;
  private isSupported: boolean = false;
  private _isListening: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.isSupported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
      }
    }
  }

  /**
   * Check if voice search is supported
   */
  isVoiceSearchSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Start voice recognition
   */
  async startListening(): Promise<VoiceSearchResult> {
    if (!this.isSupported || !this.recognition) {
      throw new Error('Voice search is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      this._isListening = true;

      this.recognition.onresult = (event: any) => {
        this._isListening = false;
        const result = event.results[0];
        resolve({
          transcript: result[0].transcript,
          confidence: result[0].confidence,
        });
      };

      this.recognition.onerror = (event: any) => {
        this._isListening = false;
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      this.recognition.onend = () => {
        this._isListening = false;
      };

      this.recognition.start();
    });
  }

  /**
   * Stop voice recognition
   */
  stopListening(): void {
    this._isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  /**
   * Check if currently listening
   */
  isListening(): boolean {
    return this._isListening;
  }
}

export const voiceSearchService = new VoiceSearchService();