// ============================================
// LOGOS VISION CRM TYPE DEFINITIONS
// Based on actual Logos Vision CRM schema
// ============================================

// ============= LOGOS VISION MODELS =============

export interface LogosClient {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  location?: string;
  address?: string;
  website?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string; // ID in Logos Vision system
}

export interface LogosTeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
}

export interface LogosProject {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  clientName?: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold' | string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdById?: string;
  teamMemberIds?: string[];
  externalId?: string;
}

export interface LogosTask {
  id: string;
  projectId: string;
  projectName?: string;
  description: string;
  teamMemberId?: string;
  teamMemberName?: string;
  status: 'To Do' | 'In Progress' | 'Done' | string;
  dueDate?: Date;
  completedDate?: Date;
  priority: 'Low' | 'Medium' | 'High' | string;
  phase?: string;
  notes?: string;
  sharedWithClient: boolean;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
}

export interface LogosActivity {
  id: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Note' | string;
  title: string;
  description?: string;
  clientId?: string;
  projectId?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  activityDate: Date;
  durationMinutes?: number;
  location?: string;
  notes?: string;
  sharedWithClient: boolean;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
}

export interface LogosCase {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  clientName?: string;
  assignedToId?: string;
  assignedToName?: string;
  status: 'New' | 'Open' | 'In Progress' | 'Resolved' | 'Closed' | string;
  priority: 'Low' | 'Medium' | 'High' | string;
  category?: string;
  openedDate: Date;
  closedDate?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
}

export interface LogosCaseComment {
  id: string;
  caseId: string;
  authorId: string;
  authorName?: string;
  content: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
}

export interface LogosDonation {
  id: string;
  donorName: string;
  clientId?: string;
  amount: number;
  donationDate: Date;
  campaign?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: Date;
  externalId?: string;
}

export interface LogosVolunteer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  skills?: string[];
  availability?: string;
  assignedProjectIds?: string[];
  assignedClientIds?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
}

// ============= INTEGRATION MAPPINGS =============

export interface LogosPulseMapping {
  id: string;
  // Logos Vision side
  logosEntityType: 'client' | 'project' | 'case' | 'task' | 'activity' | 'team_member';
  logosEntityId: string;
  // Pulse side
  pulseEntityType: 'channel' | 'user' | 'message_thread' | 'task' | 'message';
  pulseEntityId: string;
  // Sync metadata
  syncDirection: 'logos_to_pulse' | 'pulse_to_logos' | 'bidirectional';
  lastSyncAt: Date;
  syncStatus: 'synced' | 'pending' | 'error' | 'manual';
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============= SYNC STATUS =============

export interface SyncLog {
  id: string;
  syncType: 'full' | 'incremental' | 'event-driven';
  entityType: string;
  startedAt: Date;
  completedAt?: Date;
  recordsSynced: number;
  recordsFailed: number;
  status: 'in_progress' | 'completed' | 'failed';
  errorMessage?: string;
  details?: Record<string, any>;
}

export interface IntegrationConfig {
  logosVisionDatabaseUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
  syncInterval: number; // milliseconds
  autoSyncEnabled: boolean;
  bidirectionalSync: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  lastSyncedAt?: Date;
}

// ============= PULSE ENTITIES (FOR MAPPING) =============

export interface PulseChannel {
  id: string;
  name: string;
  description?: string;
  linkedLogosProjectId?: string; // Links to Logos project
  linkedLogosClientId?: string; // Links to Logos client
  members: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface PulseMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  linkedLogosEntityId?: string; // Links to Logos activity/case/note
  linkedLogosEntityType?: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PulseTask {
  id: string;
  title: string;
  description?: string;
  channelId: string;
  assignedTo?: string[];
  linkedLogosTaskId?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PulseUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  linkedLogosTeamMemberId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============= SYNC STATISTICS =============

export interface SyncStatistics {
  lastFullSync?: Date;
  lastIncrementalSync?: Date;
  totalRecordsSynced: number;
  projectsSynced: number;
  casesSynced: number;
  tasksSynced: number;
  activitiesSynced: number;
  failedSyncs: number;
  avgSyncDuration: number; // seconds
}
