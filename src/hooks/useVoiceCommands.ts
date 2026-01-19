/**
 * useVoiceCommands Hook
 *
 * Integrates voice-to-text with command parsing and execution.
 * Provides a complete voice command interface for the app.
 *
 * Features:
 * - Voice activation with visual feedback
 * - Command parsing and execution
 * - Navigation support
 * - Spoken confirmations
 * - Command history
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVoiceToText, VoiceToTextProvider } from './useVoiceToText';
import { voiceCommandService, VoiceCommand, VoiceCommandResult, VoiceCommandType } from '../services/voiceCommandService';

// ============= TYPES =============

export interface VoiceCommandState {
  /** Current status of the voice command system */
  status: 'idle' | 'listening' | 'processing' | 'executing' | 'error';
  /** Last parsed command */
  lastCommand: VoiceCommand | null;
  /** Last execution result */
  lastResult: VoiceCommandResult | null;
  /** Current transcript (while speaking) */
  currentTranscript: string;
  /** Interim transcript (partial) */
  interimTranscript: string;
  /** Error message if any */
  error: string | null;
}

export interface UseVoiceCommandsOptions {
  /** Enable spoken feedback for commands */
  enableSpokenFeedback?: boolean;
  /** Use AI parsing for better command understanding */
  enableAIParsing?: boolean;
  /** Auto-execute commands without confirmation */
  autoExecute?: boolean;
  /** Language for speech recognition */
  language?: string;
  /** Provider preference */
  provider?: VoiceToTextProvider;
  /** OpenAI API key for transcription */
  openaiApiKey?: string;
  /** Callback when navigation command is issued */
  onNavigate?: (view: string) => void;
  /** Callback for any command execution */
  onCommand?: (result: VoiceCommandResult) => void;
  /** Callback when voice mode activates/deactivates */
  onActiveChange?: (active: boolean) => void;
}

export interface UseVoiceCommandsReturn extends VoiceCommandState {
  /** Whether voice commands are supported */
  isSupported: boolean;
  /** Whether currently listening */
  isActive: boolean;
  /** Start listening for voice commands */
  activate: () => void;
  /** Stop listening */
  deactivate: () => void;
  /** Toggle listening state */
  toggle: () => void;
  /** Manually execute a command from text */
  executeText: (text: string) => Promise<VoiceCommandResult>;
  /** Get available commands */
  getCommands: () => Array<{ type: VoiceCommandType; description: string; examples: string[] }>;
  /** Get command history */
  getHistory: () => VoiceCommand[];
  /** Speak text aloud */
  speak: (text: string) => Promise<void>;
  /** Stop any ongoing speech */
  stopSpeaking: () => void;
  /** Clear current state */
  clear: () => void;
}

// ============= VOICE COMMAND TEMPLATES =============

export const VOICE_COMMAND_TEMPLATES = {
  // Quick actions
  quickActions: [
    { label: 'Check Messages', command: 'Read my latest messages' },
    { label: 'Check Emails', command: 'Read my latest emails' },
    { label: 'Open War Room', command: 'Open War Room' },
    { label: 'Open Calendar', command: 'Open Calendar' },
    { label: 'Search', command: 'Search for...' },
    { label: 'Notifications', command: 'Show notifications' },
    { label: 'Tasks', command: 'Open tasks' },
    { label: 'Add Contact', command: 'Add contact' },
  ],

  // Navigation shortcuts
  navigation: [
    { label: 'Dashboard', command: 'Go to dashboard' },
    { label: 'Messages', command: 'Open messages' },
    { label: 'Email', command: 'Open email' },
    { label: 'Calendar', command: 'Show calendar' },
    { label: 'Contacts', command: 'Go to contacts' },
    { label: 'War Room', command: 'Open War Room' },
    { label: 'Settings', command: 'Open settings' },
    { label: 'Analytics', command: 'Show analytics' },
    { label: 'Archives', command: 'Open archives' },
    { label: 'Tools', command: 'Open tools' },
  ],

  // Communication templates
  communication: [
    { label: 'Quick Email', command: 'Send email to [name] about [subject]' },
    { label: 'Quick Text', command: 'Text [name] saying [message]' },
    { label: 'Schedule Call', command: 'Schedule meeting with [name] at [time]' },
  ],

  // Productivity templates
  productivity: [
    { label: 'New Task', command: 'Create task: [description]' },
    { label: 'Set Reminder', command: 'Remind me to [action] at [time]' },
    { label: 'Add Note', command: 'Add note: [content]' },
    { label: 'Log Decision', command: 'Decision: [what was decided]' },
  ],

  // Search templates
  search: [
    { label: 'Find Messages', command: 'Search for messages from [name]' },
    { label: 'Find Emails', command: 'Find emails about [topic]' },
    { label: 'Look Up Contact', command: 'Show me [contact name]' },
    { label: 'Search Anything', command: 'Search for [query]' },
  ],

  // UI helpers
  ui: [
    { label: 'Toggle Theme', command: 'Toggle theme' },
    { label: 'Dark Mode', command: 'Enable dark mode' },
    { label: 'Light Mode', command: 'Disable dark mode' },
    { label: 'Collapse Sidebar', command: 'Collapse sidebar' },
    { label: 'Expand Sidebar', command: 'Expand sidebar' },
  ],
};

// ============= HOOK IMPLEMENTATION =============

export function useVoiceCommands(options: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn {
  const {
    enableSpokenFeedback = true,
    enableAIParsing = true,
    autoExecute = true,
    language = 'en-US',
    provider,
    openaiApiKey,
    onNavigate,
    onCommand,
    onActiveChange,
  } = options;

  // State
  const [state, setState] = useState<VoiceCommandState>({
    status: 'idle',
    lastCommand: null,
    lastResult: null,
    currentTranscript: '',
    interimTranscript: '',
    error: null,
  });

  // Track if we're processing a command
  const processingRef = useRef(false);
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Voice-to-text hook
  const voiceToText = useVoiceToText({
    language,
    provider,
    openaiApiKey,
    continuous: false,
    onInterimResult: (text) => {
      setState(prev => ({
        ...prev,
        interimTranscript: text,
        status: 'listening',
      }));
    },
    onFinalResult: async (text) => {
      if (processingRef.current) return;

      setState(prev => ({
        ...prev,
        currentTranscript: text,
        interimTranscript: '',
        status: 'processing',
      }));

      await processCommand(text);
    },
    onError: (error) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error,
      }));
    },
  });

  // Destructure stable references to avoid infinite loops
  const {
    isListening: voiceIsListening,
    isSupported: voiceIsSupported,
    startListening: voiceStartListening,
    stopListening: voiceStopListening,
    clearTranscript: voiceClearTranscript,
  } = voiceToText;

  // Process a voice command
  const processCommand = useCallback(async (text: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      // Parse the command
      let command: VoiceCommand;
      if (enableAIParsing) {
        command = await voiceCommandService.parseCommandWithAI(text, openaiApiKey);
      } else {
        command = voiceCommandService.parseCommand(text);
      }

      setState(prev => ({
        ...prev,
        lastCommand: command,
        status: 'executing',
      }));

      // Execute if auto-execute is enabled or confidence is high
      if (autoExecute || command.confidence > 0.85) {
        const result = await voiceCommandService.executeCommand(command);

        setState(prev => ({
          ...prev,
          lastResult: result,
          status: result.success ? 'idle' : 'error',
          error: result.success ? null : result.message,
        }));

        // Handle any command that provides a view to navigate to
        if (result.success && result.data?.view) {
          onNavigate?.(result.data.view);
        }

        // Notify callback
        onCommand?.(result);

        // Spoken feedback
        if (enableSpokenFeedback && result.success) {
          try {
            await voiceCommandService.speak(result.message);
          } catch (e) {
            console.warn('Speech synthesis failed:', e);
          }
        }
      } else {
        // Low confidence - need confirmation
        setState(prev => ({
          ...prev,
          status: 'idle',
        }));

        if (enableSpokenFeedback) {
          await voiceCommandService.speak(
            `Did you mean: ${command.suggestedAction}? Say yes to confirm.`
          );
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Command processing failed',
      }));
    } finally {
      processingRef.current = false;
    }
  }, [enableAIParsing, autoExecute, enableSpokenFeedback, onNavigate, onCommand, openaiApiKey]);

  // Deactivate voice commands (defined first to avoid circular dependency)
  const deactivate = useCallback(() => {
    voiceStopListening();
    voiceCommandService.stopSpeaking();

    if (commandTimeoutRef.current) {
      clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      status: 'idle',
      interimTranscript: '',
    }));

    onActiveChange?.(false);
  }, [voiceStopListening, onActiveChange]);

  // Activate voice commands
  const activate = useCallback(() => {
    if (voiceIsListening) return;

    setState(prev => ({
      ...prev,
      status: 'listening',
      error: null,
      currentTranscript: '',
      interimTranscript: '',
    }));

    voiceStartListening();
    onActiveChange?.(true);

    // Auto-stop after 30 seconds of listening
    if (commandTimeoutRef.current) {
      clearTimeout(commandTimeoutRef.current);
    }
    commandTimeoutRef.current = setTimeout(() => {
      voiceStopListening();
      voiceCommandService.stopSpeaking();
      commandTimeoutRef.current = null;
      setState(prev => ({
        ...prev,
        status: 'idle',
        interimTranscript: '',
      }));
      onActiveChange?.(false);
    }, 30000);
  }, [voiceIsListening, voiceStartListening, voiceStopListening, onActiveChange]);

  // Toggle
  const toggle = useCallback(() => {
    if (voiceIsListening) {
      deactivate();
    } else {
      activate();
    }
  }, [voiceIsListening, activate, deactivate]);

  // Execute text command manually
  const executeText = useCallback(async (text: string): Promise<VoiceCommandResult> => {
    setState(prev => ({
      ...prev,
      currentTranscript: text,
      status: 'processing',
    }));

    processingRef.current = true;

    try {
      const command = enableAIParsing
        ? await voiceCommandService.parseCommandWithAI(text, openaiApiKey)
        : voiceCommandService.parseCommand(text);

      const result = await voiceCommandService.executeCommand(command);

      setState(prev => ({
        ...prev,
        lastCommand: command,
        lastResult: result,
        status: result.success ? 'idle' : 'error',
        error: result.success ? null : result.message,
      }));

      if (command.type === 'navigate' && result.success && result.data?.view) {
        onNavigate?.(result.data.view);
      }

      onCommand?.(result);

      return result;
    } finally {
      processingRef.current = false;
    }
  }, [enableAIParsing, onNavigate, onCommand, openaiApiKey]);

  // Clear state
  const clear = useCallback(() => {
    voiceClearTranscript();
    setState({
      status: 'idle',
      lastCommand: null,
      lastResult: null,
      currentTranscript: '',
      interimTranscript: '',
      error: null,
    });
  }, [voiceClearTranscript]);

  // Speak wrapper
  const speak = useCallback(async (text: string) => {
    await voiceCommandService.speak(text);
  }, []);

  // Stop speaking wrapper
  const stopSpeaking = useCallback(() => {
    voiceCommandService.stopSpeaking();
  }, []);

  // Get commands wrapper
  const getCommands = useCallback(() => {
    return voiceCommandService.getAvailableCommands();
  }, []);

  // Get history wrapper
  const getHistory = useCallback(() => {
    return voiceCommandService.getHistory();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
      }
      voiceCommandService.stopSpeaking();
    };
  }, []);

  return {
    // State
    ...state,
    isSupported: voiceIsSupported,
    isActive: voiceIsListening,

    // Actions
    activate,
    deactivate,
    toggle,
    executeText,
    getCommands,
    getHistory,
    speak,
    stopSpeaking,
    clear,
  };
}

export default useVoiceCommands;
