# 🎯 CRM Integration for Personalized Workflows - Complete Implementation Guide

## For Claude Code to Build HubSpot/Salesforce/Pipedrive Integration

**Location**: `F:\pulse`  
**Tech Stack**: React 19, TypeScript, Supabase, Vite  
**Implementation Time**: 6-8 hours with this guide

---

## 📋 FEATURE OVERVIEW

This guide implements **4 interconnected CRM features**:

1. **CRM Sync Service** - Real-time contacts, companies, deals sync
2. **Chat-Linked CRM Sidepanel** - Live CRM data in Pulse chat (update fields directly)
3. **Smart Groups/Channels** - Auto-manage membership by CRM data rules
4. **Message-to-CRM Workflows** - Buttons/templates to create tasks, update deals, log calls

---

# 🚀 PHASE 1: Database Setup (Supabase)

## Step 1: Open Supabase SQL Editor

**Your Tasks:**

1. **Open browser** → Go to `https://supabase.com/dashboard`
2. **Sign in** with your credentials
3. **Click your Pulse project**
4. **Left sidebar** → Click **SQL Editor** icon
5. **Click "+ New Query"** button (top right)

## Step 2: Create CRM Database Schema

**Your Tasks:**

1. **Copy ALL the SQL code below**
2. **Paste it into the SQL Editor window**
3. **Click "Run"** button (bottom right)
4. **Wait for success** message (green notification)

```sql
-- ============================================
-- CRM INTEGRATION SCHEMA
-- ============================================

-- ============= CRM CREDENTIALS =============
CREATE TABLE IF NOT EXISTS crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Platform info
  platform TEXT NOT NULL UNIQUE, -- 'hubspot', 'salesforce', 'pipedrive'
  display_name TEXT NOT NULL,
  
  -- Authentication
  api_key TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Workspace ownership
  workspace_id UUID REFERENCES auth.users(id),
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  sync_enabled BOOLEAN DEFAULT true,
  webhook_url TEXT,
  webhook_secret TEXT,
  
  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'error'
  sync_error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_workspace ON crm_integrations(workspace_id);
CREATE INDEX idx_crm_platform ON crm_integrations(platform);

-- ============= CRM CONTACTS =============
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- External reference
  crm_id UUID REFERENCES crm_integrations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'hubspot', 'salesforce', 'pipedrive'
  
  -- Contact info
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  company_id TEXT,
  
  -- Additional fields
  title TEXT,
  lifecycle_stage TEXT, -- 'lead', 'customer', 'prospect'
  owner_id TEXT,
  owner_name TEXT,
  
  -- Association
  pulse_user_id UUID REFERENCES auth.users(id),
  
  -- Metadata
  custom_fields JSONB DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_crm_contact_external ON crm_contacts(crm_id, external_id);
CREATE INDEX idx_crm_contact_email ON crm_contacts(email);
CREATE INDEX idx_crm_contact_company ON crm_contacts(company_id);
CREATE INDEX idx_crm_contact_pulse_user ON crm_contacts(pulse_user_id);

-- ============= CRM COMPANIES =============
CREATE TABLE IF NOT EXISTS crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- External reference
  crm_id UUID REFERENCES crm_integrations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  
  -- Company info
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  employee_count INTEGER,
  annual_revenue BIGINT,
  
  -- Association
  owner_id TEXT,
  owner_name TEXT,
  
  -- Contact association
  contact_ids TEXT[] DEFAULT ARRAY[]::text[], -- Array of external contact IDs
  
  -- Metadata
  custom_fields JSONB DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_crm_company_external ON crm_companies(crm_id, external_id);
CREATE INDEX idx_crm_company_name ON crm_companies(name);

-- ============= CRM DEALS =============
CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- External reference
  crm_id UUID REFERENCES crm_integrations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  
  -- Deal info
  name TEXT NOT NULL,
  deal_stage TEXT NOT NULL, -- e.g., 'Qualification', 'Proposal', 'Negotiation', 'Closed'
  deal_amount DECIMAL(15, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Timeline
  close_date DATE,
  created_date DATE,
  
  -- Associations
  contact_ids TEXT[] DEFAULT ARRAY[]::text[],
  company_id TEXT,
  company_name TEXT,
  owner_id TEXT,
  owner_name TEXT,
  
  -- Status
  probability DECIMAL(5, 2), -- 0-100
  is_closed BOOLEAN DEFAULT false,
  is_won BOOLEAN DEFAULT false,
  
  -- Pulse integration
  linked_chat_id UUID REFERENCES auth.users(id),
  linked_channel_id TEXT,
  
  -- Metadata
  custom_fields JSONB DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_crm_deal_external ON crm_deals(crm_id, external_id);
CREATE INDEX idx_crm_deal_stage ON crm_deals(deal_stage);
CREATE INDEX idx_crm_deal_owner ON crm_deals(owner_id);
CREATE INDEX idx_crm_deal_company ON crm_deals(company_id);
CREATE INDEX idx_crm_deal_linked_chat ON crm_deals(linked_chat_id);

-- ============= SMART GROUPS (Auto-Managed Channels) =============
CREATE TABLE IF NOT EXISTS smart_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Group info
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  description TEXT,
  
  -- CRM integration
  crm_id UUID REFERENCES crm_integrations(id) ON DELETE CASCADE,
  
  -- Membership rules
  membership_rules JSONB NOT NULL, -- Rule engine config
  -- Example: {
  --   "operator": "AND",
  --   "rules": [
  --     { "field": "deal_stage", "operator": "eq", "value": "Negotiation" },
  --     { "field": "deal_amount", "operator": "gte", "value": 50000 }
  --   ]
  -- }
  
  -- Membership tracking
  member_contact_ids TEXT[] DEFAULT ARRAY[]::text[],
  member_user_ids UUID[] DEFAULT ARRAY[]::uuid[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  auto_sync_enabled BOOLEAN DEFAULT true,
  
  -- Metadata
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_smart_group_channel ON smart_groups(channel_id);
CREATE INDEX idx_smart_group_crm ON smart_groups(crm_id);

-- ============= CRM ACTIONS (Message → CRM Workflow) =============
CREATE TABLE IF NOT EXISTS crm_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Action info
  action_type TEXT NOT NULL, -- 'create_task', 'update_deal', 'log_call', 'create_contact'
  template_name TEXT,
  
  -- CRM target
  crm_id UUID REFERENCES crm_integrations(id) ON DELETE CASCADE,
  target_external_id TEXT, -- Deal ID, Contact ID, etc.
  
  -- Action payload
  action_payload JSONB NOT NULL,
  -- Example for "update_deal": {
  --   "fields": {
  --     "stage": "Proposal",
  --     "close_date": "2025-01-15"
  --   }
  -- }
  
  -- Trigger info
  triggered_by_user_id UUID REFERENCES auth.users(id),
  triggered_in_chat_id TEXT,
  triggered_by_message_id TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'executing', 'completed', 'failed'
  error_message TEXT,
  
  -- Timeline
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_action_type ON crm_actions(action_type);
CREATE INDEX idx_crm_action_crm ON crm_actions(crm_id);
CREATE INDEX idx_crm_action_status ON crm_actions(status);

-- ============= CRM SYNC LOG =============
CREATE TABLE IF NOT EXISTS crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  crm_id UUID REFERENCES crm_integrations(id) ON DELETE CASCADE,
  
  -- Sync type
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'webhook'
  
  -- Records synced
  contacts_synced INTEGER DEFAULT 0,
  companies_synced INTEGER DEFAULT 0,
  deals_synced INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL, -- 'success', 'partial', 'failed'
  error_message TEXT,
  
  -- Duration
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

CREATE INDEX idx_sync_log_crm ON crm_sync_logs(crm_id);
CREATE INDEX idx_sync_log_started ON crm_sync_logs(started_at);

-- ============= CRMSIDEPANEL (Chat Linked CRM) =============
CREATE TABLE IF NOT EXISTS crm_sidepanels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chat context
  chat_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- CRM record
  crm_id UUID REFERENCES crm_integrations(id),
  linked_record_type TEXT NOT NULL, -- 'deal', 'contact', 'company'
  linked_external_id TEXT NOT NULL,
  
  -- Display state
  is_open BOOLEAN DEFAULT true,
  panel_position TEXT DEFAULT 'right', -- 'left', 'right'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sidepanel_chat ON crm_sidepanels(chat_id);
CREATE INDEX idx_sidepanel_user ON crm_sidepanels(user_id);
CREATE INDEX idx_sidepanel_crm ON crm_sidepanels(crm_id);

-- ============= ROW LEVEL SECURITY =============

ALTER TABLE crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sidepanels ENABLE ROW LEVEL SECURITY;

-- Workspace admins can manage CRM integrations
CREATE POLICY "admins_manage_crm" ON crm_integrations
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Users can view CRM data for their workspace
CREATE POLICY "users_view_crm_contacts" ON crm_contacts
  FOR SELECT USING (true);

CREATE POLICY "users_view_crm_companies" ON crm_companies
  FOR SELECT USING (true);

CREATE POLICY "users_view_crm_deals" ON crm_deals
  FOR SELECT USING (true);

-- Users can create actions
CREATE POLICY "users_create_crm_actions" ON crm_actions
  FOR INSERT WITH CHECK (auth.uid() = triggered_by_user_id);

CREATE POLICY "users_view_own_sidepanels" ON crm_sidepanels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_manage_own_sidepanels" ON crm_sidepanels
  FOR ALL USING (auth.uid() = user_id);
```

**Verify Success:**
- You should see: ✅ **"Success. No rows returned"** (green banner)
- If error → copy and share the error message

---

# 📦 PHASE 2: Install Dependencies

## Step 3: Open PowerShell as Administrator

**Your Tasks:**

1. **Click Windows Start Menu** (bottom left)
2. **Type**: `PowerShell`
3. **Right-click** → **"Run as Administrator"**
4. **Click "Yes"** when prompted

## Step 4: Navigate to Project

**Your Tasks:**

1. **In PowerShell, type exactly:**
```powershell
cd F:\pulse
```

2. **Press Enter**

## Step 5: Install CRM SDK Packages

**Your Tasks:**

1. **Copy this command exactly:**
```powershell
npm install axios @hubspot/api-client hubspot pipedrive jsforce
```

2. **Paste into PowerShell** (right-click to paste)
3. **Press Enter**
4. **Wait 2-3 minutes** for completion
5. **Look for**: `added X packages` message

---

# 🏗️ PHASE 3: Create Type Definitions

## Step 6: Open VS Code

**Your Tasks:**

1. **In PowerShell, type:**
```powershell
code .
```

2. **Press Enter** (VS Code opens with your project)

## Step 7: Create CRM Types File

**Your Tasks:**

1. **In VS Code left sidebar**, **right-click `src/types`** folder
2. **Click "New File"**
3. **Type**: `crmTypes.ts`
4. **Press Enter**
5. **Copy ALL code below** and **paste into file**:

```typescript
// ============================================
// CRM INTEGRATION TYPE DEFINITIONS
// ============================================

export type CRMPlatform = 'hubspot' | 'salesforce' | 'pipedrive';

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
```

6. **Save file**: Press `Ctrl + S`

---

# 🔌 PHASE 4: Create CRM Service Layer

## Step 8: Create Base CRM Service

**Your Tasks:**

1. **Right-click `src/services/`** → **New File**
2. **Type**: `crmService.ts`
3. **Press Enter**
4. **Copy ALL code below** and **paste**:

```typescript
// ============================================
// BASE CRM SERVICE (Platform-Agnostic)
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';
import {
  CRMIntegration,
  CRMContact,
  CRMCompany,
  CRMDeal,
  CRMPlatform,
  SyncStatus,
  SyncLog,
} from '../types/crmTypes';

/**
 * Base CRM Service
 * Provides unified interface for all CRM platforms
 */
export class CRMService {
  private supabase: SupabaseClient;
  private httpClient: AxiosInstance;
  private integrations: Map<string, CRMIntegration> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  // ==================== INTEGRATION SETUP ====================

  /**
   * Create CRM integration
   */
  async createIntegration(
    platform: CRMPlatform,
    displayName: string,
    apiKey: string,
    workspaceId: string
  ): Promise<CRMIntegration> {
    const integrationData = {
      platform,
      display_name: displayName,
      api_key: apiKey,
      workspace_id: workspaceId,
      is_active: true,
      sync_enabled: true,
      sync_status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('crm_integrations')
      .insert(integrationData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create integration: ${error.message}`);

    const integration = this.mapToCRMIntegration(data);
    this.integrations.set(integration.id, integration);
    return integration;
  }

  /**
   * Get integration by platform
   */
  async getIntegration(platform: CRMPlatform): Promise<CRMIntegration | null> {
    const { data, error } = await this.supabase
      .from('crm_integrations')
      .select('*')
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch integration: ${error.message}`);
    }

    return data ? this.mapToCRMIntegration(data) : null;
  }

  /**
   * Update integration token
   */
  async updateToken(
    integrationId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<void> {
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const { error } = await this.supabase
      .from('crm_integrations')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    if (error) throw new Error(`Failed to update token: ${error.message}`);
  }

  // ==================== SYNC OPERATIONS ====================

  /**
   * Full sync from CRM (all contacts, companies, deals)
   */
  async fullSync(crmId: string): Promise<SyncLog> {
    const integration = await this.getIntegrationById(crmId);
    if (!integration) throw new Error('Integration not found');

    const startedAt = new Date();
    let contactsSynced = 0;
    let companiesSynced = 0;
    let dealsSynced = 0;
    let status: 'success' | 'partial' | 'failed' = 'success';
    let errorMessage: string | undefined;

    try {
      // Update sync status
      await this.updateSyncStatus(crmId, 'syncing');

      // Platform-specific sync logic
      const syncResult = await this.syncByPlatform(
        integration.platform,
        integration
      );

      contactsSynced = syncResult.contactsSynced;
      companiesSynced = syncResult.companiesSynced;
      dealsSynced = syncResult.dealsSynced;
    } catch (error) {
      status = 'failed';
      errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
    } finally {
      // Record sync
      const completedAt = new Date();
      const durationSeconds = Math.floor(
        (completedAt.getTime() - startedAt.getTime()) / 1000
      );

      await this.recordSyncLog(crmId, 'full', {
        contactsSynced,
        companiesSynced,
        dealsSynced,
        status,
        errorMessage,
        durationSeconds,
        completedAt,
      });

      // Update final sync status
      await this.updateSyncStatus(
        crmId,
        status === 'success' ? 'idle' : 'error',
        errorMessage
      );

      // Update last sync time
      await this.updateLastSyncTime(crmId);
    }

    return {
      id: `sync-${Date.now()}`,
      crmId,
      syncType: 'full',
      contactsSynced,
      companiesSynced,
      dealsSynced,
      status,
      errorMessage,
      startedAt,
      completedAt: new Date(),
      durationSeconds: Math.floor(
        (new Date().getTime() - startedAt.getTime()) / 1000
      ),
    };
  }

  /**
   * Sync by platform (HubSpot, Salesforce, Pipedrive)
   */
  private async syncByPlatform(
    platform: CRMPlatform,
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    switch (platform) {
      case 'hubspot':
        return await this.syncHubSpot(integration);
      case 'salesforce':
        return await this.syncSalesforce(integration);
      case 'pipedrive':
        return await this.syncPipedrive(integration);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // ==================== HUBSPOT SYNC ====================

  private async syncHubSpot(
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    const baseUrl = 'https://api.hubapi.com';
    const headers = { Authorization: `Bearer ${integration.accessToken}` };

    let contactsSynced = 0;
    let companiesSynced = 0;
    let dealsSynced = 0;

    try {
      // Fetch contacts
      const contactsResponse = await this.httpClient.get(
        `${baseUrl}/crm/v3/objects/contacts`,
        { headers, params: { limit: 100 } }
      );

      for (const contact of contactsResponse.data.results) {
        await this.storeContact(
          integration.id,
          'hubspot',
          {
            externalId: contact.id,
            firstName: contact.properties.firstname?.value,
            lastName: contact.properties.lastname?.value,
            email: contact.properties.email?.value,
            phone: contact.properties.phone?.value,
            lifecycleStage: contact.properties.hs_lead_status?.value || 'lead',
            customFields: contact.properties,
          }
        );
        contactsSynced++;
      }

      // Fetch companies
      const companiesResponse = await this.httpClient.get(
        `${baseUrl}/crm/v3/objects/companies`,
        { headers, params: { limit: 100 } }
      );

      for (const company of companiesResponse.data.results) {
        await this.storeCompany(integration.id, 'hubspot', {
          externalId: company.id,
          name: company.properties.name?.value,
          website: company.properties.website?.value,
          industry: company.properties.industry?.value,
          customFields: company.properties,
        });
        companiesSynced++;
      }

      // Fetch deals
      const dealsResponse = await this.httpClient.get(
        `${baseUrl}/crm/v3/objects/deals`,
        { headers, params: { limit: 100 } }
      );

      for (const deal of dealsResponse.data.results) {
        await this.storeDeal(integration.id, 'hubspot', {
          externalId: deal.id,
          name: deal.properties.dealname?.value,
          dealStage: deal.properties.dealstage?.value || 'negotiation',
          dealAmount: deal.properties.amount?.value,
          probability: deal.properties.probability?.value,
          customFields: deal.properties,
        });
        dealsSynced++;
      }
    } catch (error) {
      throw new Error(
        `HubSpot sync failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    return { contactsSynced, companiesSynced, dealsSynced };
  }

  // ==================== SALESFORCE SYNC ====================

  private async syncSalesforce(
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    // Similar pattern to HubSpot
    // Use Salesforce REST API endpoints
    const contactsSynced = 0;
    const companiesSynced = 0;
    const dealsSynced = 0;

    // TODO: Implement Salesforce-specific sync logic

    return { contactsSynced, companiesSynced, dealsSynced };
  }

  // ==================== PIPEDRIVE SYNC ====================

  private async syncPipedrive(
    integration: CRMIntegration
  ): Promise<{ contactsSynced: number; companiesSynced: number; dealsSynced: number }> {
    // Similar pattern to HubSpot
    // Use Pipedrive REST API endpoints
    const contactsSynced = 0;
    const companiesSynced = 0;
    const dealsSynced = 0;

    // TODO: Implement Pipedrive-specific sync logic

    return { contactsSynced, companiesSynced, dealsSynced };
  }

  // ==================== DATA STORAGE ====================

  /**
   * Store contact in Pulse
   */
  private async storeContact(
    crmId: string,
    platform: CRMPlatform,
    data: Partial<CRMContact>
  ): Promise<void> {
    await this.supabase.from('crm_contacts').upsert(
      {
        crm_id: crmId,
        external_id: data.externalId,
        platform,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        title: data.title,
        lifecycle_stage: data.lifecycleStage || 'lead',
        custom_fields: data.customFields || {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'crm_id, external_id' }
    );
  }

  /**
   * Store company in Pulse
   */
  private async storeCompany(
    crmId: string,
    platform: CRMPlatform,
    data: Partial<CRMCompany>
  ): Promise<void> {
    await this.supabase.from('crm_companies').upsert(
      {
        crm_id: crmId,
        external_id: data.externalId,
        platform,
        name: data.name,
        website: data.website,
        industry: data.industry,
        employee_count: data.employeeCount,
        annual_revenue: data.annualRevenue,
        custom_fields: data.customFields || {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'crm_id, external_id' }
    );
  }

  /**
   * Store deal in Pulse
   */
  private async storeDeal(
    crmId: string,
    platform: CRMPlatform,
    data: Partial<CRMDeal>
  ): Promise<void> {
    await this.supabase.from('crm_deals').upsert(
      {
        crm_id: crmId,
        external_id: data.externalId,
        platform,
        name: data.name,
        deal_stage: data.dealStage || 'negotiation',
        deal_amount: data.dealAmount,
        probability: data.probability,
        is_closed: data.isClosed || false,
        is_won: data.isWon || false,
        custom_fields: data.customFields || {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'crm_id, external_id' }
    );
  }

  // ==================== SYNC UTILITIES ====================

  private async updateSyncStatus(
    crmId: string,
    status: 'idle' | 'syncing' | 'error',
    errorMessage?: string
  ): Promise<void> {
    await this.supabase
      .from('crm_integrations')
      .update({
        sync_status: status,
        sync_error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', crmId);
  }

  private async updateLastSyncTime(crmId: string): Promise<void> {
    await this.supabase
      .from('crm_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', crmId);
  }

  private async recordSyncLog(
    crmId: string,
    syncType: 'full' | 'incremental' | 'webhook',
    log: any
  ): Promise<void> {
    await this.supabase.from('crm_sync_logs').insert({
      crm_id: crmId,
      sync_type: syncType,
      contacts_synced: log.contactsSynced,
      companies_synced: log.companiesSynced,
      deals_synced: log.dealsSynced,
      status: log.status,
      error_message: log.errorMessage,
      completed_at: log.completedAt?.toISOString(),
      duration_seconds: log.durationSeconds,
    });
  }

  private async getIntegrationById(crmId: string): Promise<CRMIntegration | null> {
    const { data, error } = await this.supabase
      .from('crm_integrations')
      .select('*')
      .eq('id', crmId)
      .single();

    if (error) return null;
    return this.mapToCRMIntegration(data);
  }

  private mapToCRMIntegration(data: any): CRMIntegration {
    return {
      id: data.id,
      platform: data.platform,
      displayName: data.display_name,
      apiKey: data.api_key,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: data.token_expires_at
        ? new Date(data.token_expires_at)
        : undefined,
      workspaceId: data.workspace_id,
      isActive: data.is_active,
      syncEnabled: data.sync_enabled,
      webhookUrl: data.webhook_url,
      webhookSecret: data.webhook_secret,
      lastSyncAt: data.last_sync_at
        ? new Date(data.last_sync_at)
        : undefined,
      syncStatus: data.sync_status,
      syncErrorMessage: data.sync_error_message,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const crmService = new CRMService(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);
```

6. **Save**: `Ctrl + S`

---

# 🎯 PHASE 5: Create Smart Groups Service

## Step 9: Create Smart Groups Service

**Your Tasks:**

1. **Right-click `src/services/`** → **New File**
2. **Type**: `smartGroupService.ts`
3. **Press Enter**
4. **Copy ALL code below** and **paste**:

```typescript
// ============================================
// SMART GROUPS SERVICE
// Auto-manage channel membership by CRM rules
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  SmartGroup,
  MembershipRules,
  SmartRule,
  CRMDeal,
  CRMContact,
  CRMCompany,
} from '../types/crmTypes';

/**
 * Smart Groups Service
 * Manages automatic group membership based on CRM data rules
 */
export class SmartGroupService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create smart group (auto-managed channel)
   */
  async createSmartGroup(
    channelId: string,
    channelName: string,
    crmId: string,
    membershipRules: MembershipRules,
    description?: string
  ): Promise<SmartGroup> {
    const groupData = {
      channel_id: channelId,
      channel_name: channelName,
      description,
      crm_id: crmId,
      membership_rules: membershipRules,
      member_contact_ids: [],
      member_user_ids: [],
      is_active: true,
      auto_sync_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('smart_groups')
      .insert(groupData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create smart group: ${error.message}`);

    // Run initial sync
    await this.syncGroupMembership(data.id);

    return this.mapToSmartGroup(data);
  }

  /**
   * Sync group membership based on rules
   * This is called on schedule or when CRM data changes
   */
  async syncGroupMembership(groupId: string): Promise<void> {
    const group = await this.getSmartGroup(groupId);
    if (!group) throw new Error('Smart group not found');

    // Get all deals that match the rules
    const matchingDeals = await this.findMatchingDeals(
      group.crmId,
      group.membershipRules
    );

    // Extract contact IDs from matching deals
    const contactIds: Set<string> = new Set();
    for (const deal of matchingDeals) {
      deal.contactIds.forEach((id) => contactIds.add(id));
    }

    // Get Pulse users for these contacts
    const { data: contacts } = await this.supabase
      .from('crm_contacts')
      .select('pulse_user_id')
      .in('external_id', Array.from(contactIds));

    const userIds = (contacts || [])
      .filter((c) => c.pulse_user_id)
      .map((c) => c.pulse_user_id);

    // Update group membership
    await this.supabase
      .from('smart_groups')
      .update({
        member_contact_ids: Array.from(contactIds),
        member_user_ids: userIds,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    // Trigger channel membership updates (actual channel sync logic here)
    await this.updateChannelMembers(group.channelId, userIds);
  }

  /**
   * Find deals matching membership rules
   */
  private async findMatchingDeals(
    crmId: string,
    rules: MembershipRules
  ): Promise<CRMDeal[]> {
    // Build query based on rules
    let query = this.supabase
      .from('crm_deals')
      .select('*')
      .eq('crm_id', crmId);

    // Apply each rule
    for (const rule of rules.rules) {
      query = this.applyRuleToQuery(query, rule);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch deals: ${error.message}`);

    return (data || []).map((d) => ({
      id: d.id,
      crmId: d.crm_id,
      externalId: d.external_id,
      platform: d.platform,
      name: d.name,
      dealStage: d.deal_stage,
      dealAmount: d.deal_amount,
      currency: d.currency,
      closeDate: d.close_date ? new Date(d.close_date) : undefined,
      createdDate: d.created_date ? new Date(d.created_date) : undefined,
      contactIds: d.contact_ids || [],
      companyId: d.company_id,
      companyName: d.company_name,
      ownerId: d.owner_id,
      ownerName: d.owner_name,
      probability: d.probability,
      isClosed: d.is_closed,
      isWon: d.is_won,
      linkedChatId: d.linked_chat_id,
      linkedChannelId: d.linked_channel_id,
      customFields: d.custom_fields || {},
      lastUpdatedAt: d.last_updated_at
        ? new Date(d.last_updated_at)
        : undefined,
      syncedAt: new Date(d.synced_at),
    }));
  }

  /**
   * Apply a single rule to a query
   * Example: { field: 'deal_stage', operator: 'eq', value: 'Negotiation' }
   */
  private applyRuleToQuery(query: any, rule: SmartRule): any {
    switch (rule.operator) {
      case 'eq':
        return query.eq(this.fieldToColumn(rule.field), rule.value);
      case 'ne':
        return query.neq(this.fieldToColumn(rule.field), rule.value);
      case 'gt':
        return query.gt(this.fieldToColumn(rule.field), rule.value);
      case 'lt':
        return query.lt(this.fieldToColumn(rule.field), rule.value);
      case 'gte':
        return query.gte(this.fieldToColumn(rule.field), rule.value);
      case 'lte':
        return query.lte(this.fieldToColumn(rule.field), rule.value);
      case 'in':
        return query.in(this.fieldToColumn(rule.field), rule.value as string[]);
      case 'contains':
        return query.like(
          this.fieldToColumn(rule.field),
          `%${rule.value}%`
        );
      default:
        return query;
    }
  }

  /**
   * Convert field name to database column name
   */
  private fieldToColumn(field: string): string {
    // Convert camelCase to snake_case
    return field.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Update actual channel membership
   * This would call your Pulse chat API to add/remove members
   */
  private async updateChannelMembers(
    channelId: string,
    userIds: string[]
  ): Promise<void> {
    // TODO: Integrate with Pulse chat API to update channel membership
    console.log(`Updating channel ${channelId} with members:`, userIds);
  }

  /**
   * Get smart group
   */
  async getSmartGroup(groupId: string): Promise<SmartGroup | null> {
    const { data, error } = await this.supabase
      .from('smart_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) return null;
    return this.mapToSmartGroup(data);
  }

  /**
   * List all smart groups for a CRM
   */
  async listSmartGroups(crmId: string): Promise<SmartGroup[]> {
    const { data, error } = await this.supabase
      .from('smart_groups')
      .select('*')
      .eq('crm_id', crmId)
      .eq('is_active', true);

    if (error) throw new Error(`Failed to list smart groups: ${error.message}`);

    return (data || []).map((d) => this.mapToSmartGroup(d));
  }

  /**
   * Update smart group rules
   */
  async updateSmartGroupRules(
    groupId: string,
    rules: MembershipRules
  ): Promise<void> {
    await this.supabase
      .from('smart_groups')
      .update({
        membership_rules: rules,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    // Re-sync membership
    await this.syncGroupMembership(groupId);
  }

  /**
   * Delete smart group
   */
  async deleteSmartGroup(groupId: string): Promise<void> {
    await this.supabase.from('smart_groups').delete().eq('id', groupId);
  }

  private mapToSmartGroup(data: any): SmartGroup {
    return {
      id: data.id,
      channelId: data.channel_id,
      channelName: data.channel_name,
      description: data.description,
      crmId: data.crm_id,
      membershipRules: data.membership_rules,
      memberContactIds: data.member_contact_ids || [],
      memberUserIds: data.member_user_ids || [],
      isActive: data.is_active,
      autoSyncEnabled: data.auto_sync_enabled,
      lastSyncAt: data.last_sync_at
        ? new Date(data.last_sync_at)
        : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const smartGroupService = new SmartGroupService(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);
```

6. **Save**: `Ctrl + S`

---

# 💬 PHASE 6: Create CRM Actions Service

## Step 10: Create CRM Actions Service

**Your Tasks:**

1. **Right-click `src/services/`** → **New File**
2. **Type**: `crmActionsService.ts`
3. **Press Enter**
4. **Copy ALL code below** and **paste**:

```typescript
// ============================================
// CRM ACTIONS SERVICE
// Convert messages to CRM operations
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  CRMAction,
  CRMActionPayload,
  CRMActionType,
  CRMIntegration,
} from '../types/crmTypes';
import { crmService } from './crmService';

/**
 * CRM Actions Service
 * Manages message-to-CRM workflows
 */
export class CRMActionsService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create CRM action (task, update deal, log call, etc.)
   */
  async createAction(
    actionType: CRMActionType,
    crmId: string,
    targetExternalId: string,
    payload: CRMActionPayload,
    triggeredByUserId: string,
    context?: {
      chatId?: string;
      messageId?: string;
      templateName?: string;
    }
  ): Promise<CRMAction> {
    const actionData = {
      id: `action-${uuidv4()}`,
      action_type: actionType,
      template_name: context?.templateName,
      crm_id: crmId,
      target_external_id: targetExternalId,
      action_payload: payload,
      triggered_by_user_id: triggeredByUserId,
      triggered_in_chat_id: context?.chatId,
      triggered_by_message_id: context?.messageId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('crm_actions')
      .insert(actionData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create action: ${error.message}`);

    // Execute the action
    await this.executeAction(data.id);

    return this.mapToCRMAction(data);
  }

  /**
   * Execute CRM action
   */
  async executeAction(actionId: string): Promise<void> {
    // Get action
    const { data: actionData, error: fetchError } = await this.supabase
      .from('crm_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (fetchError) throw new Error('Action not found');

    const action = actionData;

    // Get integration
    const { data: integrationData } = await this.supabase
      .from('crm_integrations')
      .select('*')
      .eq('id', action.crm_id)
      .single();

    if (!integrationData) throw new Error('Integration not found');

    try {
      // Update status
      await this.updateActionStatus(actionId, 'executing');

      // Execute based on action type and platform
      switch (action.action_type) {
        case 'create_task':
          await this.executeCreateTask(integrationData, action);
          break;
        case 'update_deal':
          await this.executeUpdateDeal(integrationData, action);
          break;
        case 'log_call':
          await this.executeLogCall(integrationData, action);
          break;
        case 'create_contact':
          await this.executeCreateContact(integrationData, action);
          break;
      }

      // Mark as completed
      await this.updateActionStatus(actionId, 'completed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.updateActionStatus(actionId, 'failed', errorMessage);
      throw error;
    }
  }

  /**
   * Create task in CRM
   */
  private async executeCreateTask(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;

    switch (integration.platform) {
      case 'hubspot':
        await this.createHubSpotTask(integration, payload);
        break;
      case 'salesforce':
        await this.createSalesforceTask(integration, payload);
        break;
      case 'pipedrive':
        await this.createPipedriveTask(integration, payload);
        break;
    }
  }

  private async createHubSpotTask(integration: any, payload: CRMActionPayload) {
    // HubSpot task creation
    // POST https://api.hubapi.com/crm/v3/objects/tasks
    console.log('Creating HubSpot task:', payload);
    // TODO: Implement HubSpot task creation
  }

  private async createSalesforceTask(integration: any, payload: CRMActionPayload) {
    // Salesforce task creation
    console.log('Creating Salesforce task:', payload);
    // TODO: Implement Salesforce task creation
  }

  private async createPipedriveTask(integration: any, payload: CRMActionPayload) {
    // Pipedrive activity creation
    console.log('Creating Pipedrive task:', payload);
    // TODO: Implement Pipedrive task creation
  }

  /**
   * Update deal in CRM
   */
  private async executeUpdateDeal(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;
    const dealExternalId = action.target_external_id;

    switch (integration.platform) {
      case 'hubspot':
        await this.updateHubSpotDeal(integration, dealExternalId, payload);
        break;
      case 'salesforce':
        await this.updateSalesforceDeal(integration, dealExternalId, payload);
        break;
      case 'pipedrive':
        await this.updatePipedriveDeal(integration, dealExternalId, payload);
        break;
    }

    // Update local cache
    await this.supabase
      .from('crm_deals')
      .update({
        deal_stage: payload.fields?.stage,
        deal_amount: payload.fields?.amount,
        last_updated_at: new Date().toISOString(),
      })
      .eq('external_id', dealExternalId)
      .eq('crm_id', integration.id);
  }

  private async updateHubSpotDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    // PATCH https://api.hubapi.com/crm/v3/objects/deals/{dealId}
    console.log('Updating HubSpot deal:', dealId, payload);
    // TODO: Implement HubSpot deal update
  }

  private async updateSalesforceDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    // PATCH Salesforce opportunity
    console.log('Updating Salesforce deal:', dealId, payload);
    // TODO: Implement Salesforce deal update
  }

  private async updatePipedriveDeal(
    integration: any,
    dealId: string,
    payload: CRMActionPayload
  ) {
    // PUT https://api.pipedrive.com/v1/deals/{dealId}
    console.log('Updating Pipedrive deal:', dealId, payload);
    // TODO: Implement Pipedrive deal update
  }

  /**
   * Log call in CRM
   */
  private async executeLogCall(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;

    switch (integration.platform) {
      case 'hubspot':
        await this.logHubSpotCall(integration, payload);
        break;
      case 'salesforce':
        await this.logSalesforceCall(integration, payload);
        break;
      case 'pipedrive':
        await this.logPipedriveCall(integration, payload);
        break;
    }
  }

  private async logHubSpotCall(integration: any, payload: CRMActionPayload) {
    // Create task with call type in HubSpot
    console.log('Logging HubSpot call:', payload);
    // TODO: Implement HubSpot call logging
  }

  private async logSalesforceCall(integration: any, payload: CRMActionPayload) {
    // Create activity/event in Salesforce
    console.log('Logging Salesforce call:', payload);
    // TODO: Implement Salesforce call logging
  }

  private async logPipedriveCall(integration: any, payload: CRMActionPayload) {
    // Log activity in Pipedrive
    console.log('Logging Pipedrive call:', payload);
    // TODO: Implement Pipedrive call logging
  }

  /**
   * Create contact in CRM
   */
  private async executeCreateContact(
    integration: any,
    action: any
  ): Promise<void> {
    const payload = action.action_payload;

    switch (integration.platform) {
      case 'hubspot':
        await this.createHubSpotContact(integration, payload);
        break;
      case 'salesforce':
        await this.createSalesforceContact(integration, payload);
        break;
      case 'pipedrive':
        await this.createPipedriveContact(integration, payload);
        break;
    }
  }

  private async createHubSpotContact(integration: any, payload: CRMActionPayload) {
    // POST https://api.hubapi.com/crm/v3/objects/contacts
    console.log('Creating HubSpot contact:', payload);
    // TODO: Implement HubSpot contact creation
  }

  private async createSalesforceContact(integration: any, payload: CRMActionPayload) {
    // POST Salesforce Lead
    console.log('Creating Salesforce contact:', payload);
    // TODO: Implement Salesforce contact creation
  }

  private async createPipedriveContact(integration: any, payload: CRMActionPayload) {
    // POST https://api.pipedrive.com/v1/persons
    console.log('Creating Pipedrive contact:', payload);
    // TODO: Implement Pipedrive contact creation
  }

  // ==================== UTILITIES ====================

  /**
   * Get action
   */
  async getAction(actionId: string): Promise<CRMAction | null> {
    const { data, error } = await this.supabase
      .from('crm_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (error) return null;
    return this.mapToCRMAction(data);
  }

  /**
   * List actions by chat
   */
  async listActionsByChat(chatId: string): Promise<CRMAction[]> {
    const { data, error } = await this.supabase
      .from('crm_actions')
      .select('*')
      .eq('triggered_in_chat_id', chatId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list actions: ${error.message}`);

    return (data || []).map((d) => this.mapToCRMAction(d));
  }

  private async updateActionStatus(
    actionId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.executed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await this.supabase
      .from('crm_actions')
      .update(updateData)
      .eq('id', actionId);
  }

  private mapToCRMAction(data: any): CRMAction {
    return {
      id: data.id,
      actionType: data.action_type,
      templateName: data.template_name,
      crmId: data.crm_id,
      targetExternalId: data.target_external_id,
      actionPayload: data.action_payload,
      triggeredByUserId: data.triggered_by_user_id,
      triggeredInChatId: data.triggered_in_chat_id,
      triggeredByMessageId: data.triggered_by_message_id,
      status: data.status,
      errorMessage: data.error_message,
      executedAt: data.executed_at
        ? new Date(data.executed_at)
        : undefined,
      createdAt: new Date(data.created_at),
    };
  }
}

export const crmActionsService = new CRMActionsService(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);
```

6. **Save**: `Ctrl + S`

---

# 🎨 PHASE 7: Create React Components

## Step 11: Create CRM Sidepanel Component

**Your Tasks:**

1. **Right-click `src/components/`** → **New Folder** → Type `crm` → **Enter**
2. **Right-click new `crm` folder** → **New File**
3. **Type**: `CRMSidepanel.tsx`
4. **Press Enter**
5. **Copy ALL code below** and **paste**:

```typescript
// ============================================
// CRM SIDEPANEL COMPONENT
// Shows CRM record data in chat sidebar
// ============================================

import React, { useState, useEffect } from 'react';
import { CRMDeal, CRMSidepanel, SidepanelField } from '../types/crmTypes';
import { crmActionsService } from '../services/crmActionsService';

interface CRMSidepanelProps {
  chatId: string;
  deal?: CRMDeal;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CRM Sidepanel Component
 * Displays CRM record (deal, contact, company) in chat
 * Allows inline field updates
 */
export const CRMSidepanel: React.FC<CRMSidepanelProps> = ({
  chatId,
  deal,
  isOpen,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !deal) return null;

  // Key fields to display and edit
  const keyFields: SidepanelField[] = [
    {
      name: 'dealStage',
      label: 'Deal Stage',
      type: 'select',
      currentValue: deal.dealStage,
      options: [
        { label: 'Qualification', value: 'Qualification' },
        { label: 'Proposal', value: 'Proposal' },
        { label: 'Negotiation', value: 'Negotiation' },
        { label: 'Closed Won', value: 'Closed Won' },
        { label: 'Closed Lost', value: 'Closed Lost' },
      ],
      isEditable: true,
    },
    {
      name: 'dealAmount',
      label: 'Deal Amount',
      type: 'number',
      currentValue: deal.dealAmount,
      isEditable: true,
    },
    {
      name: 'closeDate',
      label: 'Close Date',
      type: 'date',
      currentValue: deal.closeDate?.toISOString().split('T')[^0],
      isEditable: true,
    },
    {
      name: 'ownerName',
      label: 'Deal Owner',
      type: 'text',
      currentValue: deal.ownerName || 'Unassigned',
      isEditable: false,
    },
    {
      name: 'probability',
      label: 'Probability',
      type: 'number',
      currentValue: deal.probability || 0,
      isEditable: true,
    },
  ];

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedFields((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSaveChanges = async () => {
    if (!deal) return;

    setIsLoading(true);
    try {
      // Create CRM action to update deal
      await crmActionsService.createAction(
        'update_deal',
        deal.crmId,
        deal.externalId,
        {
          fields: {
            stage: editedFields.dealStage || deal.dealStage,
            amount: editedFields.dealAmount || deal.dealAmount,
            close_date: editedFields.closeDate || deal.closeDate,
            probability: editedFields.probability || deal.probability,
          },
        },
        '', // Current user ID - get from auth
        { chatId, templateName: 'sidepanel_update' }
      );

      setIsEditing(false);
      setEditedFields({});
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="crm-sidepanel">
      <div className="crm-sidepanel-header">
        <h3>{deal.name}</h3>
        <button
          className="crm-sidepanel-close"
          onClick={onClose}
          aria-label="Close CRM panel"
        >
          ✕
        </button>
      </div>

      <div className="crm-sidepanel-content">
        {/* Deal Info */}
        <section className="crm-section">
          <h4>Deal Information</h4>
          <div className="crm-fields">
            {keyFields.map((field) => (
              <div key={field.name} className="crm-field">
                <label>{field.label}</label>

                {isEditing && field.isEditable ? (
                  <>
                    {field.type === 'select' && (
                      <select
                        value={editedFields[field.name] || field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(field.name, e.target.value)
                        }
                        className="crm-input"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'number' && (
                      <input
                        type="number"
                        value={editedFields[field.name] ?? field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(
                            field.name,
                            parseFloat(e.target.value)
                          )
                        }
                        className="crm-input"
                      />
                    )}

                    {field.type === 'date' && (
                      <input
                        type="date"
                        value={editedFields[field.name] || field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(field.name, e.target.value)
                        }
                        className="crm-input"
                      />
                    )}

                    {field.type === 'text' && (
                      <input
                        type="text"
                        value={editedFields[field.name] ?? field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(field.name, e.target.value)
                        }
                        className="crm-input"
                        disabled={!field.isEditable}
                      />
                    )}
                  </>
                ) : (
                  <div className="crm-value">{field.currentValue}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="crm-section">
          <h4>Quick Actions</h4>
          <div className="crm-actions">
            <button
              className="crm-action-btn"
              onClick={() =>
                crmActionsService.createAction(
                  'log_call',
                  deal.crmId,
                  deal.externalId,
                  { notes: 'Call logged from Pulse' },
                  '',
                  { chatId }
                )
              }
            >
              📞 Log Call
            </button>
            <button
              className="crm-action-btn"
              onClick={() =>
                crmActionsService.createAction(
                  'create_task',
                  deal.crmId,
                  deal.externalId,
                  {
                    title: 'Follow up on deal',
                    description: 'Discussed in Pulse chat',
                  },
                  '',
                  { chatId }
                )
              }
            >
              ✓ Create Task
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="crm-sidepanel-footer">
        {isEditing ? (
          <>
            <button
              className="crm-btn-primary"
              onClick={handleSaveChanges}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              className="crm-btn-secondary"
              onClick={() => {
                setIsEditing(false);
                setEditedFields({});
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button className="crm-btn-primary" onClick={() => setIsEditing(true)}>
            ✎ Edit Fields
          </button>
        )}
      </div>

      {/* Styles */}
      <style>{`
        .crm-sidepanel {
          width: 320px;
          background: var(--color-surface);
          border-left: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .crm-sidepanel-header {
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .crm-sidepanel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .crm-sidepanel-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--color-text-secondary);
        }

        .crm-sidepanel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .crm-section {
          margin-bottom: 24px;
        }

        .crm-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
        }

        .crm-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .crm-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .crm-field label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .crm-input,
        .crm-value {
          padding: 8px;
          border-radius: var(--radius-base);
          font-size: 14px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          color: var(--color-text);
        }

        .crm-value {
          border: none;
          padding: 8px;
          font-weight: 500;
        }

        .crm-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .crm-action-btn {
          padding: 10px;
          background: var(--color-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-base);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 150ms;
        }

        .crm-action-btn:hover {
          background: var(--color-secondary-hover);
        }

        .crm-sidepanel-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--color-border);
          display: flex;
          gap: 8px;
        }

        .crm-btn-primary,
        .crm-btn-secondary {
          flex: 1;
          padding: 10px;
          border-radius: var(--radius-base);
          border: none;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }

        .crm-btn-primary {
          background: var(--color-primary);
          color: var(--color-btn-primary-text);
        }

        .crm-btn-primary:hover {
          background: var(--color-primary-hover);
        }

        .crm-btn-secondary {
          background: var(--color-secondary);
          color: var(--color-text);
        }

        .crm-btn-secondary:hover {
          background: var(--color-secondary-hover);
        }

        .crm-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
```

6. **Save**: `Ctrl + S`

---

## Step 12: Create CRM Action Button Component

**Your Tasks:**

1. **Right-click `src/components/crm/`** → **New File**
2. **Type**: `CRMActionButton.tsx`
3. **Press Enter**
4. **Copy and paste**:

```typescript
// ============================================
// CRM ACTION BUTTON COMPONENT
// Triggers CRM workflows from messages
// ============================================

import React, { useState } from 'react';
import { CRMActionType, CRMActionPayload } from '../types/crmTypes';
import { crmActionsService } from '../services/crmActionsService';

interface CRMActionButtonProps {
  label: string;
  actionType: CRMActionType;
  crmId: string;
  targetExternalId: string;
  payload: CRMActionPayload;
  chatId?: string;
  messageId?: string;
  templateName?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

/**
 * CRM Action Button Component
 * Allows users to trigger CRM workflows from Pulse chat
 * Examples: "Log Call", "Create Task", "Update Deal Stage"
 */
export const CRMActionButton: React.FC<CRMActionButtonProps> = ({
  label,
  actionType,
  crmId,
  targetExternalId,
  payload,
  chatId,
  messageId,
  templateName,
  icon,
  variant = 'primary',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      // Get current user ID (from auth context in real app)
      const userId = ''; // TODO: Get from auth

      await crmActionsService.createAction(
        actionType,
        crmId,
        targetExternalId,
        payload,
        userId,
        {
          chatId,
          messageId,
          templateName,
        }
      );

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error('CRM action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonClass = `crm-action-button crm-button-${variant}`;

  return (
    <>
      <button
        className={buttonClass}
        onClick={handleClick}
        disabled={isLoading || isSuccess}
        title={`${actionType}: ${label}`}
      >
        {isLoading ? (
          <>
            <span className="loading-spinner">⏳</span> Working...
          </>
        ) : isSuccess ? (
          <>
            <span>✓</span> Done!
          </>
        ) : (
          <>
            {icon && <span>{icon}</span>} {label}
          </>
        )}
      </button>

      <style>{`
        .crm-action-button {
          padding: 10px 16px;
          border-radius: var(--radius-base);
          border: none;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 150ms var(--ease-standard);
          white-space: nowrap;
        }

        .crm-button-primary {
          background: var(--color-primary);
          color: var(--color-btn-primary-text);
        }

        .crm-button-primary:hover {
          background: var(--color-primary-hover);
        }

        .crm-button-secondary {
          background: var(--color-secondary);
          color: var(--color-text);
        }

        .crm-button-secondary:hover {
          background: var(--color-secondary-hover);
        }

        .crm-button-outline {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text);
        }

        .crm-button-outline:hover {
          background: var(--color-secondary);
        }

        .crm-action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner {
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};
```

6. **Save**: `Ctrl + S`

---

# 🪝 PHASE 8: Create Custom Hook

## Step 13: Create useCRMIntegration Hook

**Your Tasks:**

1. **Right-click `src/hooks/`** → **New File**
2. **Type**: `useCRMIntegration.ts`
3. **Press Enter**
4. **Copy ALL code below** and **paste**:

```typescript
// ============================================
// useCRMIntegration CUSTOM HOOK
// Main orchestrator for CRM features
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  CRMIntegration,
  CRMDeal,
  CRMContact,
  CRMCompany,
  SmartGroup,
  SyncStatus,
} from '../types/crmTypes';
import { crmService } from '../services/crmService';
import { smartGroupService } from '../services/smartGroupService';
import { crmActionsService } from '../services/crmActionsService';

/**
 * useCRMIntegration Hook
 * Main hook for CRM integration features
 */
export const useCRMIntegration = () => {
  const [integration, setIntegration] = useState<CRMIntegration | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    try {
      setIsLoading(true);
      // Check for any active CRM integration
      // In real app, user would select which CRM to use
      const hubspot = await crmService.getIntegration('hubspot');
      if (hubspot) {
        setIntegration(hubspot);
        updateSyncStatus(hubspot.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CRM');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== SYNC ====================

  const updateSyncStatus = useCallback(async (crmId: string) => {
    try {
      // You would fetch actual sync status from database
      setSyncStatus({
        platform: 'hubspot',
        lastSyncAt: new Date(),
        messageCount: 0,
        status: 'idle',
        contactsCount: 0,
        companiesCount: 0,
        dealsCount: 0,
      });
    } catch (err) {
      setError('Failed to update sync status');
    }
  }, []);

  const triggerFullSync = useCallback(async () => {
    if (!integration) return;

    try {
      setIsLoading(true);
      const result = await crmService.fullSync(integration.id);
      updateSyncStatus(integration.id);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsLoading(false);
    }
  }, [integration, updateSyncStatus]);

  // ==================== SMART GROUPS ====================

  const createSmartGroup = useCallback(
    async (
      channelId: string,
      channelName: string,
      rules: any,
      description?: string
    ) => {
      if (!integration) throw new Error('No CRM integration');

      try {
        const group = await smartGroupService.createSmartGroup(
          channelId,
          channelName,
          integration.id,
          rules,
          description
        );
        return group;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create group');
      }
    },
    [integration]
  );

  const listSmartGroups = useCallback(async () => {
    if (!integration) return [];

    try {
      return await smartGroupService.listSmartGroups(integration.id);
    } catch (err) {
      setError('Failed to list smart groups');
      return [];
    }
  }, [integration]);

  const syncSmartGroup = useCallback(async (groupId: string) => {
    try {
      await smartGroupService.syncGroupMembership(groupId);
    } catch (err) {
      setError('Failed to sync group membership');
    }
  }, []);

  // ==================== CRM ACTIONS ====================

  const executeAction = useCallback(
    async (
      actionType: any,
      targetExternalId: string,
      payload: any,
      context?: any
    ) => {
      if (!integration) throw new Error('No CRM integration');

      try {
        setIsLoading(true);
        const action = await crmActionsService.createAction(
          actionType,
          integration.id,
          targetExternalId,
          payload,
          '', // Current user ID
          context
        );
        return action;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setIsLoading(false);
      }
    },
    [integration]
  );

  return {
    // State
    integration,
    syncStatus,
    isLoading,
    error,

    // CRM Integration
    loadIntegration,

    // Sync
    triggerFullSync,

    // Smart Groups
    createSmartGroup,
    listSmartGroups,
    syncSmartGroup,

    // CRM Actions
    executeAction,
  };
};
```

6. **Save**: `Ctrl + S`

---

# ✅ PHASE 9: Test & Deploy

## Step 14: Run Your Application

**Your Tasks:**

1. **In VS Code**, open **Terminal** → **New Terminal** (or use PowerShell already open)
2. **Make sure you're in project directory**:
```powershell
cd F:\pulse
```

3. **Start development server**:
```powershell
npm run dev
```

4. **You should see output**:
```
  ✓ built in 2.5s
  VITE v6.2.0  ready in 456 ms
  ➜  Local:   http://localhost:5173/
```

5. **Open browser** → Go to `http://localhost:5173`

---

# 📋 INTEGRATION CHECKLIST

## Before Production, Complete:

- [ ] **HubSpot Integration**: Implement `syncHubSpot()` method in `crmService.ts`
- [ ] **Salesforce Integration**: Implement `syncSalesforce()` method
- [ ] **Pipedrive Integration**: Implement `syncPipedrive()` method
- [ ] **CRM Actions**: Implement all `execute*` methods (`createHubSpotTask`, `updateHubSpotDeal`, etc.)
- [ ] **Sidepanel Display**: Integrate `<CRMSidepanel />` into your chat component
- [ ] **Action Buttons**: Add `<CRMActionButton />` to message actions
- [ ] **Smart Group Syncing**: Set up cron job to call `syncGroupMembership()` every 15 minutes
- [ ] **Webhook Handling**: Create endpoint to receive CRM webhooks for real-time sync
- [ ] **Error Handling**: Add UI error notifications
- [ ] **User Testing**: Test with real CRM data

---

# 🚀 NEXT STEPS AFTER COMPLETION

1. **Implement CRM SDK methods** - Fill in platform-specific code for HubSpot, Salesforce, Pipedrive
2. **Connect to auth system** - Replace `''` (current user ID) with actual authenticated user
3. **Test sync workflows** - Trigger full sync and verify data appears in Supabase
4. **Create smart group rules** - Set up rules for auto-managing channels (e.g., "All people on Negotiation-stage deals")
5. **Deploy to production** - Configure environment variables for CRM API keys
6. **Monitor sync jobs** - Set up logging and alerting for sync failures

---

## 📞 SUPPORT

**Common Issues:**

- **"Integration not found"** → Check CRM credentials in Supabase `crm_integrations` table
- **"Sync failed"** → Check API key permissions and rate limits
- **"Smart group not syncing"** → Verify membership rules syntax in database
- **"Sidepanel not showing"** → Ensure CRM deal is linked to chat via `linked_chat_id`

**For detailed help**, check the individual service files for TODO comments indicating what needs implementation for each CRM platform.
