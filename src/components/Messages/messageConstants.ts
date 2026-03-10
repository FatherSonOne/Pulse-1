// Shared constants for Messages components

export const REACTION_CATEGORIES = {
  'Frequently Used': ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '🙏'],
  'Smileys': ['😀', '😊', '😄', '🤔', '😎', '🥳', '😍', '🤩'],
  'Gestures': ['👏', '🙌', '✌️', '🤝', '💪', '👊', '🫡', '✅'],
  'Objects': ['💡', '📌', '⚡', '🚀', '💯', '🎯', '⭐', '💎'],
};

// Smart message templates - these are base templates that get personalized
export const MESSAGE_TEMPLATES = [
  { id: 'ack', label: 'Acknowledge', baseText: 'Got it, thanks!', contextKey: 'acknowledge' },
  { id: 'looking', label: 'Looking into it', baseText: "I'll look into this and get back to you shortly.", contextKey: 'investigate' },
  { id: 'meeting', label: 'Schedule meeting', baseText: "Let's schedule a quick call to discuss. What times work for you?", contextKey: 'meeting' },
  { id: 'followup', label: 'Follow up', baseText: "Just following up on this. Any updates?", contextKey: 'followup' },
  { id: 'thanks', label: 'Thank you', baseText: 'Thanks for the update!', contextKey: 'thanks' },
  { id: 'approve', label: 'Approve', baseText: 'Looks good to me. Approved! ✅', contextKey: 'approve' },
  { id: 'delay', label: 'Need more time', baseText: "I'll need a bit more time on this. Can we extend the deadline?", contextKey: 'delay' },
  { id: 'delegate', label: 'Delegate', baseText: "I'm looping in the right person who can help with this.", contextKey: 'delegate' },
];

export const generateSmartTemplateText = (
  templateId: string,
  baseText: string,
  contactName: string,
  lastMessage?: string
): string => {
  const firstName = contactName.split(' ')[0];
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? 'morning' : timeOfDay < 17 ? 'afternoon' : 'evening';

  switch (templateId) {
    case 'ack':
      return lastMessage?.includes('?')
        ? `Got it, ${firstName}! I'll look into that.`
        : `Thanks for letting me know, ${firstName}!`;
    case 'looking':
      return `Hey ${firstName}, I'm looking into this now and will get back to you shortly.`;
    case 'meeting':
      return `Hi ${firstName}! Let's schedule a quick call to discuss. What times work for you this week?`;
    case 'followup':
      return `Hi ${firstName}, just following up on our previous conversation. Any updates on your end?`;
    case 'thanks':
      return lastMessage?.toLowerCase().includes('done') || lastMessage?.toLowerCase().includes('complete')
        ? `Amazing work, ${firstName}! Really appreciate you getting this done.`
        : `Thanks for the update, ${firstName}!`;
    case 'approve':
      return `Looks great, ${firstName}! Approved ✅`;
    case 'delay':
      return `Hey ${firstName}, I'll need a bit more time on this. Would it be possible to extend the deadline?`;
    case 'delegate':
      return `Hi ${firstName}, I'm going to loop in the right person who can better help with this.`;
    default:
      return baseText;
  }
};
