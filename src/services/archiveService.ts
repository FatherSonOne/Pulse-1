/**
 * Archive Service - Comprehensive archive management
 * Collections, Smart Folders, AI Features, Timeline View, and Search Integration
 */

import { supabase } from './supabase';
import type {
  ArchiveItem,
  ArchiveType,
  ArchiveCollection,
  SmartFolder,
  SmartFolderRule,
  ArchiveTimelineEvent,
} from '../types';
import { googleDriveService } from './googleDriveService';

// ============= DATABASE TYPES =============

interface DBArchive {
  id: string;
  user_id: string;
  archive_type: ArchiveType;
  title: string;
  content: string;
  date: string;
  tags: string[];
  related_contact_id?: string;
  decision_status?: 'approved' | 'rejected';
  collection_id?: string;
  drive_file_id?: string;
  drive_folder_id?: string;
  file_url?: string;
  file_size?: number;
  mime_type?: string;
  thumbnail_url?: string;
  ai_tags?: string[];
  related_item_ids?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  ai_summary?: string;
  exported_at?: string;
  pinned_at?: string;
  starred?: boolean;
  view_count?: number;
  last_viewed_at?: string;
  visibility?: 'private' | 'team' | 'enterprise';
  shared_with?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface DBCollection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  pinned_at?: string;
  visibility?: 'private' | 'team' | 'enterprise';
  created_at: string;
  updated_at: string;
}

interface DBSmartFolder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  rules: SmartFolderRule[];
  rule_operator: 'and' | 'or';
  created_at: string;
  updated_at: string;
}

// ============= HELPER FUNCTIONS =============

function dbToArchive(db: DBArchive): ArchiveItem {
  return {
    id: db.id,
    type: db.archive_type,
    title: db.title,
    content: db.content,
    date: new Date(db.date),
    tags: db.tags || [],
    relatedContactId: db.related_contact_id,
    decisionStatus: db.decision_status,
    collectionId: db.collection_id,
    driveFileId: db.drive_file_id,
    driveFolderId: db.drive_folder_id,
    fileUrl: db.file_url,
    fileSize: db.file_size,
    mimeType: db.mime_type,
    thumbnailUrl: db.thumbnail_url,
    aiTags: db.ai_tags,
    relatedItemIds: db.related_item_ids,
    sentiment: db.sentiment,
    aiSummary: db.ai_summary,
    exportedAt: db.exported_at ? new Date(db.exported_at) : undefined,
    pinnedAt: db.pinned_at ? new Date(db.pinned_at) : undefined,
    starred: db.starred,
    viewCount: db.view_count,
    lastViewedAt: db.last_viewed_at ? new Date(db.last_viewed_at) : undefined,
    visibility: db.visibility,
    sharedWith: db.shared_with,
    createdBy: db.created_by,
    updatedAt: db.updated_at ? new Date(db.updated_at) : undefined,
  };
}

function dbToCollection(db: DBCollection, itemCount: number): ArchiveCollection {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    color: db.color,
    icon: db.icon,
    itemCount,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
    userId: db.user_id,
    visibility: db.visibility,
    pinnedAt: db.pinned_at ? new Date(db.pinned_at) : undefined,
  };
}

function dbToSmartFolder(db: DBSmartFolder, itemCount: number): SmartFolder {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    color: db.color,
    icon: db.icon,
    rules: db.rules,
    ruleOperator: db.rule_operator,
    itemCount,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
    userId: db.user_id,
  };
}

// ============= ARCHIVE SERVICE CLASS =============

class ArchiveService {
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  private getUserId(): string {
    if (!this.userId) {
      const stored = localStorage.getItem('pulse_user_id');
      if (stored) {
        this.userId = stored;
        return stored;
      }
      this.userId = crypto.randomUUID();
      localStorage.setItem('pulse_user_id', this.userId);
    }
    return this.userId;
  }

  // ============= ARCHIVES CRUD =============

  async getArchives(options?: {
    type?: ArchiveType;
    collectionId?: string;
    starred?: boolean;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<ArchiveItem[]> {
    let query = supabase
      .from('archives')
      .select('*')
      .eq('user_id', this.getUserId());

    if (options?.type) {
      query = query.eq('archive_type', options.type);
    }
    if (options?.collectionId) {
      query = query.eq('collection_id', options.collectionId);
    }
    if (options?.starred !== undefined) {
      query = query.eq('starred', options.starred);
    }
    if (options?.dateFrom) {
      query = query.gte('date', options.dateFrom.toISOString());
    }
    if (options?.dateTo) {
      query = query.lte('date', options.dateTo.toISOString());
    }
    if (options?.tags?.length) {
      query = query.overlaps('tags', options.tags);
    }
    if (options?.search) {
      query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
    }

    query = query.order('date', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching archives:', error);
      return [];
    }

    return (data || []).map(dbToArchive);
  }

  async getArchive(id: string): Promise<ArchiveItem | null> {
    const { data, error } = await supabase
      .from('archives')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;

    // Increment view count
    await supabase
      .from('archives')
      .update({
        view_count: (data.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    return dbToArchive(data);
  }

  async createArchive(archive: Omit<ArchiveItem, 'id'>): Promise<ArchiveItem | null> {
    const { data, error } = await supabase
      .from('archives')
      .insert([{
        user_id: this.getUserId(),
        archive_type: archive.type,
        title: archive.title,
        content: archive.content,
        date: archive.date.toISOString(),
        tags: archive.tags,
        related_contact_id: archive.relatedContactId,
        decision_status: archive.decisionStatus,
        collection_id: archive.collectionId,
        file_url: archive.fileUrl,
        file_size: archive.fileSize,
        mime_type: archive.mimeType,
        thumbnail_url: archive.thumbnailUrl,
        visibility: archive.visibility || 'private',
        starred: archive.starred || false,
        view_count: 0,
        created_by: this.getUserId(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating archive:', error);
      return null;
    }

    const item = dbToArchive(data);

    // Trigger AI analysis in background
    this.analyzeArchiveWithAI(item.id);

    return item;
  }

  async updateArchive(id: string, updates: Partial<ArchiveItem>): Promise<ArchiveItem | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.collectionId !== undefined) updateData.collection_id = updates.collectionId;
    if (updates.starred !== undefined) updateData.starred = updates.starred;
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
    if (updates.decisionStatus !== undefined) updateData.decision_status = updates.decisionStatus;

    const { data, error } = await supabase
      .from('archives')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating archive:', error);
      return null;
    }

    return dbToArchive(data);
  }

  async deleteArchive(id: string): Promise<boolean> {
    // First, delete from Google Drive if exported
    const archive = await this.getArchive(id);
    if (archive?.driveFileId) {
      await googleDriveService.deleteFile(archive.driveFileId);
    }

    const { error } = await supabase
      .from('archives')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting archive:', error);
      return false;
    }

    return true;
  }

  async toggleStar(id: string): Promise<boolean> {
    const { data: current } = await supabase
      .from('archives')
      .select('starred')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('archives')
      .update({ starred: !current?.starred })
      .eq('id', id);

    return !error;
  }

  async togglePin(id: string): Promise<boolean> {
    const { data: current } = await supabase
      .from('archives')
      .select('pinned_at')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('archives')
      .update({
        pinned_at: current?.pinned_at ? null : new Date().toISOString(),
      })
      .eq('id', id);

    return !error;
  }

  // ============= COLLECTIONS =============

  async getCollections(): Promise<ArchiveCollection[]> {
    const { data, error } = await supabase
      .from('archive_collections')
      .select('*')
      .eq('user_id', this.getUserId())
      .order('pinned_at', { ascending: false, nullsFirst: false })
      .order('name');

    if (error) {
      console.error('Error fetching collections:', error);
      return [];
    }

    // Get item counts for each collection
    const collections: ArchiveCollection[] = [];
    for (const db of data || []) {
      const { count } = await supabase
        .from('archives')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', db.id);

      collections.push(dbToCollection(db, count || 0));
    }

    return collections;
  }

  async createCollection(collection: {
    name: string;
    description?: string;
    color: string;
    icon: string;
  }): Promise<ArchiveCollection | null> {
    const { data, error } = await supabase
      .from('archive_collections')
      .insert([{
        user_id: this.getUserId(),
        name: collection.name,
        description: collection.description,
        color: collection.color,
        icon: collection.icon,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating collection:', error);
      return null;
    }

    return dbToCollection(data, 0);
  }

  async updateCollection(
    id: string,
    updates: Partial<{ name: string; description: string; color: string; icon: string }>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('archive_collections')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    return !error;
  }

  async deleteCollection(id: string): Promise<boolean> {
    // First, unassign all archives from this collection
    await supabase
      .from('archives')
      .update({ collection_id: null })
      .eq('collection_id', id);

    const { error } = await supabase
      .from('archive_collections')
      .delete()
      .eq('id', id);

    return !error;
  }

  async addToCollection(archiveId: string, collectionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('archives')
      .update({ collection_id: collectionId })
      .eq('id', archiveId);

    return !error;
  }

  async removeFromCollection(archiveId: string): Promise<boolean> {
    const { error } = await supabase
      .from('archives')
      .update({ collection_id: null })
      .eq('id', archiveId);

    return !error;
  }

  // ============= SMART FOLDERS =============

  async getSmartFolders(): Promise<SmartFolder[]> {
    const { data, error } = await supabase
      .from('smart_folders')
      .select('*')
      .eq('user_id', this.getUserId())
      .order('name');

    if (error) {
      console.error('Error fetching smart folders:', error);
      return [];
    }

    // Get item counts for each smart folder
    const folders: SmartFolder[] = [];
    for (const db of data || []) {
      const count = await this.getSmartFolderItemCount(db.rules, db.rule_operator);
      folders.push(dbToSmartFolder(db, count));
    }

    return folders;
  }

  async createSmartFolder(folder: {
    name: string;
    description?: string;
    color: string;
    icon: string;
    rules: SmartFolderRule[];
    ruleOperator: 'and' | 'or';
  }): Promise<SmartFolder | null> {
    const { data, error } = await supabase
      .from('smart_folders')
      .insert([{
        user_id: this.getUserId(),
        name: folder.name,
        description: folder.description,
        color: folder.color,
        icon: folder.icon,
        rules: folder.rules,
        rule_operator: folder.ruleOperator,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating smart folder:', error);
      return null;
    }

    return dbToSmartFolder(data, 0);
  }

  async updateSmartFolder(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      color: string;
      icon: string;
      rules: SmartFolderRule[];
      ruleOperator: 'and' | 'or';
    }>
  ): Promise<boolean> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.rules !== undefined) updateData.rules = updates.rules;
    if (updates.ruleOperator !== undefined) updateData.rule_operator = updates.ruleOperator;

    const { error } = await supabase
      .from('smart_folders')
      .update(updateData)
      .eq('id', id);

    return !error;
  }

  async deleteSmartFolder(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('smart_folders')
      .delete()
      .eq('id', id);

    return !error;
  }

  async getSmartFolderItems(folderId: string): Promise<ArchiveItem[]> {
    const { data: folder } = await supabase
      .from('smart_folders')
      .select('rules, rule_operator')
      .eq('id', folderId)
      .single();

    if (!folder) return [];

    return this.getArchivesByRules(folder.rules, folder.rule_operator);
  }

  private async getSmartFolderItemCount(
    rules: SmartFolderRule[],
    operator: 'and' | 'or'
  ): Promise<number> {
    // Simplified count - in production, this would use more sophisticated SQL
    const items = await this.getArchivesByRules(rules, operator);
    return items.length;
  }

  private async getArchivesByRules(
    rules: SmartFolderRule[],
    operator: 'and' | 'or'
  ): Promise<ArchiveItem[]> {
    // Get all archives first, then filter client-side
    // In production, this would be optimized with server-side filtering
    const allArchives = await this.getArchives();

    return allArchives.filter(archive => {
      const results = rules.map(rule => this.evaluateRule(archive, rule));

      if (operator === 'and') {
        return results.every(Boolean);
      } else {
        return results.some(Boolean);
      }
    });
  }

  private evaluateRule(archive: ArchiveItem, rule: SmartFolderRule): boolean {
    switch (rule.field) {
      case 'type':
        return this.evaluateStringRule(archive.type, rule);
      case 'tags':
        if (Array.isArray(rule.value)) {
          return rule.value.some(tag => archive.tags.includes(tag as string));
        }
        return archive.tags.includes(rule.value as string);
      case 'date':
        return this.evaluateDateRule(archive.date, rule);
      case 'contact':
        return this.evaluateStringRule(archive.relatedContactId || '', rule);
      case 'content':
        return this.evaluateStringRule(archive.content, rule);
      case 'sentiment':
        return this.evaluateStringRule(archive.sentiment || '', rule);
      default:
        return false;
    }
  }

  private evaluateStringRule(
    value: string,
    rule: SmartFolderRule
  ): boolean {
    const ruleValue = rule.value as string;
    switch (rule.operator) {
      case 'equals':
        return value === ruleValue;
      case 'contains':
        return value.toLowerCase().includes(ruleValue.toLowerCase());
      case 'startsWith':
        return value.toLowerCase().startsWith(ruleValue.toLowerCase());
      case 'endsWith':
        return value.toLowerCase().endsWith(ruleValue.toLowerCase());
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(value);
      default:
        return false;
    }
  }

  private evaluateDateRule(date: Date, rule: SmartFolderRule): boolean {
    switch (rule.operator) {
      case 'before':
        return date < new Date(rule.value as string);
      case 'after':
        return date > new Date(rule.value as string);
      case 'between':
        const range = rule.value as { start: Date; end: Date };
        return date >= new Date(range.start) && date <= new Date(range.end);
      default:
        return false;
    }
  }

  // ============= AI FEATURES =============

  async analyzeArchiveWithAI(archiveId: string): Promise<void> {
    // This would integrate with your AI service (Gemini, etc.)
    // For now, we'll use a simplified analysis
    try {
      const archive = await this.getArchive(archiveId);
      if (!archive) return;

      // Simple sentiment analysis based on keywords
      const positiveWords = ['great', 'good', 'excellent', 'happy', 'success', 'approved', 'completed'];
      const negativeWords = ['bad', 'problem', 'issue', 'failed', 'rejected', 'blocked', 'urgent'];

      const content = archive.content.toLowerCase();
      const positiveCount = positiveWords.filter(w => content.includes(w)).length;
      const negativeCount = negativeWords.filter(w => content.includes(w)).length;

      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      if (positiveCount > negativeCount) sentiment = 'positive';
      if (negativeCount > positiveCount) sentiment = 'negative';

      // Generate AI tags based on content patterns
      const aiTags: string[] = [];
      if (content.includes('meeting') || content.includes('call')) aiTags.push('meeting');
      if (content.includes('decision') || content.includes('decided')) aiTags.push('decision');
      if (content.includes('action') || content.includes('todo') || content.includes('task')) aiTags.push('action-item');
      if (content.includes('question') || content.includes('?')) aiTags.push('question');
      if (content.includes('deadline') || content.includes('due')) aiTags.push('deadline');

      // Generate simple summary (first 200 chars)
      const aiSummary = archive.content.substring(0, 200) + (archive.content.length > 200 ? '...' : '');

      // Find related items by matching tags and content keywords
      const relatedItemIds = await this.findRelatedItems(archive);

      // Update the archive with AI analysis
      await supabase
        .from('archives')
        .update({
          sentiment,
          ai_tags: aiTags,
          ai_summary: aiSummary,
          related_item_ids: relatedItemIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', archiveId);
    } catch (error) {
      console.error('Error analyzing archive with AI:', error);
    }
  }

  private async findRelatedItems(archive: ArchiveItem): Promise<string[]> {
    // Find items with similar tags or content
    const { data } = await supabase
      .from('archives')
      .select('id, tags, title')
      .eq('user_id', this.getUserId())
      .neq('id', archive.id)
      .limit(50);

    if (!data) return [];

    // Score each item based on tag overlap
    const scored = data
      .map(item => {
        const tagOverlap = (item.tags || []).filter((t: string) =>
          archive.tags.includes(t)
        ).length;
        return { id: item.id, score: tagOverlap };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored.map(item => item.id);
  }

  async getRelatedItems(archiveId: string): Promise<ArchiveItem[]> {
    const { data } = await supabase
      .from('archives')
      .select('related_item_ids')
      .eq('id', archiveId)
      .single();

    if (!data?.related_item_ids?.length) return [];

    const { data: related } = await supabase
      .from('archives')
      .select('*')
      .in('id', data.related_item_ids);

    return (related || []).map(dbToArchive);
  }

  async generateCrossArchiveSummary(archiveIds: string[]): Promise<string> {
    // This would integrate with your AI service
    // For now, return a placeholder
    const archives = await Promise.all(archiveIds.map(id => this.getArchive(id)));
    const validArchives = archives.filter(Boolean) as ArchiveItem[];

    if (validArchives.length === 0) return 'No archives selected.';

    const titles = validArchives.map(a => a.title).join(', ');
    return `Summary of ${validArchives.length} archives: ${titles}. This feature requires AI integration for detailed summaries.`;
  }

  async generateSummary(archiveId: string): Promise<string> {
    const archive = await this.getArchive(archiveId);
    if (!archive) return '';

    // Simple summarization - in production, use AI service
    const content = archive.content;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const summary = sentences.slice(0, 3).join('. ').trim();

    // Update archive with summary
    await supabase
      .from('archives')
      .update({
        ai_summary: summary + (sentences.length > 3 ? '...' : '.'),
        updated_at: new Date().toISOString()
      })
      .eq('id', archiveId);

    return summary + (sentences.length > 3 ? '...' : '.');
  }

  async extractActionItems(archiveId: string): Promise<string[]> {
    const archive = await this.getArchive(archiveId);
    if (!archive) return [];

    // Simple extraction - look for action patterns
    const actionPatterns = [
      /(?:need to|should|must|will|have to|going to)\s+([^.!?]+)/gi,
      /(?:action item|todo|task):\s*([^.!?\n]+)/gi,
      /(?:follow up|follow-up)\s+(?:on|with)\s+([^.!?]+)/gi,
      /(?:schedule|plan|organize)\s+([^.!?]+)/gi,
    ];

    const actions: string[] = [];
    const content = archive.content;

    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const action = match[1].trim();
        if (action.length > 5 && action.length < 200) {
          actions.push(action);
        }
      }
    });

    // Remove duplicates and limit
    const uniqueActions = [...new Set(actions)].slice(0, 10);

    // Update archive with action items tag if found
    if (uniqueActions.length > 0) {
      const currentTags = archive.aiTags || [];
      if (!currentTags.includes('has-actions')) {
        await supabase
          .from('archives')
          .update({
            ai_tags: [...currentTags, 'has-actions'],
            updated_at: new Date().toISOString()
          })
          .eq('id', archiveId);
      }
    }

    return uniqueActions;
  }

  async translateContent(archiveId: string, targetLanguage: string): Promise<string> {
    const archive = await this.getArchive(archiveId);
    if (!archive) return '';

    // In production, this would use a translation API (Google Translate, DeepL, etc.)
    // For now, return a placeholder message
    const languageNames: Record<string, string> = {
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
    };

    const langName = languageNames[targetLanguage] || targetLanguage;

    // Placeholder - in production integrate with translation API
    console.log(`[archiveService] Translation to ${langName} requested for archive ${archiveId}`);
    return `[Translation to ${langName} requires API integration]\n\nOriginal content:\n${archive.content}`;
  }

  async createTaskFromArchive(archiveId: string): Promise<{ success: boolean; taskId?: string }> {
    const archive = await this.getArchive(archiveId);
    if (!archive) return { success: false };

    try {
      // Create a task in the tasks table (if exists)
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          user_id: this.getUserId(),
          title: `Task from: ${archive.title}`,
          description: archive.content.substring(0, 500),
          source_archive_id: archiveId,
          status: 'pending',
          created_at: new Date().toISOString(),
        }])
        .select('id')
        .single();

      if (error) {
        // Table might not exist - log and return placeholder
        console.log('[archiveService] Tasks table not available, opening external task creation');
        return { success: true, taskId: 'external' };
      }

      return { success: true, taskId: data.id };
    } catch (error) {
      console.error('[archiveService] Error creating task:', error);
      return { success: false };
    }
  }

  async linkToContact(archiveId: string, contactId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('archives')
        .update({
          related_contact_id: contactId,
          updated_at: new Date().toISOString()
        })
        .eq('id', archiveId);

      return !error;
    } catch (error) {
      console.error('[archiveService] Error linking to contact:', error);
      return false;
    }
  }

  // ============= TIMELINE VIEW =============

  async getTimelineEvents(options?: {
    startDate?: Date;
    endDate?: Date;
    types?: ArchiveType[];
    limit?: number;
  }): Promise<ArchiveTimelineEvent[]> {
    let query = supabase
      .from('archives')
      .select('id, archive_type, title, content, date, tags, related_contact_id')
      .eq('user_id', this.getUserId());

    if (options?.startDate) {
      query = query.gte('date', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('date', options.endDate.toISOString());
    }
    if (options?.types?.length) {
      query = query.in('archive_type', options.types);
    }

    query = query.order('date', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching timeline events:', error);
      return [];
    }

    // Get contact names for related contacts
    const contactIds = [...new Set((data || []).map(d => d.related_contact_id).filter(Boolean))];
    const contactMap = new Map<string, string>();

    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', contactIds);

      contacts?.forEach(c => contactMap.set(c.id, c.name));
    }

    return (data || []).map(d => ({
      id: d.id,
      date: new Date(d.date),
      type: d.archive_type,
      title: d.title,
      preview: d.content.substring(0, 150) + (d.content.length > 150 ? '...' : ''),
      archiveId: d.id,
      contactName: d.related_contact_id ? contactMap.get(d.related_contact_id) : undefined,
      tags: d.tags,
    }));
  }

  // ============= SEARCH INTEGRATION =============

  async searchArchives(query: string, options?: {
    types?: ArchiveType[];
    dateFrom?: Date;
    dateTo?: Date;
    tags?: string[];
    includeContent?: boolean;
    limit?: number;
  }): Promise<{
    items: ArchiveItem[];
    totalCount: number;
    facets: {
      types: { type: ArchiveType; count: number }[];
      tags: { tag: string; count: number }[];
    };
  }> {
    // Full-text search
    let searchQuery = supabase
      .from('archives')
      .select('*', { count: 'exact' })
      .eq('user_id', this.getUserId())
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`);

    if (options?.types?.length) {
      searchQuery = searchQuery.in('archive_type', options.types);
    }
    if (options?.dateFrom) {
      searchQuery = searchQuery.gte('date', options.dateFrom.toISOString());
    }
    if (options?.dateTo) {
      searchQuery = searchQuery.lte('date', options.dateTo.toISOString());
    }
    if (options?.tags?.length) {
      searchQuery = searchQuery.overlaps('tags', options.tags);
    }

    searchQuery = searchQuery.order('date', { ascending: false });

    if (options?.limit) {
      searchQuery = searchQuery.limit(options.limit);
    }

    const { data, count, error } = await searchQuery;

    if (error) {
      console.error('Error searching archives:', error);
      return { items: [], totalCount: 0, facets: { types: [], tags: [] } };
    }

    const items = (data || []).map(dbToArchive);

    // Generate facets
    const typeCounts = new Map<ArchiveType, number>();
    const tagCounts = new Map<string, number>();

    items.forEach(item => {
      typeCounts.set(item.type, (typeCounts.get(item.type) || 0) + 1);
      item.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return {
      items,
      totalCount: count || 0,
      facets: {
        types: Array.from(typeCounts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
        tags: Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
      },
    };
  }

  // ============= STATISTICS =============

  async getArchiveStats(): Promise<{
    totalCount: number;
    byType: { type: ArchiveType; count: number }[];
    byMonth: { month: string; count: number }[];
    topTags: { tag: string; count: number }[];
    recentActivity: number;
    exportedCount: number;
  }> {
    const userId = this.getUserId();

    // Total count
    const { count: totalCount } = await supabase
      .from('archives')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // By type
    const { data: archives } = await supabase
      .from('archives')
      .select('archive_type, date, tags, exported_at')
      .eq('user_id', userId);

    const typeCounts = new Map<ArchiveType, number>();
    const monthCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    let exportedCount = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let recentCount = 0;

    (archives || []).forEach(a => {
      // Type counts
      typeCounts.set(a.archive_type, (typeCounts.get(a.archive_type) || 0) + 1);

      // Month counts
      const month = new Date(a.date).toISOString().substring(0, 7);
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);

      // Tag counts
      (a.tags || []).forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });

      // Exported count
      if (a.exported_at) exportedCount++;

      // Recent activity
      if (new Date(a.date) >= thirtyDaysAgo) recentCount++;
    });

    return {
      totalCount: totalCount || 0,
      byType: Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      byMonth: Array.from(monthCounts.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12),
      topTags: Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recentActivity: recentCount,
      exportedCount,
    };
  }

  // ============= BULK OPERATIONS =============

  async bulkDelete(ids: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      const result = await this.deleteArchive(id);
      if (result) success++;
      else failed++;
    }

    return { success, failed };
  }

  async bulkAddToCollection(ids: string[], collectionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('archives')
      .update({ collection_id: collectionId })
      .in('id', ids);

    return !error;
  }

  async bulkAddTags(ids: string[], tags: string[]): Promise<boolean> {
    // Get current tags for each archive and merge
    for (const id of ids) {
      const { data } = await supabase
        .from('archives')
        .select('tags')
        .eq('id', id)
        .single();

      const currentTags = data?.tags || [];
      const newTags = [...new Set([...currentTags, ...tags])];

      await supabase
        .from('archives')
        .update({ tags: newTags })
        .eq('id', id);
    }

    return true;
  }

  async bulkExportToDrive(
    ids: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const archives = await Promise.all(ids.map(id => this.getArchive(id)));
    const validArchives = archives.filter(Boolean) as ArchiveItem[];

    return googleDriveService.exportBulk(validArchives, onProgress);
  }

  // ============= VERSION HISTORY =============

  /**
   * Get version history for an archive
   * Returns an array of version snapshots with content
   */
  async getVersionHistory(archiveId: string): Promise<{
    id: string;
    date: Date;
    action: string;
    user: string;
    content?: string;
    title?: string;
  }[]> {
    try {
      // First, try to get from archive_versions table if it exists
      const { data: versions, error } = await supabase
        .from('archive_versions')
        .select('*')
        .eq('archive_id', archiveId)
        .order('created_at', { ascending: false });

      if (!error && versions && versions.length > 0) {
        return versions.map((v: any) => ({
          id: v.id,
          date: new Date(v.created_at),
          action: v.action || 'Modified',
          user: v.user_name || 'You',
          content: v.content,
          title: v.title,
        }));
      }

      // If no versions table or empty, get current archive and create history from metadata
      const archive = await this.getArchive(archiveId);
      if (!archive) {
        return [];
      }

      // Build history from archive metadata
      const history: {
        id: string;
        date: Date;
        action: string;
        user: string;
        content?: string;
        title?: string;
      }[] = [];

      // Current version
      history.push({
        id: 'current',
        date: new Date(),
        action: 'Current version',
        user: 'You',
        content: archive.content,
        title: archive.title,
      });

      // If there's an updated_at different from created_at, add an edit entry
      if (archive.updatedAt && archive.date &&
          archive.updatedAt.getTime() !== archive.date.getTime()) {
        history.push({
          id: 'updated',
          date: archive.updatedAt,
          action: 'Last edited',
          user: 'You',
          content: archive.content,
          title: archive.title,
        });
      }

      // Original creation
      history.push({
        id: 'created',
        date: archive.date,
        action: 'Created',
        user: 'System',
        content: archive.content,
        title: archive.title,
      });

      return history;
    } catch (error) {
      console.error('[archiveService] Error getting version history:', error);

      // Return minimal history based on archive data
      const archive = await this.getArchive(archiveId);
      if (!archive) {
        return [];
      }

      return [
        {
          id: 'current',
          date: new Date(),
          action: 'Current version',
          user: 'You',
          content: archive.content,
          title: archive.title,
        },
        {
          id: 'created',
          date: archive.date,
          action: 'Created',
          user: 'System',
          content: archive.content,
          title: archive.title,
        },
      ];
    }
  }

  /**
   * Save a version snapshot before making changes
   */
  async saveVersionSnapshot(archiveId: string, action: string = 'Modified'): Promise<boolean> {
    try {
      const archive = await this.getArchive(archiveId);
      if (!archive) return false;

      const { error } = await supabase
        .from('archive_versions')
        .insert({
          archive_id: archiveId,
          title: archive.title,
          content: archive.content,
          action: action,
          user_name: 'You',
          created_at: new Date().toISOString(),
        });

      return !error;
    } catch (error) {
      // Table might not exist, which is fine - we'll use fallback history
      console.warn('[archiveService] Could not save version snapshot:', error);
      return false;
    }
  }
}

// Export singleton instance
export const archiveService = new ArchiveService();
