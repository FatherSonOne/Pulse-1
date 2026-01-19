// src/services/voiceRoomService.ts
import { supabase } from './supabase';
import { dataService } from './dataService';

export interface VoiceRoom {
  id: string;
  name: string;
  icon?: string;
  color: string;
  participants: Array<{
    userId: string;
    userName: string;
    avatarColor?: string;
    joinedAt?: Date;
    isMuted?: boolean;
    isSpeaking?: boolean;
  }>;
  maxParticipants: number;
  isPrivate: boolean;
  category?: string;
  description?: string;
  createdAt?: Date;
  settings: {
    bitrate?: number;
    voiceActivity?: boolean;
    echoCancel?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
  };
}

export const voiceRoomService = {
  // ==================== ROOMS ====================

  async getRooms(): Promise<VoiceRoom[]> {
    const userId = dataService.getUserId();
    const { data, error } = await supabase
      .from('voice_rooms')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching voice rooms:', error);
      return [];
    }

    // Load participants for each room
    const rooms: VoiceRoom[] = [];
    for (const room of data || []) {
      const { data: participants } = await supabase
        .from('voice_room_participants')
        .select('*')
        .eq('room_id', room.id);

      rooms.push({
        id: room.id,
        name: room.name,
        icon: room.icon,
        color: room.color,
        participants: (participants || []).map((p: any) => ({
          userId: p.user_id,
          userName: p.user_name,
          avatarColor: p.avatar_color,
          joinedAt: p.joined_at ? new Date(p.joined_at) : undefined,
          isMuted: p.is_muted,
          isSpeaking: p.is_speaking,
        })),
        maxParticipants: room.max_participants,
        isPrivate: room.is_private,
        category: room.category,
        description: room.description,
        createdAt: room.created_at ? new Date(room.created_at) : undefined,
        settings: room.settings || {},
      });
    }

    return rooms;
  },

  async createRoom(room: Omit<VoiceRoom, 'id' | 'participants' | 'createdAt'>): Promise<VoiceRoom | null> {
    const userId = dataService.getUserId();
    const { data, error } = await supabase
      .from('voice_rooms')
      .insert([{
        user_id: userId,
        name: room.name,
        icon: room.icon,
        color: room.color,
        max_participants: room.maxParticipants,
        is_private: room.isPrivate,
        category: room.category,
        description: room.description,
        settings: room.settings,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating voice room:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      color: data.color,
      participants: [],
      maxParticipants: data.max_participants,
      isPrivate: data.is_private,
      category: data.category,
      description: data.description,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      settings: data.settings || {},
    };
  },

  async updateRoom(id: string, updates: Partial<VoiceRoom>): Promise<VoiceRoom | null> {
    const { data, error } = await supabase
      .from('voice_rooms')
      .update({
        name: updates.name,
        icon: updates.icon,
        color: updates.color,
        max_participants: updates.maxParticipants,
        is_private: updates.isPrivate,
        category: updates.category,
        description: updates.description,
        settings: updates.settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating voice room:', error);
      return null;
    }

    // Load participants
    const { data: participants } = await supabase
      .from('voice_room_participants')
      .select('*')
      .eq('room_id', id);

    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      color: data.color,
      participants: (participants || []).map((p: any) => ({
        userId: p.user_id,
        userName: p.user_name,
        avatarColor: p.avatar_color,
        joinedAt: p.joined_at ? new Date(p.joined_at) : undefined,
        isMuted: p.is_muted,
        isSpeaking: p.is_speaking,
      })),
      maxParticipants: data.max_participants,
      isPrivate: data.is_private,
      category: data.category,
      description: data.description,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      settings: data.settings || {},
    };
  },

  async deleteRoom(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('voice_rooms')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting voice room:', error);
      return false;
    }
    return true;
  },

  // ==================== PARTICIPANTS ====================

  async joinRoom(roomId: string, userId: string, userName: string, avatarColor?: string): Promise<boolean> {
    const { error } = await supabase
      .from('voice_room_participants')
      .upsert({
        room_id: roomId,
        user_id: userId,
        user_name: userName,
        avatar_color: avatarColor,
        joined_at: new Date().toISOString(),
      }, {
        onConflict: 'room_id,user_id',
      });

    if (error) {
      console.error('Error joining room:', error);
      return false;
    }
    return true;
  },

  async leaveRoom(roomId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('voice_room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error leaving room:', error);
      return false;
    }
    return true;
  },

  async updateParticipant(
    roomId: string,
    userId: string,
    updates: { isMuted?: boolean; isSpeaking?: boolean }
  ): Promise<boolean> {
    const { error } = await supabase
      .from('voice_room_participants')
      .update({
        is_muted: updates.isMuted,
        is_speaking: updates.isSpeaking,
      })
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating participant:', error);
      return false;
    }
    return true;
  },
};
