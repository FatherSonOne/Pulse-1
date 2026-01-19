// ============================================
// CRM INTEGRATION TYPE DEFINITIONS
// ============================================

export type CRMPlatform = 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho';

// ============= AUTHENTICATION =============

export interface CRMIntegration {
  id: string;
  platform: CRMPlatform;
  displayName: string;
  apiKey: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  workspaceId: string;
  isActive: boolean;
  syncEnabled: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  lastSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncErrorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMAuthConfig {
  platform: CRMPlatform;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

// ============= CRM DATA MODELS =============

export interface CRMContact {
  id: string;
  crmId: string;
  externalId: string;
  platform: CRMPlatform;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  companyId?: string;
  title?: string;
  lifecycleStage: 'lead' | 'customer' | 'prospect';
  ownerId?: string;
  ownerName?: string;
  pulseUserId?: string;
  customFields: Record<string, any>;
  lastUpdatedAt?: Date;
  syncedAt: Date;
}

export interface CRMCompany {
  id: string;
  crmId: string;
  externalId: string;
  platform: CRMPlatform;
  name: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  ownerId?: string;
  ownerName?: string;
  contactIds: string[];
  customFields: Record<string, any>;
  lastUpdatedAt?: Date;
  syncedAt: Date;
}

export interface CRMDeal {
  id: string;
  crmId: string;
  externalId: string;
  platform: CRMPlatform;
  name: string;
  dealStage: string; // 'Negotiation', 'Proposal', etc.
  dealAmount?: number;
  currency: string;
  closeDate?: Date;
  createdDate?: Date;
  contactIds: string[];
  companyId?: string;
  companyName?: string;
  ownerId?: string;
  ownerName?: string;
  probability?: number; // 0-100
  isClosed: boolean;
  isWon: boolean;
  linkedChatId?: string;
  linkedChannelId?: string;
  customFields: Record<string, any>;
  lastUpdatedAt?: Date;
  syncedAt: Date;
}

// ============= SMART GROUPS =============

export type RuleOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';

export interface SmartRule {
  field: string; // 'deal_stage', 'deal_amount', 'contact_lifecycle', etc.
  operator: RuleOperator;
  value: string | number | boolean | (string | number)[];
}

export interface MembershipRules {
  operator: 'AND' | 'OR';
  rules: SmartRule[];
}

export interface SmartGroup {
  id: string;
  channelId: string;
  channelName: string;
  description?: string;
  crmId: string;
  membershipRules: MembershipRules;
  memberContactIds: string[];
  memberUserIds: string[];
  isActive: boolean;
  autoSyncEnabled: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============= CRM ACTIONS =============

export type CRMActionType = 'create_task' | 'update_deal' | 'log_call' | 'create_contact';

export interface CRMActionPayload {
  fields?: Record<string, any>;
  title?: string;
  description?: string;
  dueDate?: Date;
  notes?: string;
  [key: string]: any;
}

export interface CRMAction {
  id: string;
  actionType: CRMActionType;
  templateName?: string;
  crmId: string;
  targetExternalId?: string;
  actionPayload: CRMActionPayload;
  triggeredByUserId: string;
  triggeredInChatId?: string;
  triggeredByMessageId?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  errorMessage?: string;
  executedAt?: Date;
  createdAt: Date;
}

// ============= SIDEPANEL (Chat-Linked CRM) =============

export interface CRMSidepanel {
  id: string;
  chatId: string;
  userId: string;
  crmId: string;
  linkedRecordType: 'deal' | 'contact' | 'company';
  linkedExternalId: string;
  isOpen: boolean;
  panelPosition: 'left' | 'right';
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMSidepanelData {
  deal?: CRMDeal;
  contact?: CRMContact;
  company?: CRMCompany;
  updatableFields: SidepanelField[];
}

export interface SidepanelField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  currentValue: any;
  options?: Array<{ label: string; value: string }>;
  isEditable: boolean;
}

// ============= SYNC =============

export interface SyncStatus {
  platform: CRMPlatform;
  lastSyncAt?: Date;
  messageCount: number;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  contactsCount: number;
  companiesCount: number;
  dealsCount: number;
}

export interface SyncLog {
  id: string;
  crmId: string;
  syncType: 'full' | 'incremental' | 'webhook';
  contactsSynced: number;
  companiesSynced: number;
  dealsSynced: number;
  status: 'success' | 'partial' | 'failed';
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
}
