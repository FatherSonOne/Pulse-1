// User Contact and Presence Types
// Types for managing contact annotations and online presence

export type OnlineStatus = 'online' | 'offline' | 'away' | 'busy';

export interface UserPresence {
  userId: string;
  status: OnlineStatus;
  lastActiveAt: Date;
  lastSeenAt: Date;
}

export interface UserContactAnnotation {
  id: string;
  userId: string;
  targetUserId: string;
  
  // Custom fields (private to userId)
  nickname?: string;
  customNotes?: string;
  customTags?: string[];
  customPhone?: string;
  customEmail?: string;
  customBirthday?: Date;
  customCompany?: string;
  customRole?: string;
  customAddress?: string;
  
  // Relationship metadata
  isFavorite: boolean;
  isBlocked: boolean;
  lastInteractionAt?: Date;
  interactionCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface PulseUserProfile {
  id: string;
  handle?: string;
  displayName?: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  phoneNumber?: string;  // Changed from phone to match DB
  email?: string;
  company?: string;
  role?: string;
  location?: string;
  birthday?: Date;
  isVerified: boolean;
  isPublic?: boolean;
  
  // Presence
  onlineStatus: OnlineStatus;
  lastActiveAt: Date | null;
  lastSeenAt?: Date | null;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EnrichedUserProfile extends PulseUserProfile {
  // User's private annotations about this profile
  annotation?: UserContactAnnotation;
}

export interface UpdateAnnotationParams {
  targetUserId: string;
  nickname?: string;
  customNotes?: string;
  customTags?: string[];
  customPhone?: string;
  customEmail?: string;
  customBirthday?: Date;
  customCompany?: string;
  customRole?: string;
  customAddress?: string;
  isFavorite?: boolean;
  isBlocked?: boolean;
}

export interface LastActiveStatus {
  status: 'active_now' | 'minutes_ago' | 'hours_ago' | 'days_ago' | 'unknown';
  text: string; // e.g., "Active 5m ago", "Active now"
  timestamp?: Date;
}
