// Message Enhancements Hook
// Centralized hook for managing all 30 message enhancement features

import { useState, useEffect, useCallback, useMemo } from 'react';
import { messageEnhancementsService } from '../services/messageEnhancementsService';
import { achievementService } from '../services/achievementService';
import type { Thread, Message } from '../types';
import type {
  MessageMood,
  RichMessageCard,
  SmartComposeSuggestion,
  AICoachSuggestion,
  ConversationHealth,
  MessageImpact,
  Achievement,
  ProactiveInsight,
  MessageTranslation,
  ThreadActions
} from '../types/messageEnhancements';

interface UseMessageEnhancementsOptions {
  apiKey: string | null;
  threads: Thread[];
  currentUserId: string;
}

export const useMessageEnhancements = ({
  apiKey,
  threads,
  currentUserId
}: UseMessageEnhancementsOptions) => {
  // ===== STATE =====
  const [threadActions, setThreadActions] = useState<Map<string, ThreadActions>>(new Map());
  const [messageImpacts, setMessageImpacts] = useState<Map<string, MessageImpact>>(new Map());
  const [conversationHealthMap, setConversationHealthMap] = useState<Map<string, ConversationHealth>>(new Map());
  const [smartSuggestions, setSmartSuggestions] = useState<SmartComposeSuggestion[]>([]);
  const [coachSuggestions, setCoachSuggestions] = useState<AICoachSuggestion[]>([]);
  const [proactiveInsights, setProactiveInsights] = useState<Map<string, ProactiveInsight[]>>(new Map());
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // ===== THREAD ACTIONS =====
  const toggleThreadPin = useCallback((conversationId: string) => {
    setThreadActions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(conversationId) || {
        isPinned: false,
        isStarred: false,
        isMuted: false,
        isArchived: false
      };
      newMap.set(conversationId, { ...current, isPinned: !current.isPinned });
      return newMap;
    });
  }, []);
  
  const toggleThreadStar = useCallback((conversationId: string) => {
    setThreadActions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(conversationId) || {
        isPinned: false,
        isStarred: false,
        isMuted: false,
        isArchived: false
      };
      newMap.set(conversationId, { ...current, isStarred: !current.isStarred });
      return newMap;
    });
  }, []);
  
  const toggleThreadMute = useCallback((conversationId: string) => {
    setThreadActions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(conversationId) || {
        isPinned: false,
        isStarred: false,
        isMuted: false,
        isArchived: false
      };
      newMap.set(conversationId, { ...current, isMuted: !current.isMuted });
      return newMap;
    });
  }, []);
  
  const toggleThreadArchive = useCallback((conversationId: string) => {
    setThreadActions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(conversationId) || {
        isPinned: false,
        isStarred: false,
        isMuted: false,
        isArchived: false
      };
      newMap.set(conversationId, { ...current, isArchived: !current.isArchived });
      return newMap;
    });
  }, []);
  
  const getThreadActions = useCallback((conversationId: string): ThreadActions => {
    return threadActions.get(conversationId) || {
      isPinned: false,
      isStarred: false,
      isMuted: false,
      isArchived: false
    };
  }, [threadActions]);
  
  // ===== MESSAGE ANALYSIS =====
  const detectMessageMood = useCallback((text: string): MessageMood => {
    return messageEnhancementsService.detectMessageMood(text);
  }, []);
  
  const detectRichContent = useCallback((text: string): RichMessageCard[] => {
    return messageEnhancementsService.detectRichContent(text);
  }, []);
  
  // ===== SMART COMPOSE =====
  const generateSmartSuggestions = useCallback(async (
    partialText: string,
    context: { contactName: string; recentMessages: string[] }
  ) => {
    if (!apiKey || partialText.length < 10) {
      setSmartSuggestions([]);
      return;
    }
    
    setLoadingSuggestions(true);
    try {
      const suggestions = await messageEnhancementsService.generateSmartSuggestions(
        partialText,
        context,
        apiKey
      );
      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      setSmartSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [apiKey]);
  
  // ===== AI COACH =====
  const analyzeMessageForCoaching = useCallback((
    text: string,
    context: { recentMessages: Message[]; contactName: string }
  ) => {
    const suggestions = messageEnhancementsService.analyzeMessageForCoaching(text, context);
    setCoachSuggestions(suggestions);
  }, []);
  
  const dismissCoachSuggestion = useCallback((index: number) => {
    setCoachSuggestions(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // ===== CONVERSATION HEALTH =====
  const calculateConversationHealth = useCallback((thread: Thread) => {
    const health = messageEnhancementsService.analyzeConversationHealth(thread, thread.messages);
    setConversationHealthMap(prev => {
      const newMap = new Map(prev);
      newMap.set(thread.id, health);
      return newMap;
    });
    return health;
  }, []);
  
  const getConversationHealth = useCallback((threadId: string): ConversationHealth | undefined => {
    return conversationHealthMap.get(threadId);
  }, [conversationHealthMap]);
  
  // ===== MESSAGE IMPACT =====
  const calculateMessageImpact = useCallback((
    message: Message,
    thread: Thread
  ) => {
    const impact = messageEnhancementsService.calculateMessageImpact(
      message,
      thread,
      thread.messages
    );
    setMessageImpacts(prev => {
      const newMap = new Map(prev);
      newMap.set(message.id, impact);
      return newMap;
    });
    return impact;
  }, []);
  
  const getMessageImpact = useCallback((messageId: string): MessageImpact | undefined => {
    return messageImpacts.get(messageId);
  }, [messageImpacts]);
  
  // ===== PROACTIVE INSIGHTS =====
  const generateProactiveInsights = useCallback(async (thread: Thread) => {
    if (!apiKey) return;
    
    try {
      const insights = await messageEnhancementsService.generateProactiveInsights(
        thread,
        thread.messages,
        apiKey
      );
      setProactiveInsights(prev => {
        const newMap = new Map(prev);
        newMap.set(thread.id, insights);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
  }, [apiKey]);
  
  const getProactiveInsights = useCallback((threadId: string): ProactiveInsight[] => {
    return proactiveInsights.get(threadId) || [];
  }, [proactiveInsights]);
  
  const dismissInsight = useCallback((threadId: string, index: number) => {
    setProactiveInsights(prev => {
      const newMap = new Map(prev);
      const insights = newMap.get(threadId) || [];
      newMap.set(threadId, insights.filter((_, i) => i !== index));
      return newMap;
    });
  }, []);
  
  // ===== ACHIEVEMENTS =====
  const checkAchievements = useCallback(() => {
    const unlocked = achievementService.checkAchievements();
    if (unlocked.length > 0) {
      setNewAchievements(prev => [...prev, ...unlocked]);
    }
  }, []);
  
  const dismissAchievement = useCallback((achievementId: string) => {
    setNewAchievements(prev => prev.filter(a => a.id !== achievementId));
  }, []);
  
  const trackMessageSent = useCallback(() => {
    const unlocked = achievementService.trackMessageSent();
    if (unlocked.length > 0) {
      setNewAchievements(prev => [...prev, ...unlocked]);
    }
  }, []);
  
  const trackFastResponse = useCallback(() => {
    const unlocked = achievementService.trackFastResponse();
    if (unlocked.length > 0) {
      setNewAchievements(prev => [...prev, ...unlocked]);
    }
  }, []);
  
  const getAllAchievements = useCallback(() => {
    return achievementService.getAllAchievements();
  }, []);
  
  // ===== TRANSLATIONS =====
  const translateMessage = useCallback(async (
    text: string,
    targetLanguage: string
  ): Promise<MessageTranslation> => {
    // This would integrate with a translation API
    // For now, return a placeholder
    return {
      originalText: text,
      translatedText: `[${targetLanguage.toUpperCase()}] ${text}`,
      originalLanguage: 'en',
      targetLanguage,
      confidence: 0.95
    };
  }, []);
  
  // ===== ANALYTICS =====
  const analytics = useMemo(() => {
    return {
      totalThreads: threads.length,
      totalMessages: threads.reduce((sum, t) => sum + t.messages.length, 0),
      threadsWithActions: Array.from(threadActions.values()).filter(a => 
        a.isPinned || a.isStarred
      ).length,
      healthScores: Array.from(conversationHealthMap.values()).map(h => h.score),
      avgHealthScore: Array.from(conversationHealthMap.values()).reduce((sum, h) => sum + h.score, 0) / 
                     Math.max(conversationHealthMap.size, 1)
    };
  }, [threads, threadActions, conversationHealthMap]);
  
  // ===== CLEANUP =====
  useEffect(() => {
    // Update login streak on mount
    achievementService.updateLoginStreak();
  }, []);
  
  return {
    // Thread Actions
    toggleThreadPin,
    toggleThreadStar,
    toggleThreadMute,
    toggleThreadArchive,
    getThreadActions,
    
    // Message Analysis
    detectMessageMood,
    detectRichContent,
    
    // Smart Compose
    smartSuggestions,
    generateSmartSuggestions,
    loadingSuggestions,
    
    // AI Coach
    coachSuggestions,
    analyzeMessageForCoaching,
    dismissCoachSuggestion,
    
    // Conversation Health
    calculateConversationHealth,
    getConversationHealth,
    
    // Message Impact
    calculateMessageImpact,
    getMessageImpact,
    
    // Proactive Insights
    generateProactiveInsights,
    getProactiveInsights,
    dismissInsight,
    
    // Achievements
    newAchievements,
    dismissAchievement,
    trackMessageSent,
    trackFastResponse,
    getAllAchievements,
    checkAchievements,
    
    // Translations
    translateMessage,
    
    // Analytics
    analytics
  };
};
