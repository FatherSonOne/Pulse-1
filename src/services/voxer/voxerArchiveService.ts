// Voxer Archive Service - Save Voxer conversations to Pulse Archives
// Handles conversion of voice messages to structured archive items

import { VoxSelectionItem } from '../../hooks/useVoxSelection';
import { saveArchiveItem } from '../dbService';

/**
 * Format duration from seconds to readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Archive a Voxer conversation to Pulse Archives
 *
 * @param items - Array of voice messages to archive
 * @param contactName - Name of the contact for the conversation
 * @returns Promise that resolves when archive is saved
 */
export async function archiveVoxerConversation(
  items: VoxSelectionItem[],
  contactName: string = 'Unknown Contact'
): Promise<void> {
  if (items.length === 0) {
    throw new Error('No items to archive');
  }

  // Sort items chronologically
  const sortedItems = [...items].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Build transcript document with timestamps and speakers
  const transcriptLines = sortedItems.map((item, i) => {
    const time = new Date(item.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const sender = item.sender === 'me'
      ? 'You'
      : (item.senderName || item.contactName || contactName);
    const duration = formatDuration(item.duration);
    const transcript = item.transcript || item.transcription || '[No transcription available]';

    return `[${time}] ${sender} (${duration}):\n${transcript}`;
  });

  const fullTranscript = transcriptLines.join('\n\n---\n\n');

  // Calculate total duration
  const totalDuration = sortedItems.reduce((sum, item) => sum + (item.duration || 0), 0);

  // Determine mode for tagging
  const modes = new Set(sortedItems.map(item => item.mode));
  const primaryMode = sortedItems[0].mode;

  // Build tags
  const tags = [
    'voxer',
    'conversation',
    'archived',
    primaryMode,
  ];

  // Add mode-specific tags if multiple modes used
  if (modes.size > 1) {
    tags.push('multi-mode');
  }

  // Get contact ID (prefer first item with contactId)
  const relatedContactId = sortedItems.find(item => item.contactId)?.contactId;

  // Save to Pulse Archives
  await saveArchiveItem({
    type: 'vox_transcript',
    title: `Vox Conversation with ${contactName} — ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`,
    content: fullTranscript,
    tags,
    relatedContactId,
    metadata: {
      // Message count and duration
      messageCount: items.length,
      totalDuration,
      totalDurationFormatted: formatDuration(totalDuration),

      // Participants
      participants: ['You', contactName],

      // Archive metadata
      archivedAt: new Date().toISOString(),
      archiveSource: 'voxer',

      // Modes used
      modesUsed: Array.from(modes),
      primaryMode,

      // Audio URLs for future playback from archive (if needed)
      audioUrls: sortedItems.map(item => ({
        id: item.id,
        url: item.url,
        type: item.type,
        sender: item.sender,
        senderName: item.senderName || item.contactName,
        timestamp: item.timestamp.toISOString(),
        duration: item.duration,
        mode: item.mode,
      })),

      // Statistics
      averageMessageDuration: totalDuration / items.length,
      dateRange: {
        start: sortedItems[0].timestamp.toISOString(),
        end: sortedItems[sortedItems.length - 1].timestamp.toISOString(),
      },
    },
  });
}

/**
 * Archive a single Voxer message to Pulse Archives
 * Useful for quick "save this message" actions
 */
export async function archiveSingleVoxMessage(
  item: VoxSelectionItem,
  contactName: string = 'Unknown Contact'
): Promise<void> {
  const time = new Date(item.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const sender = item.sender === 'me'
    ? 'You'
    : (item.senderName || item.contactName || contactName);
  const duration = formatDuration(item.duration);
  const transcript = item.transcript || item.transcription || '[No transcription available]';

  const content = `[${time}] ${sender} (${duration}):\n${transcript}`;

  await saveArchiveItem({
    type: 'vox_transcript',
    title: `Vox Message from ${sender} — ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`,
    content,
    tags: ['voxer', 'message', 'archived', item.mode],
    relatedContactId: item.contactId,
    metadata: {
      messageCount: 1,
      totalDuration: item.duration,
      totalDurationFormatted: formatDuration(item.duration),
      participants: ['You', contactName],
      archivedAt: new Date().toISOString(),
      archiveSource: 'voxer',
      modesUsed: [item.mode],
      primaryMode: item.mode,
      audioUrls: [{
        id: item.id,
        url: item.url,
        type: item.type,
        sender: item.sender,
        senderName: item.senderName || item.contactName,
        timestamp: item.timestamp.toISOString(),
        duration: item.duration,
        mode: item.mode,
      }],
    },
  });
}
