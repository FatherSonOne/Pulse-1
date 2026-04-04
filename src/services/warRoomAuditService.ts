/**
 * Studio Audit Service
 * Fire-and-forget audit trail for all Studio operations.
 * Each method calls activityService.logActivity asynchronously.
 */

import { activityService } from './activityService';

export const warRoomAudit = {
  sessionCreated(sessionId: string, projectId?: string) {
    activityService.logActivity({
      action_type: 'war_room_session_created',
      description: 'Created Studio session',
      details: { sessionId, projectId },
    }).catch(console.error);
  },

  sessionDeleted(sessionId: string) {
    activityService.logActivity({
      action_type: 'war_room_session_deleted',
      description: 'Deleted Studio session',
      details: { sessionId },
    }).catch(console.error);
  },

  messageSent(sessionId: string, agent: string) {
    activityService.logActivity({
      action_type: 'war_room_message_sent',
      description: 'Sent message in Studio',
      details: { sessionId, agent },
    }).catch(console.error);
  },

  docUploaded(docTitle: string, fileType: string) {
    activityService.logActivity({
      action_type: 'war_room_doc_uploaded',
      description: `Uploaded document: ${docTitle}`,
      details: { docTitle, fileType },
    }).catch(console.error);
  },

  docDeleted(docId: string) {
    activityService.logActivity({
      action_type: 'war_room_doc_deleted',
      description: 'Deleted Studio document',
      details: { docId },
    }).catch(console.error);
  },

  voiceSessionStarted(sessionId: string, agent: string) {
    activityService.logActivity({
      action_type: 'war_room_voice_session_started',
      description: 'Started voice agent session',
      details: { sessionId, agent },
    }).catch(console.error);
  },

  voiceSessionEnded(sessionId: string, duration?: number) {
    activityService.logActivity({
      action_type: 'war_room_voice_session_ended',
      description: 'Ended voice agent session',
      details: { sessionId, duration },
    }).catch(console.error);
  },

  missionLaunched(missionType: string) {
    activityService.logActivity({
      action_type: 'war_room_mission_launched',
      description: `Launched ${missionType} mission`,
      details: { missionType },
    }).catch(console.error);
  },

  decisionRecorded(decision: string) {
    activityService.logActivity({
      action_type: 'war_room_decision_recorded',
      description: 'Recorded decision in Studio',
      details: { decision: decision.substring(0, 100) },
    }).catch(console.error);
  },

  exported(format: string, sessionId: string) {
    activityService.logActivity({
      action_type: 'war_room_export',
      description: `Exported Studio session as ${format}`,
      details: { format, sessionId },
    }).catch(console.error);
  },

  shared(resourceId: string, resourceType: string) {
    activityService.logActivity({
      action_type: 'war_room_share',
      description: `Shared Studio ${resourceType}`,
      details: { resourceId, resourceType },
    }).catch(console.error);
  },
};
