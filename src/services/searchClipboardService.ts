import { supabase } from './supabase';

export interface ClipboardItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  contentType: 'note' | 'message' | 'conversation' | 'snippet' | 'reminder';
  sourceType?: string;
  sourceId?: string;
  sourceUrl?: string;
  tags: string[];
  category?: string;
  pinned: boolean;
  relatedItems: Array<{ type: string; id: string }>;
  conversationId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  positionX?: number;
  positionY?: number;
  color?: string;
}

export class SearchClipboardService {
  /**
   * Get all clipboard items for a user
   */
  async getClipboardItems(userId: string, filters?: {
    category?: string;
    pinned?: boolean;
    tags?: string[];
  }): Promise<ClipboardItem[]> {
    let query = supabase
      .from('search_clipboard')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.pinned !== undefined) {
      query = query.eq('pinned', filters.pinned);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    try {
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching clipboard items:', error);
        return [];
      }

      return (data || []).map(this.dbToClipboardItem);
    } catch (err: any) {
      console.error('Error fetching clipboard items:', {
        message: err.message,
        details: err.toString(),
        hint: 'This may be due to network connectivity or Supabase configuration issues.',
        code: err.code || '',
      });
      return [];
    }
  }

  /**
   * Create a new clipboard item
   */
  async createClipboardItem(
    userId: string,
    item: Omit<ClipboardItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<ClipboardItem | null> {
    const { data, error } = await supabase
      .from('search_clipboard')
      .insert([{
        user_id: userId,
        title: item.title,
        content: item.content,
        content_type: item.contentType,
        source_type: item.sourceType,
        source_id: item.sourceId,
        source_url: item.sourceUrl,
        tags: item.tags || [],
        category: item.category,
        pinned: item.pinned || false,
        related_items: item.relatedItems || [],
        conversation_id: item.conversationId,
        metadata: item.metadata || {},
        position_x: item.positionX,
        position_y: item.positionY,
        color: item.color || '#FFD700',
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating clipboard item:', error);
      return null;
    }

    return this.dbToClipboardItem(data);
  }

  /**
   * Update a clipboard item
   */
  async updateClipboardItem(
    userId: string,
    itemId: string,
    updates: Partial<ClipboardItem>
  ): Promise<boolean> {
    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.contentType !== undefined) updateData.content_type = updates.contentType;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.pinned !== undefined) updateData.pinned = updates.pinned;
    if (updates.relatedItems !== undefined) updateData.related_items = updates.relatedItems;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    if (updates.positionX !== undefined) updateData.position_x = updates.positionX;
    if (updates.positionY !== undefined) updateData.position_y = updates.positionY;
    if (updates.color !== undefined) updateData.color = updates.color;

    const { error } = await supabase
      .from('search_clipboard')
      .update(updateData)
      .eq('id', itemId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Delete a clipboard item
   */
  async deleteClipboardItem(userId: string, itemId: string): Promise<boolean> {
    const { error } = await supabase
      .from('search_clipboard')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Link two clipboard items together
   */
  async linkItems(userId: string, itemId1: string, itemId2: string): Promise<boolean> {
    try {
      const [item1, item2] = await Promise.all([
        this.getClipboardItem(userId, itemId1),
        this.getClipboardItem(userId, itemId2),
      ]);

      if (!item1 || !item2) return false;

      // Add each other to related items
      const related1 = item1.relatedItems || [];
      if (!related1.find((r: any) => r.id === itemId2)) {
        related1.push({ type: 'clipboard', id: itemId2 });
      }

      const related2 = item2.relatedItems || [];
      if (!related2.find((r: any) => r.id === itemId1)) {
        related2.push({ type: 'clipboard', id: itemId1 });
      }

      await Promise.all([
        this.updateClipboardItem(userId, itemId1, { relatedItems: related1 }),
        this.updateClipboardItem(userId, itemId2, { relatedItems: related2 }),
      ]);

      return true;
    } catch (error) {
      console.error('Error linking items:', error);
      return false;
    }
  }

  /**
   * Get a single clipboard item
   */
  async getClipboardItem(userId: string, itemId: string): Promise<ClipboardItem | null> {
    const { data, error } = await supabase
      .from('search_clipboard')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return this.dbToClipboardItem(data);
  }

  /**
   * Add item from search result to clipboard
   */
  async clipSearchResult(
    userId: string,
    searchResult: {
      id: string;
      type: string;
      title: string;
      content: string;
      timestamp: Date;
      source?: string;
      sender?: string;
      metadata?: Record<string, any>;
    },
    options?: {
      category?: string;
      tags?: string[];
      note?: string;
    }
  ): Promise<ClipboardItem | null> {
    return this.createClipboardItem(userId, {
      title: options?.note || searchResult.title,
      content: searchResult.content,
      contentType: 'snippet',
      sourceType: searchResult.type,
      sourceId: searchResult.id,
      tags: options?.tags || [],
      category: options?.category,
      pinned: false,
      relatedItems: [],
      metadata: {
        originalTitle: searchResult.title,
        timestamp: searchResult.timestamp.toISOString(),
        source: searchResult.source,
        sender: searchResult.sender,
        ...searchResult.metadata,
      },
    });
  }

  /**
   * Convert database row to ClipboardItem
   */
  private dbToClipboardItem(db: any): ClipboardItem {
    return {
      id: db.id,
      userId: db.user_id,
      title: db.title,
      content: db.content,
      contentType: db.content_type,
      sourceType: db.source_type,
      sourceId: db.source_id,
      sourceUrl: db.source_url,
      tags: db.tags || [],
      category: db.category,
      pinned: db.pinned || false,
      relatedItems: db.related_items || [],
      conversationId: db.conversation_id,
      metadata: db.metadata || {},
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at),
      positionX: db.position_x,
      positionY: db.position_y,
      color: db.color || '#FFD700',
    };
  }
}

export const searchClipboardService = new SearchClipboardService();