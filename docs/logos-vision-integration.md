# 🔗 Logos Vision CRM ↔ Pulse Integration Guide

**Location**: `F:\pulse` + `F:\logos-vision-crm`  
**Goal**: Enable seamless communication and data sync between Pulse chat and Logos Vision CRM  
**Time to Complete**: 8-10 hours with this guide

---

## 📌 INTEGRATION OVERVIEW

### What This Builds:

```
Logos Vision CRM                    Pulse Chat App
├── Projects                ←→     Linked Channels
├── Contacts                ←→     Chat Members
├── Cases/Notes            ←→     Conversation History
├── Task/Reminders         ←→     Action Items
└── Communications         ←→     Message Log
```

### Three Core Features:

1. **Data Sync Service** - Bi-directional sync of projects, notes, case data
2. **Chat-Linked CRM Records** - Click from chat to view/edit CRM data
3. **Activity Tracking** - Every chat message logged to CRM activity timeline

---

## 🎯 PREREQUISITES

Before starting, answer these questions:

### About Logos Vision CRM:

1. **Database Type**: SQL Server, PostgreSQL, MySQL, or other?
2. **API Available**: REST API, GraphQL, or direct database access?
3. **Authentication**: API Key, OAuth, Username/Password?
4. **Key Tables**: What are the exact table names for:
   - Projects / Cases
   - Contacts / Clients
   - Notes / Comments
   - Tasks / Activities

### About Pulse Integration:

1. **Supabase Setup**: Already configured? ✅ or ❌
2. **Auth System**: Firebase, Supabase Auth, or custom?
3. **Current State**: Empty database or existing data?

---

# PHASE 1: Analyze & Design

## Step 1: Understand Logos Vision Structure

**Your Task:**

1. **Open File Explorer** → `F:\logos-vision-crm`
2. **Look for**:
   - `src/models/` or `models/` folder (data structures)
   - `src/api/` or `api/` folder (endpoints)
   - `.env` or `config.json` (credentials)
   - `database/` folder (schema files)

3. **Open** the main database schema file:
   - If SQL: Look for `.sql` files with table definitions
   - If TypeScript/Node: Check `src/models/*.ts` files

4. **Document** these details:
   - Project model fields (title, description, date, owner, status, etc.)
   - Contact/Client model fields
   - Note/Comment model fields
   - Any relationships (foreign keys, joins)

5. **Create a file** `F:\logos-vision-integration-notes.txt`:
   ```
   === LOGOS VISION CRM STRUCTURE ===
   
   Projects Table:
   - id (UUID or string)
   - name / title
   - description
   - created_at
   - updated_at
   - client_id (foreign key)
   - status (open, closed, etc)
   - owner_id
   - [other fields]:
   
   Contacts Table:
   - id
   - first_name, last_name
   - email
   - phone
   - company
   - [other fields]:
   
   Notes/Cases Table:
   - id
   - title / subject
   - description / content
   - project_id (foreign key)
   - contact_id (foreign key)
   - created_at, updated_at
   - created_by
   - [other fields]:
   
   Database Connection:
   - Type: [SQL Server / PostgreSQL / MySQL]
   - Host: [hostname]
   - Port: [port]
   - Database: [db name]
   - Username: [if available]
   
   API Available:
   - Base URL: [if exists]
   - Key endpoints: [list]
   - Authentication: [method]
   ```

---

## Step 2: Design Data Sync Architecture

The sync will work like this:

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW DIAGRAM                        │
└─────────────────────────────────────────────────────────────┘

Logos Vision CRM          Bridge Service        Pulse App
     ↓                         ↓                    ↓
  Projects         →  Normalize & Transform  →  Channels
  Contacts         →  to Pulse format        →  Users
  Notes/Cases      →  Map relationships      →  Messages
  Activities       →  Handle conflicts       →  Activity Log
```

### Sync Strategy:

| Data Type | Sync Direction | Frequency | Trigger |
|-----------|---|---|---|
| Projects → Channels | One-way | Every 30 min | Manual + Scheduled |
| Contacts → Users | One-way | Every 60 min | Manual + Scheduled |
| Notes/Cases → Message Threads | Bi-directional | Real-time | On change |
| Chat Messages → Activity Log | One-way | Real-time | On message sent |
| CRM Updates → Chat Notifications | One-way | Real-time | On CRM change |

---

# PHASE 2: Create Integration Services

## Step 3: Create TypeScript Type Definitions

**Your Task:**

1. **Open VS Code** (if not already open):
   ```powershell
   cd F:\pulse
   code .
   ```

2. **Right-click `src/types`** → **New File**

3. **Create file**: `logosVisionTypes.ts`

4. **Copy ALL code below** and paste:

```typescript
// ============================================
// LOGOS VISION CRM TYPE DEFINITIONS
// ============================================

// ============= LOGOS VISION MODELS =============

export interface LogosProject {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'closed' | string;
  clientId: string;
  clientName?: string;
  ownerId: string;
  ownerName?: string;
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date;
  dueDate?: Date;
  budget?: number;
  customFields?: Record<string, any>;
  externalId?: string; // ID in Logos Vision system
}

export interface LogosContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  status: 'active' | 'inactive' | string;
  createdAt: Date;
  updatedAt: Date;
  customFields?: Record<string, any>;
  externalId?: string;
}

export interface LogosCase {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  projectName?: string;
  contactId?: string;
  contactName?: string;
  status: 'open' | 'in_progress' | 'closed' | 'archived' | string;
  priority: 'low' | 'medium' | 'high' | 'critical' | string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  dueDate?: Date;
  customFields?: Record<string, any>;
  externalId?: string;
}

export interface LogosNote {
  id: string;
  title?: string;
  content: string;
  caseId?: string;
  projectId?: string;
  contactId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  attachments?: LogosAttachment[];
  externalId?: string;
}

export interface LogosTask {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  caseId?: string;
  assignedTo: string;
  assignedToEmail?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | string;
  priority: 'low' | 'medium' | 'high' | 'critical' | string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
}

export interface LogosAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface LogosActivity {
  id: string;
  entityType: 'project' | 'case' | 'contact' | 'task' | 'note';
  entityId: string;
  action: 'created' | 'updated' | 'deleted' | 'commented' | 'assigned';
  description: string;
  performedBy: string;
  performedAt: Date;
  changes?: Record<string, { old: any; new: any }>;
}

// ============= INTEGRATION MAPPINGS =============

export interface LogosPulseMapping {
  id: string;
  // Logos Vision side
  logosEntityType: 'project' | 'case' | 'contact' | 'task';
  logosEntityId: string;
  // Pulse side
  pulseEntityType: 'channel' | 'user' | 'message_thread' | 'task';
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
  logosVisionApiUrl: string;
  logosVisionApiKey: string;
  syncInterval: number; // milliseconds
  autoSyncEnabled: boolean;
  bidirectionalSync: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  lastSyncedAt?: Date;
}

// ============= PULSE CHANNELS (FOR MAPPING) =============

export interface PulseChannel {
  id: string;
  name: string;
  description?: string;
  linkedLogosProjectId?: string; // Links to Logos project
  members: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface PulseMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  linkedLogosEntityId?: string; // Links to Logos note/case
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
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

5. **Save**: Press `Ctrl + S`

---

## Step 4: Create Logos Vision API Service

**Your Task:**

1. **Right-click `src/services`** → **New File**

2. **Create**: `logosVisionService.ts`

3. **Copy ALL code below** and paste:

```typescript
// ============================================
// LOGOS VISION CRM API SERVICE
// ============================================

import axios, { AxiosInstance } from 'axios';
import {
  LogosProject,
  LogosContact,
  LogosCase,
  LogosNote,
  LogosTask,
  LogosActivity,
} from '../types/logosVisionTypes';

/**
 * Logos Vision CRM Service
 * Handles all communication with Logos Vision API
 */
export class LogosVisionService {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ==================== PROJECTS ====================

  /**
   * Get all projects from Logos Vision
   */
  async getProjects(filters?: {
    status?: string;
    clientId?: string;
  }): Promise<LogosProject[]> {
    try {
      const response = await this.client.get('/projects', {
        params: filters,
      });

      return response.data.projects.map((p: any) =>
        this.mapLogosToPulseProject(p)
      );
    } catch (error) {
      throw this.handleError('Failed to fetch projects', error);
    }
  }

  /**
   * Get single project by ID
   */
  async getProject(projectId: string): Promise<LogosProject> {
    try {
      const response = await this.client.get(`/projects/${projectId}`);
      return this.mapLogosToPulseProject(response.data.project);
    } catch (error) {
      throw this.handleError('Failed to fetch project', error);
    }
  }

  /**
   * Create new project in Logos Vision
   */
  async createProject(
    name: string,
    clientId: string,
    data: Partial<LogosProject>
  ): Promise<LogosProject> {
    try {
      const response = await this.client.post('/projects', {
        name,
        client_id: clientId,
        ...this.mapPulseToLogosProject(data),
      });
      return this.mapLogosToPulseProject(response.data.project);
    } catch (error) {
      throw this.handleError('Failed to create project', error);
    }
  }

  /**
   * Update project in Logos Vision
   */
  async updateProject(
    projectId: string,
    updates: Partial<LogosProject>
  ): Promise<LogosProject> {
    try {
      const response = await this.client.put(`/projects/${projectId}`, {
        ...this.mapPulseToLogosProject(updates),
      });
      return this.mapLogosToPulseProject(response.data.project);
    } catch (error) {
      throw this.handleError('Failed to update project', error);
    }
  }

  // ==================== CONTACTS ====================

  /**
   * Get all contacts from Logos Vision
   */
  async getContacts(filters?: {
    company?: string;
    status?: string;
  }): Promise<LogosContact[]> {
    try {
      const response = await this.client.get('/contacts', {
        params: filters,
      });

      return response.data.contacts.map((c: any) =>
        this.mapLogosToPulseContact(c)
      );
    } catch (error) {
      throw this.handleError('Failed to fetch contacts', error);
    }
  }

  /**
   * Get single contact by ID
   */
  async getContact(contactId: string): Promise<LogosContact> {
    try {
      const response = await this.client.get(`/contacts/${contactId}`);
      return this.mapLogosToPulseContact(response.data.contact);
    } catch (error) {
      throw this.handleError('Failed to fetch contact', error);
    }
  }

  /**
   * Create new contact in Logos Vision
   */
  async createContact(
    firstName: string,
    lastName: string,
    email: string,
    data?: Partial<LogosContact>
  ): Promise<LogosContact> {
    try {
      const response = await this.client.post('/contacts', {
        first_name: firstName,
        last_name: lastName,
        email,
        ...this.mapPulseToLogosContact(data || {}),
      });
      return this.mapLogosToPulseContact(response.data.contact);
    } catch (error) {
      throw this.handleError('Failed to create contact', error);
    }
  }

  /**
   * Update contact in Logos Vision
   */
  async updateContact(
    contactId: string,
    updates: Partial<LogosContact>
  ): Promise<LogosContact> {
    try {
      const response = await this.client.put(`/contacts/${contactId}`, {
        ...this.mapPulseToLogosContact(updates),
      });
      return this.mapLogosToPulseContact(response.data.contact);
    } catch (error) {
      throw this.handleError('Failed to update contact', error);
    }
  }

  // ==================== CASES ====================

  /**
   * Get all cases from Logos Vision
   */
  async getCases(filters?: {
    projectId?: string;
    status?: string;
  }): Promise<LogosCase[]> {
    try {
      const response = await this.client.get('/cases', {
        params: filters,
      });

      return response.data.cases.map((c: any) =>
        this.mapLogosToPulseCase(c)
      );
    } catch (error) {
      throw this.handleError('Failed to fetch cases', error);
    }
  }

  /**
   * Get single case by ID
   */
  async getCase(caseId: string): Promise<LogosCase> {
    try {
      const response = await this.client.get(`/cases/${caseId}`);
      return this.mapLogosToPulseCase(response.data.case);
    } catch (error) {
      throw this.handleError('Failed to fetch case', error);
    }
  }

  /**
   * Create new case in Logos Vision
   */
  async createCase(
    title: string,
    projectId: string,
    data: Partial<LogosCase>
  ): Promise<LogosCase> {
    try {
      const response = await this.client.post('/cases', {
        title,
        project_id: projectId,
        ...this.mapPulseToLogosCase(data),
      });
      return this.mapLogosToPulseCase(response.data.case);
    } catch (error) {
      throw this.handleError('Failed to create case', error);
    }
  }

  /**
   * Update case in Logos Vision
   */
  async updateCase(
    caseId: string,
    updates: Partial<LogosCase>
  ): Promise<LogosCase> {
    try {
      const response = await this.client.put(`/cases/${caseId}`, {
        ...this.mapPulseToLogosCase(updates),
      });
      return this.mapLogosToPulseCase(response.data.case);
    } catch (error) {
      throw this.handleError('Failed to update case', error);
    }
  }

  // ==================== NOTES ====================

  /**
   * Get all notes for a case
   */
  async getNotes(caseId: string): Promise<LogosNote[]> {
    try {
      const response = await this.client.get(`/cases/${caseId}/notes`);

      return response.data.notes.map((n: any) =>
        this.mapLogosToPulseNote(n)
      );
    } catch (error) {
      throw this.handleError('Failed to fetch notes', error);
    }
  }

  /**
   * Create note on case
   */
  async createNote(
    caseId: string,
    content: string,
    createdBy: string
  ): Promise<LogosNote> {
    try {
      const response = await this.client.post(`/cases/${caseId}/notes`, {
        content,
        created_by: createdBy,
      });
      return this.mapLogosToPulseNote(response.data.note);
    } catch (error) {
      throw this.handleError('Failed to create note', error);
    }
  }

  // ==================== TASKS ====================

  /**
   * Get all tasks for a project
   */
  async getTasks(projectId: string): Promise<LogosTask[]> {
    try {
      const response = await this.client.get(`/projects/${projectId}/tasks`);

      return response.data.tasks.map((t: any) =>
        this.mapLogosToPulseTask(t)
      );
    } catch (error) {
      throw this.handleError('Failed to fetch tasks', error);
    }
  }

  /**
   * Create task in Logos Vision
   */
  async createTask(
    title: string,
    projectId: string,
    assignedTo: string,
    dueDate: Date
  ): Promise<LogosTask> {
    try {
      const response = await this.client.post('/tasks', {
        title,
        project_id: projectId,
        assigned_to: assignedTo,
        due_date: dueDate.toISOString(),
      });
      return this.mapLogosToPulseTask(response.data.task);
    } catch (error) {
      throw this.handleError('Failed to create task', error);
    }
  }

  /**
   * Update task status
   */
  async updateTask(
    taskId: string,
    updates: Partial<LogosTask>
  ): Promise<LogosTask> {
    try {
      const response = await this.client.put(`/tasks/${taskId}`, {
        ...this.mapPulseToLogosTask(updates),
      });
      return this.mapLogosToPulseTask(response.data.task);
    } catch (error) {
      throw this.handleError('Failed to update task', error);
    }
  }

  // ==================== ACTIVITIES ====================

  /**
   * Get activity log for entity
   */
  async getActivityLog(
    entityType: string,
    entityId: string
  ): Promise<LogosActivity[]> {
    try {
      const response = await this.client.get(
        `/activities?entity_type=${entityType}&entity_id=${entityId}`
      );

      return response.data.activities.map((a: any) =>
        this.mapLogosToPulseActivity(a)
      );
    } catch (error) {
      throw this.handleError('Failed to fetch activity log', error);
    }
  }

  /**
   * Log activity in Logos Vision
   */
  async logActivity(
    entityType: string,
    entityId: string,
    action: string,
    description: string,
    performedBy: string
  ): Promise<LogosActivity> {
    try {
      const response = await this.client.post('/activities', {
        entity_type: entityType,
        entity_id: entityId,
        action,
        description,
        performed_by: performedBy,
      });
      return this.mapLogosToPulseActivity(response.data.activity);
    } catch (error) {
      throw this.handleError('Failed to log activity', error);
    }
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Check connection to Logos Vision
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Logos Vision health check failed', error);
      return false;
    }
  }

  // ==================== PRIVATE MAPPING METHODS ====================

  private mapLogosToPulseProject(logosProject: any): LogosProject {
    return {
      id: logosProject.id,
      name: logosProject.name || logosProject.title,
      description: logosProject.description,
      status: logosProject.status || 'active',
      clientId: logosProject.client_id,
      clientName: logosProject.client_name,
      ownerId: logosProject.owner_id,
      ownerName: logosProject.owner_name,
      createdAt: new Date(logosProject.created_at),
      updatedAt: new Date(logosProject.updated_at),
      startDate: logosProject.start_date
        ? new Date(logosProject.start_date)
        : undefined,
      dueDate: logosProject.due_date
        ? new Date(logosProject.due_date)
        : undefined,
      budget: logosProject.budget,
      customFields: logosProject.custom_fields,
      externalId: logosProject.external_id,
    };
  }

  private mapPulseToLogosProject(pulseProject: Partial<LogosProject>): any {
    return {
      name: pulseProject.name,
      description: pulseProject.description,
      status: pulseProject.status,
      client_id: pulseProject.clientId,
      owner_id: pulseProject.ownerId,
      start_date: pulseProject.startDate?.toISOString(),
      due_date: pulseProject.dueDate?.toISOString(),
      budget: pulseProject.budget,
      custom_fields: pulseProject.customFields,
    };
  }

  private mapLogosToPulseContact(logosContact: any): LogosContact {
    return {
      id: logosContact.id,
      firstName: logosContact.first_name,
      lastName: logosContact.last_name,
      email: logosContact.email,
      phone: logosContact.phone,
      company: logosContact.company,
      title: logosContact.title,
      status: logosContact.status || 'active',
      createdAt: new Date(logosContact.created_at),
      updatedAt: new Date(logosContact.updated_at),
      customFields: logosContact.custom_fields,
      externalId: logosContact.external_id,
    };
  }

  private mapPulseToLogosContact(pulseContact: Partial<LogosContact>): any {
    return {
      first_name: pulseContact.firstName,
      last_name: pulseContact.lastName,
      email: pulseContact.email,
      phone: pulseContact.phone,
      company: pulseContact.company,
      title: pulseContact.title,
      status: pulseContact.status,
      custom_fields: pulseContact.customFields,
    };
  }

  private mapLogosToPulseCase(logosCase: any): LogosCase {
    return {
      id: logosCase.id,
      title: logosCase.title,
      description: logosCase.description,
      projectId: logosCase.project_id,
      projectName: logosCase.project_name,
      contactId: logosCase.contact_id,
      contactName: logosCase.contact_name,
      status: logosCase.status || 'open',
      priority: logosCase.priority || 'medium',
      createdAt: new Date(logosCase.created_at),
      updatedAt: new Date(logosCase.updated_at),
      createdBy: logosCase.created_by,
      dueDate: logosCase.due_date ? new Date(logosCase.due_date) : undefined,
      customFields: logosCase.custom_fields,
      externalId: logosCase.external_id,
    };
  }

  private mapPulseToLogosCase(pulseCase: Partial<LogosCase>): any {
    return {
      title: pulseCase.title,
      description: pulseCase.description,
      project_id: pulseCase.projectId,
      contact_id: pulseCase.contactId,
      status: pulseCase.status,
      priority: pulseCase.priority,
      due_date: pulseCase.dueDate?.toISOString(),
      custom_fields: pulseCase.customFields,
    };
  }

  private mapLogosToPulseNote(logosNote: any): LogosNote {
    return {
      id: logosNote.id,
      title: logosNote.title,
      content: logosNote.content,
      caseId: logosNote.case_id,
      projectId: logosNote.project_id,
      contactId: logosNote.contact_id,
      createdAt: new Date(logosNote.created_at),
      updatedAt: new Date(logosNote.updated_at),
      createdBy: logosNote.created_by,
      attachments: logosNote.attachments || [],
      externalId: logosNote.external_id,
    };
  }

  private mapLogosToPulseTask(logosTask: any): LogosTask {
    return {
      id: logosTask.id,
      title: logosTask.title,
      description: logosTask.description,
      projectId: logosTask.project_id,
      caseId: logosTask.case_id,
      assignedTo: logosTask.assigned_to,
      assignedToEmail: logosTask.assigned_to_email,
      status: logosTask.status || 'open',
      priority: logosTask.priority || 'medium',
      dueDate: new Date(logosTask.due_date),
      createdAt: new Date(logosTask.created_at),
      updatedAt: new Date(logosTask.updated_at),
      externalId: logosTask.external_id,
    };
  }

  private mapPulseToLogosTask(pulseTask: Partial<LogosTask>): any {
    return {
      title: pulseTask.title,
      description: pulseTask.description,
      assigned_to: pulseTask.assignedTo,
      status: pulseTask.status,
      priority: pulseTask.priority,
      due_date: pulseTask.dueDate?.toISOString(),
    };
  }

  private mapLogosToPulseActivity(logosActivity: any): LogosActivity {
    return {
      id: logosActivity.id,
      entityType: logosActivity.entity_type,
      entityId: logosActivity.entity_id,
      action: logosActivity.action,
      description: logosActivity.description,
      performedBy: logosActivity.performed_by,
      performedAt: new Date(logosActivity.performed_at),
      changes: logosActivity.changes,
    };
  }

  private handleError(message: string, error: any): Error {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`${message}:`, errorMessage);
    return new Error(`${message}: ${errorMessage}`);
  }
}

export const logosVisionService = new LogosVisionService(
  process.env.VITE_LOGOS_VISION_API_URL || 'http://localhost:3001/api',
  process.env.VITE_LOGOS_VISION_API_KEY || ''
);
```

5. **Save**: `Ctrl + S`

---

## Step 5: Create Data Sync Service

**Your Task:**

1. **Right-click `src/services`** → **New File**

2. **Create**: `logosVisionSyncService.ts`

3. **Copy ALL code below** and paste:

```typescript
// ============================================
// LOGOS VISION ↔ PULSE SYNC SERVICE
// Bi-directional data synchronization
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  LogosPulseMapping,
  SyncLog,
  LogosProject,
  LogosContact,
  LogosCase,
} from '../types/logosVisionTypes';
import { logosVisionService } from './logosVisionService';

/**
 * Sync Service
 * Manages bi-directional sync between Logos Vision and Pulse
 */
export class LogosVisionSyncService {
  private supabase: SupabaseClient;
  private syncInProgress = false;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ==================== FULL SYNC ====================

  /**
   * Full sync: Pull all data from Logos Vision → Pulse
   */
  async fullSync(): Promise<SyncLog> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    const syncLog: SyncLog = {
      id: `sync-${Date.now()}`,
      syncType: 'full',
      entityType: 'all',
      startedAt: new Date(),
      recordsSynced: 0,
      recordsFailed: 0,
      status: 'in_progress',
    };

    this.syncInProgress = true;

    try {
      console.log('🔄 Starting full sync from Logos Vision...');

      // Sync projects
      const projectsLog = await this.syncProjects();
      syncLog.recordsSynced += projectsLog.synced;
      syncLog.recordsFailed += projectsLog.failed;

      // Sync contacts
      const contactsLog = await this.syncContacts();
      syncLog.recordsSynced += contactsLog.synced;
      syncLog.recordsFailed += contactsLog.failed;

      // Sync cases
      const casesLog = await this.syncCases();
      syncLog.recordsSynced += casesLog.synced;
      syncLog.recordsFailed += casesLog.failed;

      // Sync tasks
      const tasksLog = await this.syncTasks();
      syncLog.recordsSynced += tasksLog.synced;
      syncLog.recordsFailed += tasksLog.failed;

      syncLog.status = 'completed';
      syncLog.completedAt = new Date();

      console.log('✅ Full sync completed');

      await this.recordSyncLog(syncLog);
      return syncLog;
    } catch (error) {
      syncLog.status = 'failed';
      syncLog.errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      syncLog.completedAt = new Date();

      console.error('❌ Sync failed:', syncLog.errorMessage);

      await this.recordSyncLog(syncLog);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // ==================== PROJECT SYNC ====================

  private async syncProjects(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    try {
      console.log('📦 Syncing projects...');

      const projects = await logosVisionService.getProjects();

      for (const project of projects) {
        try {
          // Check if mapping exists
          const mapping = await this.getMapping(
            'project',
            project.id
          );

          if (!mapping) {
            // Create channel in Pulse for this project
            const channel = await this.createChannelFromProject(project);
            // Create mapping
            await this.createMapping(
              'project',
              project.id,
              'channel',
              channel.id
            );
          }

          synced++;
        } catch (error) {
          console.error(`Failed to sync project ${project.id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Projects: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      console.error('Failed to sync projects:', error);
      return { synced: 0, failed: 1 };
    }
  }

  private async createChannelFromProject(project: LogosProject): Promise<{
    id: string;
    name: string;
  }> {
    // TODO: Create channel in Pulse
    // This requires integrating with your Pulse channel API
    console.log('Creating channel for project:', project.name);

    return {
      id: `channel-${project.id}`,
      name: project.name,
    };
  }

  // ==================== CONTACT SYNC ====================

  private async syncContacts(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    try {
      console.log('👥 Syncing contacts...');

      const contacts = await logosVisionService.getContacts();

      for (const contact of contacts) {
        try {
          const mapping = await this.getMapping('contact', contact.id);

          if (!mapping) {
            // TODO: Create or link user in Pulse
            // For now, just create mapping
            await this.createMapping(
              'contact',
              contact.id,
              'user',
              `user-${contact.id}`
            );
          }

          synced++;
        } catch (error) {
          console.error(`Failed to sync contact ${contact.id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Contacts: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      console.error('Failed to sync contacts:', error);
      return { synced: 0, failed: 1 };
    }
  }

  // ==================== CASE SYNC ====================

  private async syncCases(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    try {
      console.log('📋 Syncing cases...');

      const cases = await logosVisionService.getCases();

      for (const caseRecord of cases) {
        try {
          // Get project mapping
          const projectMapping = await this.getMapping(
            'project',
            caseRecord.projectId
          );

          if (!projectMapping) {
            throw new Error(
              `Project mapping not found for case ${caseRecord.id}`
            );
          }

          const mapping = await this.getMapping('case', caseRecord.id);

          if (!mapping) {
            // TODO: Create message thread in Pulse channel
            // For now, just create mapping
            await this.createMapping(
              'case',
              caseRecord.id,
              'message_thread',
              `thread-${caseRecord.id}`
            );
          }

          synced++;
        } catch (error) {
          console.error(`Failed to sync case ${caseRecord.id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Cases: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      console.error('Failed to sync cases:', error);
      return { synced: 0, failed: 1 };
    }
  }

  // ==================== TASK SYNC ====================

  private async syncTasks(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    try {
      console.log('✅ Syncing tasks...');

      // Get all projects first
      const projects = await logosVisionService.getProjects();

      for (const project of projects) {
        try {
          const tasks = await logosVisionService.getTasks(project.id);

          for (const task of tasks) {
            try {
              const mapping = await this.getMapping('task', task.id);

              if (!mapping) {
                // TODO: Create task in Pulse
                await this.createMapping(
                  'task',
                  task.id,
                  'task',
                  `task-${task.id}`
                );
              }

              synced++;
            } catch (error) {
              console.error(`Failed to sync task ${task.id}:`, error);
              failed++;
            }
          }
        } catch (error) {
          console.error(
            `Failed to sync tasks for project ${project.id}:`,
            error
          );
          failed++;
        }
      }

      console.log(`✅ Tasks: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      console.error('Failed to sync tasks:', error);
      return { synced: 0, failed: 1 };
    }
  }

  // ==================== MAPPING MANAGEMENT ====================

  private async getMapping(
    logosEntityType: string,
    logosEntityId: string
  ): Promise<LogosPulseMapping | null> {
    const { data } = await this.supabase
      .from('logos_pulse_mappings')
      .select('*')
      .eq('logos_entity_type', logosEntityType)
      .eq('logos_entity_id', logosEntityId)
      .single();

    return data;
  }

  private async createMapping(
    logosEntityType: string,
    logosEntityId: string,
    pulseEntityType: string,
    pulseEntityId: string
  ): Promise<LogosPulseMapping> {
    const mapping: LogosPulseMapping = {
      id: `mapping-${Date.now()}`,
      logosEntityType,
      logosEntityId,
      pulseEntityType,
      pulseEntityId,
      syncDirection: 'logos_to_pulse',
      lastSyncAt: new Date(),
      syncStatus: 'synced',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { data, error } = await this.supabase
      .from('logos_pulse_mappings')
      .insert(mapping)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==================== SYNC LOG ====================

  private async recordSyncLog(log: SyncLog): Promise<void> {
    await this.supabase
      .from('logos_sync_logs')
      .insert({
        id: log.id,
        sync_type: log.syncType,
        entity_type: log.entityType,
        started_at: log.startedAt.toISOString(),
        completed_at: log.completedAt?.toISOString(),
        records_synced: log.recordsSynced,
        records_failed: log.recordsFailed,
        status: log.status,
        error_message: log.errorMessage,
      });
  }
}

export const logosVisionSyncService = new LogosVisionSyncService(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

5. **Save**: `Ctrl + S`

---

# PHASE 3: Database Setup

## Step 6: Create Supabase Tables for Integration

**Your Task:**

1. **Open browser** → `https://supabase.com/dashboard`
2. **Click your Pulse project**
3. **Left sidebar** → **SQL Editor**
4. **Click "+ New Query"**
5. **Copy ALL code below** and paste:

```sql
-- ============================================
-- LOGOS VISION ↔ PULSE INTEGRATION SCHEMA
-- ============================================

-- Logos Vision Data Cache (store synced data)
CREATE TABLE IF NOT EXISTS logos_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  client_id TEXT,
  client_name TEXT,
  owner_id TEXT,
  owner_name TEXT,
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  budget DECIMAL,
  custom_fields JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  external_id TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS logos_contacts (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  company TEXT,
  title TEXT,
  status TEXT DEFAULT 'active',
  custom_fields JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  external_id TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS logos_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT REFERENCES logos_projects(id),
  contact_id TEXT REFERENCES logos_contacts(id),
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  created_by TEXT,
  custom_fields JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  external_id TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS logos_notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  case_id TEXT REFERENCES logos_cases(id),
  project_id TEXT REFERENCES logos_projects(id),
  contact_id TEXT REFERENCES logos_contacts(id),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  attachments JSONB
);

CREATE TABLE IF NOT EXISTS logos_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT REFERENCES logos_projects(id),
  case_id TEXT REFERENCES logos_cases(id),
  assigned_to TEXT,
  assigned_to_email TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration Mappings
CREATE TABLE IF NOT EXISTS logos_pulse_mappings (
  id TEXT PRIMARY KEY,
  logos_entity_type TEXT NOT NULL,
  logos_entity_id TEXT NOT NULL,
  pulse_entity_type TEXT NOT NULL,
  pulse_entity_id TEXT NOT NULL,
  sync_direction TEXT DEFAULT 'logos_to_pulse',
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced',
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(logos_entity_type, logos_entity_id, pulse_entity_type)
);

-- Sync Logs
CREATE TABLE IF NOT EXISTS logos_sync_logs (
  id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL,
  entity_type TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT
);

-- Indexes
CREATE INDEX idx_logos_projects_client ON logos_projects(client_id);
CREATE INDEX idx_logos_projects_owner ON logos_projects(owner_id);
CREATE INDEX idx_logos_contacts_email ON logos_contacts(email);
CREATE INDEX idx_logos_cases_project ON logos_cases(project_id);
CREATE INDEX idx_logos_cases_contact ON logos_cases(contact_id);
CREATE INDEX idx_logos_tasks_project ON logos_tasks(project_id);
CREATE INDEX idx_logos_tasks_assigned ON logos_tasks(assigned_to);
CREATE INDEX idx_mappings_logos ON logos_pulse_mappings(logos_entity_type, logos_entity_id);
CREATE INDEX idx_mappings_pulse ON logos_pulse_mappings(pulse_entity_type, pulse_entity_id);
CREATE INDEX idx_sync_logs_status ON logos_sync_logs(status);
```

6. **Click Run** (bottom right)
7. **Wait for** ✅ **Success** notification

---

## Step 7: Environment Configuration

**Your Task:**

1. **Open file**: `F:\pulse\.env.local`
   (Or create if doesn't exist)

2. **Add these lines** at the end:

```
# Logos Vision CRM Integration
VITE_LOGOS_VISION_API_URL=http://localhost:3001/api
VITE_LOGOS_VISION_API_KEY=your_api_key_here
VITE_LOGOS_VISION_WEBHOOK_SECRET=your_webhook_secret_here

# Sync Configuration
VITE_SYNC_INTERVAL=1800000
VITE_AUTO_SYNC_ENABLED=true
VITE_BIDIRECTIONAL_SYNC=false
```

3. **Replace values**:
   - `http://localhost:3001/api` → Your Logos Vision API base URL
   - `your_api_key_here` → Your Logos Vision API key
   - `your_webhook_secret_here` → Webhook secret for receiving CRM updates

4. **Save**: `Ctrl + S`

---

# PHASE 4: Integration & Testing

## Step 8: Create Custom Hook

**Your Task:**

1. **Right-click `src/hooks`** → **New File**
2. **Create**: `useLogosVisionIntegration.ts`
3. **Paste**:

```typescript
import { useState, useCallback } from 'react';
import { logosVisionService } from '../services/logosVisionService';
import { logosVisionSyncService } from '../services/logosVisionSyncService';
import { SyncLog } from '../types/logosVisionTypes';

export const useLogosVisionIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<SyncLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      const connected = await logosVisionService.healthCheck();
      setIsConnected(connected);
      return connected;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnected(false);
      return false;
    }
  }, []);

  const startFullSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const log = await logosVisionSyncService.fullSync();
      setSyncLog(log);
      return log;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isConnected,
    isSyncing,
    syncLog,
    error,
    checkConnection,
    startFullSync,
  };
};
```

4. **Save**: `Ctrl + S`

---

## Step 9: Test Integration

**Your Task:**

1. **In PowerShell** (in project directory):
   ```powershell
   npm run dev
   ```

2. **Open browser** → `http://localhost:5173`

3. **Test connection** by creating a component that calls:
   ```typescript
   const { checkConnection, startFullSync } = useLogosVisionIntegration();
   
   await checkConnection(); // Should return true
   await startFullSync(); // Should sync data
   ```

---

## Step 10: Configure Webhook (Optional but Recommended)

**Your Task:**

For real-time sync when Logos Vision data changes:

1. **In Logos Vision settings**, add webhook:
   - URL: `https://yourdomain.com/api/webhooks/logos-vision`
   - Secret: Value from `.env.local`
   - Events: `project.updated`, `case.updated`, `note.created`, `task.updated`

2. **Create API endpoint** in your Pulse backend to receive webhooks

---

# ✅ CHECKLIST

- [ ] Created `src/types/logosVisionTypes.ts`
- [ ] Created `src/services/logosVisionService.ts`
- [ ] Created `src/services/logosVisionSyncService.ts`
- [ ] Created Supabase tables (6 tables + indexes)
- [ ] Updated `.env.local` with Logos Vision credentials
- [ ] Created `src/hooks/useLogosVisionIntegration.ts`
- [ ] Tested connection: `checkConnection()` returns true
- [ ] Ran full sync: `startFullSync()` completes
- [ ] Verified data in Supabase tables

---

# 🚀 NEXT STEPS

1. **Build UI Components** for:
   - Project selector (linked to channels)
   - Case details sidebar (in chat)
   - Notes list (in thread)
   - Task assignment from chat

2. **Implement Message Linking**:
   - Link Pulse messages to Logos cases/notes
   - Log all chat as CRM activities

3. **Set Up Auto-Sync Scheduler**:
   - Run sync every 30 minutes
   - Handle conflicts
   - Log all activity

4. **Add Notifications**:
   - Alert when Logos data changes
   - Notify team of case updates
   - Remind about due tasks

---

## 📞 SUPPORT

**Common Issues**:

- **"Connection failed"** → Check API URL and key in `.env.local`
- **"Sync stuck"** → Check Logos Vision API health
- **"Mappings not created"** → Verify Supabase tables exist
- **"Data not syncing"** → Check table permissions in Supabase RLS

**For detailed help**: Check the service files for TODO comments where platform-specific code needs implementation.
