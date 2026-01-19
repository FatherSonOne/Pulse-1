/**
 * Calendar AI Service
 * Provides AI-powered calendar features including smart scheduling,
 * meeting prep, conflict resolution, and predictive analytics
 */

import { CalendarEvent, Contact, Task } from '../types';
import { googleCalendarService } from './googleCalendarService';
import { chatWithBot } from './geminiService';

// Helper to get API key from localStorage
const getGeminiApiKey = (): string => {
  return localStorage.getItem('gemini_api_key') || '';
};

// Helper to generate AI content using gemini
const generateAIContent = async (prompt: string): Promise<string> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  const response = await chatWithBot(apiKey, [], prompt, false);
  return response || '';
};

// Types for AI Calendar Features
export interface SchedulingSuggestion {
  date: Date;
  startTime: string;
  endTime: string;
  score: number; // 0-100 confidence score
  reason: string;
  conflicts?: CalendarEvent[];
}

export interface MeetingPrepBriefing {
  eventId: string;
  attendees: AttendeeInsight[];
  suggestedAgenda: string[];
  previousMeetingsSummary?: string;
  relevantEmails?: EmailSummary[];
  relevantDocuments?: DocumentSummary[];
  talkingPoints: string[];
  questionsToAsk: string[];
  contextNotes: string;
  generatedAt: Date;
}

export interface AttendeeInsight {
  email: string;
  name?: string;
  lastInteraction?: Date;
  relationshipScore?: number;
  recentTopics?: string[];
  communicationStyle?: string;
  preferences?: string[];
}

export interface EmailSummary {
  subject: string;
  date: Date;
  snippet: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface DocumentSummary {
  title: string;
  type: string;
  lastModified: Date;
  relevance: number;
}

export interface ConflictResolution {
  conflictingEvents: CalendarEvent[];
  suggestedResolutions: ResolutionOption[];
  priority: 'high' | 'medium' | 'low';
}

export interface ResolutionOption {
  type: 'reschedule' | 'shorten' | 'cancel' | 'delegate' | 'virtual';
  description: string;
  suggestedTime?: Date;
  impact: string;
  confidence: number;
}

export interface FocusTimeBlock {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  type: 'deep_work' | 'creative' | 'admin' | 'planning';
  productivity_score: number;
  protected: boolean;
  suggested: boolean;
}

export interface ProductivityPattern {
  hourlyProductivity: number[]; // 24-hour productivity scores
  bestFocusHours: number[];
  meetingPreferredHours: number[];
  peakEnergyTime: 'morning' | 'afternoon' | 'evening';
  averageFocusDuration: number; // minutes
}

export interface MeetingFollowUp {
  eventId: string;
  actionItems: ActionItem[];
  commitments: Commitment[];
  nextSteps: string[];
  suggestedFollowUpDate?: Date;
  summaryNotes: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Commitment {
  description: string;
  madeBy: string;
  deadline?: Date;
  tracked: boolean;
}

export interface TravelBuffer {
  fromEvent: CalendarEvent;
  toEvent: CalendarEvent;
  estimatedTravelTime: number; // minutes
  suggestedBuffer: number; // minutes
  travelMode: 'driving' | 'transit' | 'walking' | 'flying';
  trafficCondition?: 'light' | 'moderate' | 'heavy';
  recommendation: string;
}

export interface RelationshipInsight {
  contact: Contact;
  lastMeeting?: Date;
  meetingFrequency: number; // meetings per month
  recommendedFrequency: number;
  daysSinceLastContact: number;
  upcomingMilestones: Milestone[];
  suggestedActions: string[];
  relationshipHealth: 'strong' | 'healthy' | 'needs_attention' | 'at_risk';
}

export interface Milestone {
  type: 'birthday' | 'anniversary' | 'work_anniversary' | 'custom';
  date: Date;
  description: string;
  daysUntil: number;
}

export interface MeetingEffectiveness {
  eventId: string;
  score: number; // 0-100
  metrics: {
    duration_appropriateness: number;
    attendance_rate: number;
    action_items_generated: number;
    follow_up_completion: number;
    participant_engagement: number;
  };
  suggestions: string[];
  couldBeEmail: boolean;
  optimalDuration?: number; // suggested minutes
}

export interface RescheduleOption {
  newStart: Date;
  newEnd: Date;
  availabilityScore: number;
  affectedParticipants: string[];
  reason: string;
}

export interface AvailabilityPrediction {
  contact: Contact;
  timeSlot: { start: Date; end: Date };
  probability: number; // 0-100
  basedOn: string[];
  bestTimeToReach: Date;
  preferredMeetingTimes: { day: string; time: string }[];
}

export interface GoalAlignment {
  goal: Goal;
  allocatedTime: number; // minutes this week
  targetTime: number; // minutes target
  percentageOfWeek: number;
  relatedEvents: CalendarEvent[];
  recommendation: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  priority: number;
  targetHoursPerWeek: number;
  color: string;
}

export interface CalendarAnalytics {
  totalMeetingHours: number;
  focusTimeHours: number;
  meetingOverload: boolean;
  timeByCategory: Record<string, number>;
  productivityScore: number;
  recommendations: string[];
}

class CalendarAIService {
  private productivityPatterns: ProductivityPattern | null = null;
  private goals: Goal[] = [];
  private meetingHistory: Map<string, MeetingEffectiveness> = new Map();

  // ============================================
  // 1. SMART SCHEDULING ASSISTANT
  // ============================================

  /**
   * Parse natural language input to create calendar events
   */
  async parseNaturalLanguageEvent(input: string, contacts: Contact[]): Promise<Partial<CalendarEvent> | null> {
    try {
      const prompt = `Parse this natural language event request and extract structured data.

Input: "${input}"

Available contacts for matching names:
${contacts.slice(0, 20).map(c => `- ${c.name} (${c.email})`).join('\n')}

Return a JSON object with these fields (use null for missing fields):
{
  "title": "event title",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "attendees": ["email@example.com"],
  "location": "location or null",
  "type": "event|meet|call|reminder|deadline",
  "allDay": false,
  "description": "any additional context"
}

Today's date is ${new Date().toISOString().split('T')[0]}.
Parse relative dates like "tomorrow", "next Tuesday", "in 2 hours" correctly.

Return ONLY the JSON object, no explanation.`;

      const response = await generateAIContent(prompt);
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());

      // Convert to CalendarEvent format
      const event: Partial<CalendarEvent> = {
        title: parsed.title,
        type: parsed.type || 'event',
        allDay: parsed.allDay || false,
        description: parsed.description,
        location: parsed.location,
        attendees: parsed.attendees || [],
      };

      if (parsed.date) {
        const startStr = parsed.startTime || '09:00';
        const endStr = parsed.endTime || '10:00';
        event.start = new Date(`${parsed.date}T${startStr}:00`);
        event.end = new Date(`${parsed.date}T${endStr}:00`);
      }

      return event;
    } catch (error) {
      console.error('Failed to parse natural language event:', error);
      return null;
    }
  }

  /**
   * Suggest optimal meeting times based on patterns and availability
   */
  async suggestMeetingTimes(
    duration: number, // minutes
    attendeeEmails: string[],
    preferences?: {
      preferredDays?: number[]; // 0-6 (Sun-Sat)
      preferredHours?: number[]; // 0-23
      avoidBackToBack?: boolean;
      prioritizeMornings?: boolean;
    }
  ): Promise<SchedulingSuggestion[]> {
    const suggestions: SchedulingSuggestion[] = [];
    const now = new Date();
    const patterns = await this.getProductivityPatterns();

    // Get next 7 days of events
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      const events = await googleCalendarService.getAllEvents({
        timeMin: now,
        timeMax: endDate,
      });

      // Get free/busy info if available
      let freeBusy: Record<string, { start: Date; end: Date }[]> = {};
      try {
        freeBusy = await googleCalendarService.getFreeBusy(now, endDate, attendeeEmails);
      } catch (e) {
        console.log('Could not get free/busy for attendees');
      }

      // Check each day
      for (let day = 0; day < 7; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() + day);
        date.setHours(0, 0, 0, 0);

        const dayOfWeek = date.getDay();

        // Skip weekends unless specified
        if (!preferences?.preferredDays?.includes(dayOfWeek) && (dayOfWeek === 0 || dayOfWeek === 6)) {
          continue;
        }

        // Check working hours (9am - 5pm)
        const startHour = preferences?.prioritizeMornings ? 9 : 9;
        const endHour = 17;

        for (let hour = startHour; hour < endHour; hour++) {
          if (preferences?.preferredHours && !preferences.preferredHours.includes(hour)) {
            continue;
          }

          const slotStart = new Date(date);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

          // Skip if in the past
          if (slotStart <= now) continue;

          // Check for conflicts
          const conflicts = events.filter(e => {
            const eventStart = new Date(e.start);
            const eventEnd = new Date(e.end);
            return (slotStart < eventEnd && slotEnd > eventStart);
          });

          if (conflicts.length === 0) {
            // Calculate score based on productivity patterns
            let score = 70; // Base score

            // Boost for high productivity hours
            if (patterns.bestFocusHours.includes(hour)) {
              score -= 10; // Penalize using focus time for meetings
            }
            if (patterns.meetingPreferredHours.includes(hour)) {
              score += 15;
            }

            // Boost for morning meetings if preferred
            if (preferences?.prioritizeMornings && hour < 12) {
              score += 10;
            }

            // Check for back-to-back concerns
            if (preferences?.avoidBackToBack) {
              const hasAdjacentMeeting = events.some(e => {
                const eventEnd = new Date(e.end);
                const eventStart = new Date(e.start);
                const bufferBefore = Math.abs(slotStart.getTime() - eventEnd.getTime()) < 30 * 60 * 1000;
                const bufferAfter = Math.abs(slotEnd.getTime() - eventStart.getTime()) < 30 * 60 * 1000;
                return bufferBefore || bufferAfter;
              });
              if (hasAdjacentMeeting) {
                score -= 20;
              }
            }

            const reasons: string[] = [];
            if (patterns.meetingPreferredHours.includes(hour)) {
              reasons.push('Good meeting time based on your patterns');
            }
            if (hour >= 10 && hour <= 11) {
              reasons.push('Prime collaboration hours');
            }
            if (hour >= 14 && hour <= 15) {
              reasons.push('Post-lunch energy window');
            }

            suggestions.push({
              date: slotStart,
              startTime: `${hour.toString().padStart(2, '0')}:00`,
              endTime: slotEnd.toTimeString().slice(0, 5),
              score: Math.max(0, Math.min(100, score)),
              reason: reasons.length > 0 ? reasons.join('. ') : 'Available time slot',
              conflicts: [],
            });
          }
        }
      }

      // Sort by score
      return suggestions.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch (error) {
      console.error('Failed to suggest meeting times:', error);
      return [];
    }
  }

  // ============================================
  // 2. MEETING PREP AI
  // ============================================

  /**
   * Generate comprehensive meeting prep briefing
   */
  async generateMeetingPrep(
    event: CalendarEvent,
    contacts: Contact[],
    recentEmails?: any[],
    previousMeetings?: CalendarEvent[]
  ): Promise<MeetingPrepBriefing> {
    const attendeeInsights: AttendeeInsight[] = [];

    // Build attendee insights
    for (const attendeeEmail of event.attendees || []) {
      const contact = contacts.find(c => c.email === attendeeEmail);
      const insight: AttendeeInsight = {
        email: attendeeEmail,
        name: contact?.name,
      };

      if (contact) {
        // Find last meeting with this contact
        const lastMeeting = previousMeetings?.find(m =>
          m.attendees?.includes(attendeeEmail) && m.start < event.start
        );
        if (lastMeeting) {
          insight.lastInteraction = lastMeeting.start;
        }
      }

      attendeeInsights.push(insight);
    }

    // Generate AI-powered briefing
    const prompt = `Generate a meeting preparation briefing for the following meeting:

Meeting Title: ${event.title}
Date/Time: ${event.start.toLocaleString()}
Duration: ${Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60))} minutes
Location: ${event.location || 'Not specified'}
Description: ${event.description || 'No description'}

Attendees:
${attendeeInsights.map(a => `- ${a.name || a.email}${a.lastInteraction ? ` (last met: ${a.lastInteraction.toLocaleDateString()})` : ''}`).join('\n')}

${recentEmails?.length ? `Recent relevant emails:\n${recentEmails.slice(0, 5).map(e => `- ${e.subject}`).join('\n')}` : ''}

Generate a JSON response with:
{
  "suggestedAgenda": ["agenda item 1", "agenda item 2", ...],
  "talkingPoints": ["point 1", "point 2", ...],
  "questionsToAsk": ["question 1", "question 2", ...],
  "contextNotes": "brief context about the meeting purpose and what to prepare"
}

Return ONLY the JSON object.`;

    try {
      const response = await generateAIContent(prompt);
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());

      return {
        eventId: event.id,
        attendees: attendeeInsights,
        suggestedAgenda: parsed.suggestedAgenda || [],
        talkingPoints: parsed.talkingPoints || [],
        questionsToAsk: parsed.questionsToAsk || [],
        contextNotes: parsed.contextNotes || '',
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate meeting prep:', error);
      return {
        eventId: event.id,
        attendees: attendeeInsights,
        suggestedAgenda: [],
        talkingPoints: ['Review meeting objectives', 'Prepare key updates', 'Note any blockers'],
        questionsToAsk: [],
        contextNotes: 'Unable to generate AI briefing. Please review the meeting details manually.',
        generatedAt: new Date(),
      };
    }
  }

  // ============================================
  // 3. CONFLICT DETECTION & RESOLUTION
  // ============================================

  /**
   * Detect and analyze scheduling conflicts
   */
  async detectConflicts(events: CalendarEvent[]): Promise<ConflictResolution[]> {
    const conflicts: ConflictResolution[] = [];
    const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];

      // Check for overlap
      if (current.end > next.start) {
        const resolutions = await this.generateResolutionOptions(current, next);

        conflicts.push({
          conflictingEvents: [current, next],
          suggestedResolutions: resolutions,
          priority: this.calculateConflictPriority(current, next),
        });
      }
    }

    return conflicts;
  }

  private async generateResolutionOptions(
    event1: CalendarEvent,
    event2: CalendarEvent
  ): Promise<ResolutionOption[]> {
    const options: ResolutionOption[] = [];

    // Option 1: Reschedule the shorter/less important meeting
    const event1Duration = event1.end.getTime() - event1.start.getTime();
    const event2Duration = event2.end.getTime() - event2.start.getTime();
    const shorterEvent = event1Duration <= event2Duration ? event1 : event2;

    // Find next available slot
    const nextSlot = new Date(Math.max(event1.end.getTime(), event2.end.getTime()));
    nextSlot.setMinutes(nextSlot.getMinutes() + 30); // 30 min buffer

    options.push({
      type: 'reschedule',
      description: `Reschedule "${shorterEvent.title}" to a later time`,
      suggestedTime: nextSlot,
      impact: 'Minimal - moves shorter meeting',
      confidence: 85,
    });

    // Option 2: Shorten one meeting
    options.push({
      type: 'shorten',
      description: `Shorten "${event1.title}" to avoid overlap`,
      impact: 'May reduce discussion time',
      confidence: 70,
    });

    // Option 3: Make one virtual
    if (!event1.location?.includes('http') && !event2.location?.includes('http')) {
      options.push({
        type: 'virtual',
        description: `Convert "${shorterEvent.title}" to a virtual meeting for flexibility`,
        impact: 'Allows multitasking if needed',
        confidence: 60,
      });
    }

    return options;
  }

  private calculateConflictPriority(event1: CalendarEvent, event2: CalendarEvent): 'high' | 'medium' | 'low' {
    // High priority if both have multiple attendees
    const attendees1 = event1.attendees?.length || 0;
    const attendees2 = event2.attendees?.length || 0;

    if (attendees1 > 3 && attendees2 > 3) return 'high';
    if (attendees1 > 1 || attendees2 > 1) return 'medium';
    return 'low';
  }

  // ============================================
  // 4. FOCUS TIME OPTIMIZER
  // ============================================

  /**
   * Analyze productivity patterns from calendar history
   */
  async getProductivityPatterns(): Promise<ProductivityPattern> {
    if (this.productivityPatterns) {
      return this.productivityPatterns;
    }

    // Default patterns (would be learned from user behavior over time)
    this.productivityPatterns = {
      hourlyProductivity: [
        20, 20, 20, 20, 20, 20, // 12am-6am: low
        40, 60, 80, 90, 85, 75, // 6am-12pm: rising, peak mid-morning
        60, 70, 80, 75, 65, 50, // 12pm-6pm: post-lunch dip, afternoon recovery
        40, 35, 30, 25, 20, 20  // 6pm-12am: declining
      ],
      bestFocusHours: [9, 10, 11, 14, 15], // Peak focus times
      meetingPreferredHours: [10, 11, 14, 15, 16], // Good for meetings
      peakEnergyTime: 'morning',
      averageFocusDuration: 90, // 90-minute focus blocks
    };

    return this.productivityPatterns;
  }

  /**
   * Suggest focus time blocks for the week
   */
  async suggestFocusBlocks(
    existingEvents: CalendarEvent[],
    tasksToComplete: Task[]
  ): Promise<FocusTimeBlock[]> {
    const patterns = await this.getProductivityPatterns();
    const suggestions: FocusTimeBlock[] = [];
    const now = new Date();

    // Estimate total focus time needed
    const highPriorityTasks = tasksToComplete.filter(t => !t.completed);
    const estimatedHoursNeeded = Math.max(10, highPriorityTasks.length * 2); // 2 hours per task average

    // Find gaps in next 7 days during best focus hours
    for (let day = 0; day < 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);

      if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends

      for (const hour of patterns.bestFocusHours) {
        const blockStart = new Date(date);
        blockStart.setHours(hour, 0, 0, 0);

        if (blockStart <= now) continue;

        const blockEnd = new Date(blockStart);
        blockEnd.setMinutes(blockEnd.getMinutes() + patterns.averageFocusDuration);

        // Check if slot is free
        const hasConflict = existingEvents.some(e => {
          const eventStart = new Date(e.start);
          const eventEnd = new Date(e.end);
          return blockStart < eventEnd && blockEnd > eventStart;
        });

        if (!hasConflict) {
          suggestions.push({
            id: `focus-${date.toISOString()}-${hour}`,
            date: blockStart,
            startTime: `${hour.toString().padStart(2, '0')}:00`,
            endTime: blockEnd.toTimeString().slice(0, 5),
            type: hour < 12 ? 'deep_work' : 'creative',
            productivity_score: patterns.hourlyProductivity[hour],
            protected: false,
            suggested: true,
          });
        }
      }
    }

    // Return top suggestions based on productivity score
    return suggestions
      .sort((a, b) => b.productivity_score - a.productivity_score)
      .slice(0, Math.ceil(estimatedHoursNeeded / 1.5)); // 1.5 hours per block
  }

  // ============================================
  // 5. MEETING FOLLOW-UP AUTOMATION
  // ============================================

  /**
   * Generate follow-up actions from meeting notes
   */
  async generateMeetingFollowUp(
    event: CalendarEvent,
    meetingNotes?: string
  ): Promise<MeetingFollowUp> {
    const prompt = `Analyze this meeting and extract follow-up items:

Meeting: ${event.title}
Date: ${event.start.toLocaleDateString()}
Attendees: ${event.attendees?.join(', ') || 'Not specified'}
${meetingNotes ? `Notes:\n${meetingNotes}` : 'No notes provided - generate generic follow-ups based on meeting title'}

Generate a JSON response:
{
  "actionItems": [
    {"description": "action item", "assignee": "email or name or null", "priority": "high|medium|low"}
  ],
  "commitments": [
    {"description": "what was committed", "madeBy": "person"}
  ],
  "nextSteps": ["step 1", "step 2"],
  "summaryNotes": "brief summary of meeting outcomes",
  "suggestedFollowUpDays": 7
}

Return ONLY JSON.`;

    try {
      const response = await generateAIContent(prompt);
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());

      const followUpDate = new Date(event.start);
      followUpDate.setDate(followUpDate.getDate() + (parsed.suggestedFollowUpDays || 7));

      return {
        eventId: event.id,
        actionItems: (parsed.actionItems || []).map((item: any, i: number) => ({
          id: `action-${event.id}-${i}`,
          description: item.description,
          assignee: item.assignee,
          priority: item.priority || 'medium',
          status: 'pending',
        })),
        commitments: (parsed.commitments || []).map((c: any) => ({
          description: c.description,
          madeBy: c.madeBy,
          tracked: false,
        })),
        nextSteps: parsed.nextSteps || [],
        suggestedFollowUpDate: followUpDate,
        summaryNotes: parsed.summaryNotes || '',
      };
    } catch (error) {
      console.error('Failed to generate follow-up:', error);
      return {
        eventId: event.id,
        actionItems: [],
        commitments: [],
        nextSteps: ['Review meeting outcomes', 'Send summary to attendees'],
        summaryNotes: 'Unable to generate AI follow-up',
      };
    }
  }

  // ============================================
  // 6. TRAVEL & BUFFER INTELLIGENCE
  // ============================================

  /**
   * Analyze travel needs between consecutive meetings
   */
  async analyzeTravelBuffers(events: CalendarEvent[]): Promise<TravelBuffer[]> {
    const buffers: TravelBuffer[] = [];
    const sortedEvents = [...events]
      .filter(e => !e.allDay)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];

      // Skip if same day but too far apart (> 4 hours)
      const gap = next.start.getTime() - current.end.getTime();
      if (gap > 4 * 60 * 60 * 1000 || gap < 0) continue;

      // Check if locations are different and physical
      const currentLocation = current.location || '';
      const nextLocation = next.location || '';

      const isCurrentVirtual = currentLocation.includes('http') || currentLocation.includes('zoom') || currentLocation.includes('meet');
      const isNextVirtual = nextLocation.includes('http') || nextLocation.includes('zoom') || nextLocation.includes('meet');

      if (isCurrentVirtual && isNextVirtual) continue; // Both virtual, no travel
      if (!currentLocation && !nextLocation) continue; // No locations specified

      // Estimate travel time (simplified - would use Maps API in production)
      let estimatedTravel = 30; // Default 30 minutes
      let travelMode: TravelBuffer['travelMode'] = 'driving';

      if (currentLocation.toLowerCase().includes('online') || nextLocation.toLowerCase().includes('online')) {
        estimatedTravel = 5; // Just buffer for context switching
        travelMode = 'walking';
      }

      const gapMinutes = gap / (1000 * 60);
      const needsBuffer = gapMinutes < estimatedTravel + 15;

      if (needsBuffer) {
        buffers.push({
          fromEvent: current,
          toEvent: next,
          estimatedTravelTime: estimatedTravel,
          suggestedBuffer: estimatedTravel + 15,
          travelMode,
          recommendation: gapMinutes < estimatedTravel
            ? `Warning: Only ${Math.round(gapMinutes)} minutes between meetings. Consider rescheduling.`
            : `Tight transition: ${Math.round(gapMinutes)} minutes available for ${estimatedTravel} minute travel.`,
        });
      }
    }

    return buffers;
  }

  // ============================================
  // 7. RELATIONSHIP CALENDAR INSIGHTS
  // ============================================

  /**
   * Analyze relationships and suggest catch-ups
   */
  async analyzeRelationships(
    contacts: Contact[],
    events: CalendarEvent[]
  ): Promise<RelationshipInsight[]> {
    const insights: RelationshipInsight[] = [];
    const now = new Date();

    for (const contact of contacts) {
      // Find meetings with this contact
      const meetingsWithContact = events.filter(e =>
        e.attendees?.includes(contact.email)
      ).sort((a, b) => b.start.getTime() - a.start.getTime());

      const lastMeeting = meetingsWithContact[0];
      const daysSinceLast = lastMeeting
        ? Math.floor((now.getTime() - lastMeeting.start.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Calculate meeting frequency (meetings per month in last 6 months)
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const recentMeetings = meetingsWithContact.filter(m => m.start > sixMonthsAgo);
      const meetingFrequency = recentMeetings.length / 6;

      // Determine recommended frequency based on contact type
      let recommendedFrequency = 1; // Default: monthly
      if (contact.contactType === 'team') recommendedFrequency = 4; // Weekly
      if (contact.contactType === 'client') recommendedFrequency = 2; // Bi-weekly

      // Calculate relationship health
      let health: RelationshipInsight['relationshipHealth'] = 'healthy';
      if (daysSinceLast > 60) health = 'needs_attention';
      if (daysSinceLast > 120) health = 'at_risk';
      if (daysSinceLast < 14 && meetingFrequency >= recommendedFrequency) health = 'strong';

      // Find upcoming milestones
      const milestones: Milestone[] = [];
      if (contact.birthday) {
        const birthday = new Date(contact.birthday);
        birthday.setFullYear(now.getFullYear());
        if (birthday < now) birthday.setFullYear(now.getFullYear() + 1);

        const daysUntil = Math.floor((birthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 30) {
          milestones.push({
            type: 'birthday',
            date: birthday,
            description: `${contact.name}'s birthday`,
            daysUntil,
          });
        }
      }

      // Generate suggestions
      const suggestions: string[] = [];
      if (health === 'at_risk') {
        suggestions.push(`Schedule a catch-up with ${contact.name} - it's been ${daysSinceLast} days`);
      }
      if (health === 'needs_attention') {
        suggestions.push(`Consider reaching out to ${contact.name}`);
      }
      if (milestones.length > 0) {
        suggestions.push(`Remember: ${milestones[0].description} in ${milestones[0].daysUntil} days`);
      }

      insights.push({
        contact,
        lastMeeting: lastMeeting?.start,
        meetingFrequency,
        recommendedFrequency,
        daysSinceLastContact: daysSinceLast,
        upcomingMilestones: milestones,
        suggestedActions: suggestions,
        relationshipHealth: health,
      });
    }

    // Sort by health status and days since last contact
    return insights.sort((a, b) => {
      const healthOrder = { 'at_risk': 0, 'needs_attention': 1, 'healthy': 2, 'strong': 3 };
      if (healthOrder[a.relationshipHealth] !== healthOrder[b.relationshipHealth]) {
        return healthOrder[a.relationshipHealth] - healthOrder[b.relationshipHealth];
      }
      return b.daysSinceLastContact - a.daysSinceLastContact;
    });
  }

  // ============================================
  // 8. MEETING EFFECTIVENESS SCORING
  // ============================================

  /**
   * Score meeting effectiveness
   */
  async scoreMeetingEffectiveness(
    event: CalendarEvent,
    actualAttendees?: number,
    actionItemsCreated?: number,
    followUpCompleted?: boolean
  ): Promise<MeetingEffectiveness> {
    const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60);
    const expectedAttendees = event.attendees?.length || 1;

    // Calculate metrics
    const metrics = {
      duration_appropriateness: this.scoreDuration(duration, event.type || 'meet'),
      attendance_rate: actualAttendees ? (actualAttendees / expectedAttendees) * 100 : 80,
      action_items_generated: Math.min(100, (actionItemsCreated || 0) * 20),
      follow_up_completion: followUpCompleted ? 100 : 50,
      participant_engagement: 70, // Default - would need more data
    };

    const overallScore = Object.values(metrics).reduce((a, b) => a + b, 0) / 5;

    // Determine if meeting could be an email
    const couldBeEmail = duration <= 15 &&
      (event.attendees?.length || 0) <= 2 &&
      !event.title.toLowerCase().includes('brainstorm') &&
      !event.title.toLowerCase().includes('review');

    // Generate suggestions
    const suggestions: string[] = [];
    if (metrics.duration_appropriateness < 70) {
      suggestions.push(`Consider ${duration > 45 ? 'shortening' : 'extending'} this meeting`);
    }
    if (metrics.attendance_rate < 80) {
      suggestions.push('Low attendance - consider better timing or async alternatives');
    }
    if (metrics.action_items_generated < 40) {
      suggestions.push('Few action items - ensure meetings have clear outcomes');
    }
    if (couldBeEmail) {
      suggestions.push('This meeting might be more efficient as an email or async update');
    }

    const effectiveness: MeetingEffectiveness = {
      eventId: event.id,
      score: Math.round(overallScore),
      metrics,
      suggestions,
      couldBeEmail,
      optimalDuration: this.getOptimalDuration(event.type || 'meet'),
    };

    this.meetingHistory.set(event.id, effectiveness);
    return effectiveness;
  }

  private scoreDuration(duration: number, type: string): number {
    const optimalDurations: Record<string, number> = {
      'meet': 30,
      'call': 15,
      'event': 60,
      'reminder': 5,
      'deadline': 0,
    };

    const optimal = optimalDurations[type] || 30;
    const diff = Math.abs(duration - optimal);

    if (diff <= 10) return 100;
    if (diff <= 20) return 80;
    if (diff <= 30) return 60;
    return 40;
  }

  private getOptimalDuration(type: string): number {
    const durations: Record<string, number> = {
      'meet': 30,
      'call': 15,
      'event': 45,
      'reminder': 5,
      'deadline': 0,
    };
    return durations[type] || 30;
  }

  // ============================================
  // 9. SMART RESCHEDULING
  // ============================================

  /**
   * Generate smart reschedule options
   */
  async generateRescheduleOptions(
    event: CalendarEvent,
    allEvents: CalendarEvent[]
  ): Promise<RescheduleOption[]> {
    const options: RescheduleOption[] = [];
    const duration = event.end.getTime() - event.start.getTime();
    const now = new Date();

    // Find available slots in the next 7 days
    for (let day = 0; day < 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);

      if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends

      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);

        if (slotStart <= now) continue;
        if (slotStart.getTime() === event.start.getTime()) continue; // Skip current slot

        const slotEnd = new Date(slotStart.getTime() + duration);

        // Check availability
        const conflicts = allEvents.filter(e => {
          if (e.id === event.id) return false;
          const eStart = new Date(e.start);
          const eEnd = new Date(e.end);
          return slotStart < eEnd && slotEnd > eStart;
        });

        if (conflicts.length === 0) {
          // Calculate availability score
          let score = 80;

          // Prefer same day of week
          if (slotStart.getDay() === event.start.getDay()) score += 10;

          // Prefer similar time
          if (Math.abs(slotStart.getHours() - event.start.getHours()) <= 2) score += 5;

          // Penalize far future
          const daysOut = Math.floor((slotStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          score -= daysOut * 2;

          options.push({
            newStart: slotStart,
            newEnd: slotEnd,
            availabilityScore: Math.max(0, Math.min(100, score)),
            affectedParticipants: event.attendees || [],
            reason: this.getRescheduleReason(slotStart, event.start),
          });
        }
      }
    }

    return options.sort((a, b) => b.availabilityScore - a.availabilityScore).slice(0, 5);
  }

  private getRescheduleReason(newTime: Date, oldTime: Date): string {
    const dayDiff = Math.floor((newTime.getTime() - oldTime.getTime()) / (1000 * 60 * 60 * 24));
    const hourDiff = newTime.getHours() - oldTime.getHours();

    if (dayDiff === 0) return 'Same day, different time';
    if (dayDiff === 1) return 'Next day availability';
    if (newTime.getDay() === oldTime.getDay()) return 'Same day of week';
    return `Available in ${dayDiff} days`;
  }

  // ============================================
  // 10. VOICE CALENDAR COMMANDS (VOX INTEGRATION)
  // ============================================

  /**
   * Process voice commands for calendar
   */
  async processVoiceCommand(
    command: string,
    contacts: Contact[],
    events: CalendarEvent[]
  ): Promise<{
    action: string;
    response: string;
    data?: any;
  }> {
    const lowerCommand = command.toLowerCase();

    // "What's my next meeting?"
    if (lowerCommand.includes('next meeting') || lowerCommand.includes('next event')) {
      const now = new Date();
      const upcoming = events
        .filter(e => e.start > now)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

      if (upcoming) {
        const timeUntil = Math.round((upcoming.start.getTime() - now.getTime()) / (1000 * 60));
        return {
          action: 'show_event',
          response: `Your next meeting is "${upcoming.title}" in ${timeUntil} minutes at ${upcoming.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          data: upcoming,
        };
      }
      return {
        action: 'none',
        response: 'You have no upcoming meetings scheduled.',
      };
    }

    // "When is [name] free?"
    const freeMatch = lowerCommand.match(/when is (\w+) free/);
    if (freeMatch) {
      const name = freeMatch[1];
      const contact = contacts.find(c => c.name.toLowerCase().includes(name.toLowerCase()));

      if (contact) {
        const prediction = await this.predictAvailability(contact, events);
        return {
          action: 'show_availability',
          response: `Based on patterns, ${contact.name} is typically available ${prediction.preferredMeetingTimes.map(t => `${t.day} ${t.time}`).join(' or ')}.`,
          data: prediction,
        };
      }
      return {
        action: 'none',
        response: `I couldn't find a contact named ${name}.`,
      };
    }

    // "Schedule/reschedule [event] to [time]"
    if (lowerCommand.includes('schedule') || lowerCommand.includes('reschedule')) {
      const parsed = await this.parseNaturalLanguageEvent(command, contacts);
      if (parsed) {
        return {
          action: 'create_event',
          response: `I'll schedule "${parsed.title}" for ${parsed.start?.toLocaleString()}.`,
          data: parsed,
        };
      }
    }

    // "What's on my calendar today/tomorrow/this week?"
    if (lowerCommand.includes('today') || lowerCommand.includes('tomorrow') || lowerCommand.includes('this week')) {
      const now = new Date();
      let start = new Date(now);
      let end = new Date(now);
      let period = 'today';

      if (lowerCommand.includes('tomorrow')) {
        start.setDate(start.getDate() + 1);
        end.setDate(end.getDate() + 1);
        period = 'tomorrow';
      } else if (lowerCommand.includes('this week')) {
        end.setDate(end.getDate() + 7);
        period = 'this week';
      }

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const dayEvents = events.filter(e => e.start >= start && e.start <= end);

      if (dayEvents.length === 0) {
        return {
          action: 'show_events',
          response: `You have no events scheduled ${period}.`,
          data: [],
        };
      }

      return {
        action: 'show_events',
        response: `You have ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''} ${period}: ${dayEvents.map(e => e.title).join(', ')}.`,
        data: dayEvents,
      };
    }

    // Default: try to parse as event creation
    const parsed = await this.parseNaturalLanguageEvent(command, contacts);
    if (parsed && parsed.title) {
      return {
        action: 'create_event',
        response: `Should I create an event: "${parsed.title}"?`,
        data: parsed,
      };
    }

    return {
      action: 'unknown',
      response: "I didn't understand that calendar command. Try 'What's my next meeting?' or 'Schedule a call with [name] tomorrow at 2pm'.",
    };
  }

  // ============================================
  // 11. PREDICTIVE AVAILABILITY
  // ============================================

  /**
   * Predict when a contact is likely to be available
   */
  async predictAvailability(
    contact: Contact,
    historicalEvents: CalendarEvent[]
  ): Promise<AvailabilityPrediction> {
    // Analyze past meetings with this contact
    const meetingsWithContact = historicalEvents.filter(e =>
      e.attendees?.includes(contact.email)
    );

    // Find patterns in meeting times
    const timePatterns: Record<string, number> = {};
    const dayPatterns: Record<number, number> = {};

    meetingsWithContact.forEach(meeting => {
      const hour = meeting.start.getHours();
      const day = meeting.start.getDay();

      const timeKey = `${hour}:00`;
      timePatterns[timeKey] = (timePatterns[timeKey] || 0) + 1;
      dayPatterns[day] = (dayPatterns[day] || 0) + 1;
    });

    // Find preferred times
    const preferredTimes = Object.entries(timePatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([time]) => time);

    const preferredDays = Object.entries(dayPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)]);

    // Calculate best time to reach
    const now = new Date();
    const bestTime = new Date(now);

    if (preferredTimes.length > 0) {
      const [hour] = preferredTimes[0].split(':').map(Number);
      bestTime.setHours(hour, 0, 0, 0);
      if (bestTime <= now) {
        bestTime.setDate(bestTime.getDate() + 1);
      }
    }

    // Calculate probability based on pattern strength
    const totalMeetings = meetingsWithContact.length;
    const probability = totalMeetings > 10 ? 85 : totalMeetings > 5 ? 70 : 55;

    return {
      contact,
      timeSlot: { start: bestTime, end: new Date(bestTime.getTime() + 60 * 60 * 1000) },
      probability,
      basedOn: [`${totalMeetings} previous meetings`, 'Time pattern analysis'],
      bestTimeToReach: bestTime,
      preferredMeetingTimes: preferredDays.slice(0, 2).map((day, i) => ({
        day,
        time: preferredTimes[i] || '10:00',
      })),
    };
  }

  // ============================================
  // 12. GOAL-ALIGNED SCHEDULING
  // ============================================

  /**
   * Set goals for time allocation tracking
   */
  setGoals(goals: Goal[]): void {
    this.goals = goals;
  }

  /**
   * Analyze how calendar aligns with goals
   */
  async analyzeGoalAlignment(
    events: CalendarEvent[],
    weekStart?: Date
  ): Promise<GoalAlignment[]> {
    const start = weekStart || this.getWeekStart(new Date());
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    const weekEvents = events.filter(e => e.start >= start && e.start < end);
    const totalMinutes = 40 * 60; // 40-hour work week

    const alignments: GoalAlignment[] = [];

    for (const goal of this.goals) {
      // Find events related to this goal (by keyword matching or category)
      const relatedEvents = weekEvents.filter(e => {
        const titleLower = e.title.toLowerCase();
        const goalLower = goal.title.toLowerCase();
        const categoryLower = goal.category.toLowerCase();

        return titleLower.includes(goalLower) ||
               titleLower.includes(categoryLower) ||
               (e.description?.toLowerCase().includes(goalLower));
      });

      // Calculate time allocated
      const allocatedMinutes = relatedEvents.reduce((sum, e) => {
        return sum + (e.end.getTime() - e.start.getTime()) / (1000 * 60);
      }, 0);

      const targetMinutes = goal.targetHoursPerWeek * 60;
      const percentageOfWeek = (allocatedMinutes / totalMinutes) * 100;

      // Generate recommendation
      let recommendation = '';
      if (allocatedMinutes < targetMinutes * 0.5) {
        recommendation = `Significantly under-allocated. Schedule ${Math.round((targetMinutes - allocatedMinutes) / 60)} more hours this week.`;
      } else if (allocatedMinutes < targetMinutes * 0.8) {
        recommendation = `Slightly under target. Consider adding ${Math.round((targetMinutes - allocatedMinutes) / 60)} more hours.`;
      } else if (allocatedMinutes > targetMinutes * 1.2) {
        recommendation = `Over-allocated by ${Math.round((allocatedMinutes - targetMinutes) / 60)} hours. Review if this aligns with priorities.`;
      } else {
        recommendation = 'On track with your goal allocation.';
      }

      alignments.push({
        goal,
        allocatedTime: allocatedMinutes,
        targetTime: targetMinutes,
        percentageOfWeek,
        relatedEvents,
        recommendation,
      });
    }

    return alignments.sort((a, b) => a.goal.priority - b.goal.priority);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ============================================
  // ANALYTICS & DASHBOARD
  // ============================================

  /**
   * Generate comprehensive calendar analytics
   */
  async generateAnalytics(
    events: CalendarEvent[],
    period: 'week' | 'month' = 'week'
  ): Promise<CalendarAnalytics> {
    const now = new Date();
    let start: Date;

    if (period === 'week') {
      start = this.getWeekStart(now);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const periodEvents = events.filter(e => e.start >= start && e.start <= now);

    // Calculate meeting hours
    const meetingMinutes = periodEvents
      .filter(e => e.type === 'meet' || e.type === 'call')
      .reduce((sum, e) => sum + (e.end.getTime() - e.start.getTime()) / (1000 * 60), 0);

    // Estimate focus time (non-meeting hours during work hours)
    const workDays = this.countWorkDays(start, now);
    const totalWorkMinutes = workDays * 8 * 60;
    const focusMinutes = totalWorkMinutes - meetingMinutes;

    // Categorize time
    const timeByCategory: Record<string, number> = {};
    periodEvents.forEach(e => {
      const type = e.type || 'event';
      timeByCategory[type] = (timeByCategory[type] || 0) +
        (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60);
    });

    // Calculate productivity score
    const meetingOverload = meetingMinutes > totalWorkMinutes * 0.5;
    const productivityScore = Math.max(0, Math.min(100,
      100 - (meetingMinutes / totalWorkMinutes) * 50 + // Penalize too many meetings
      (focusMinutes > totalWorkMinutes * 0.4 ? 20 : 0) // Bonus for good focus time
    ));

    // Generate recommendations
    const recommendations: string[] = [];
    if (meetingOverload) {
      recommendations.push('Consider reducing meeting load - over 50% of your time is in meetings');
    }
    if (focusMinutes < totalWorkMinutes * 0.3) {
      recommendations.push('Schedule more focus time blocks to improve deep work');
    }
    if (Object.keys(timeByCategory).length > 5) {
      recommendations.push('High task variety - consider batching similar activities');
    }

    return {
      totalMeetingHours: Math.round(meetingMinutes / 60 * 10) / 10,
      focusTimeHours: Math.round(focusMinutes / 60 * 10) / 10,
      meetingOverload,
      timeByCategory,
      productivityScore: Math.round(productivityScore),
      recommendations,
    };
  }

  private countWorkDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }

    return count;
  }
}

// Export singleton instance
export const calendarAIService = new CalendarAIService();
