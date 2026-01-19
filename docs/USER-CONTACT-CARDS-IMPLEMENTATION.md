# User Contact Cards & Online Presence - Implementation Guide

## Overview

This implementation adds two major features to Pulse:

1. **User Contact Cards** - Clickable user profiles with private annotations
2. **Online/Offline Presence** - Real-time user status tracking

## Features Implemented

### 1. Contact Card System

#### What It Does
- Click on any user's avatar/picture in messages to view their contact card
- Shows public profile information (name, handle, email, phone, bio)
- Allows users to add **private notes** that only they can see
- Each user's contact cards are unique to them
- Example: You can call your wife "Babe" instead of "@magan"

#### Private Annotations Include:
- **Nickname** - Custom name visible only to you
- **Personal Notes** - Private notes about the contact
- **Additional Contact Info** - Extra phone, email, address
- **Company & Role** - Their job information
- **Favorite Status** - Mark important contacts
- **Tags** - Custom tags for organization

### 2. Online Presence System

#### What It Does
- Shows whether a user is currently active on Pulse
- Displays last active time (e.g., "Active 5m ago", "Active 2h ago")
- Real-time updates when users go online/offline
- Green dot indicator for online users
- Gray dot for offline users

#### How It Works:
- **Automatic Tracking** - Presence is tracked automatically when users are logged in
- **Heartbeat System** - Updates every 60 seconds to maintain online status
- **Visibility Detection** - Goes to "away" when browser tab is inactive
- **Auto-Offline** - Users marked offline after 5 minutes of inactivity

## Database Schema

### New Tables

#### `user_contact_annotations`
Stores user-specific customizations about other Pulse users.

```sql
CREATE TABLE user_contact_annotations (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id),
    
    -- Custom fields (private to user_id)
    nickname TEXT,
    custom_notes TEXT,
    custom_tags TEXT[],
    custom_phone TEXT,
    custom_email TEXT,
    custom_birthday DATE,
    custom_company TEXT,
    custom_role TEXT,
    custom_address TEXT,
    
    -- Relationship metadata
    is_favorite BOOLEAN,
    is_blocked BOOLEAN,
    last_interaction_at TIMESTAMPTZ,
    interaction_count INTEGER,
    
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    
    UNIQUE(user_id, target_user_id)
);
```

### Enhanced Tables

#### `user_profiles` (Enhanced)
Added presence tracking columns:

```sql
-- New columns added to existing user_profiles table
online_status TEXT DEFAULT 'offline',  -- 'online', 'offline', 'away', 'busy'
last_active_at TIMESTAMPTZ,           -- Last activity timestamp
```

## Files Created

### Database Migration
- **`supabase/migrations/012_user_contact_annotations_and_presence.sql`**
  - Creates user_contact_annotations table
  - Adds presence columns to user_profiles
  - Includes SQL functions for managing annotations and presence

### TypeScript Types
- **`src/types/userContact.ts`**
  - `UserContactAnnotation` - Private annotation data
  - `PulseUserProfile` - Enhanced user profile with presence
  - `EnrichedUserProfile` - Profile + annotations
  - `OnlineStatus` - Status type definition
  - `LastActiveStatus` - Human-readable status

### Services
- **`src/services/userContactService.ts`**
  - `getAnnotation()` - Get user's annotation for a contact
  - `updateAnnotation()` - Update/create annotations
  - `deleteAnnotation()` - Remove annotation
  - `getFavorites()` - Get favorite contacts
  - `getEnrichedProfile()` - Get profile with annotations
  - `updatePresence()` - Update user's online status
  - `startPresenceHeartbeat()` - Automatic presence tracking
  - `getPresence()` - Get user's current status
  - `subscribeToPresence()` - Real-time presence updates

### React Hooks
- **`src/hooks/usePresence.ts`**
  - `usePresence()` - Manages current user's presence
  - `useUserPresence(userId)` - Tracks another user's presence
  - `useOnlineUsersCount()` - Gets total online users

### Components
- **`src/components/UserContact/UserContactCard.tsx`**
  - Main contact card modal component
  - Shows profile info and private annotations
  - Edit mode for adding/updating notes
  
- **`src/components/UserContact/UserContactCard.css`**
  - Styling for contact card
  
- **`src/components/UserContact/OnlineIndicator.tsx`**
  - `OnlineIndicator` - Status dot component
  - `OnlineStatusBadge` - Status badge with text
  
- **`src/components/UserContact/OnlineIndicator.css`**
  - Styling for presence indicators
  
- **`src/components/UserContact/index.ts`**
  - Module exports

### Integration Points

#### Updated Files:
1. **`src/components/Messages/MessageChat.tsx`**
   - Made user avatars clickable
   - Opens UserContactCard on click
   - Shows contact details modal

2. **`src/App.tsx`**
   - Added `usePresence()` hook to start presence tracking
   - Automatically tracks user activity

## Usage Examples

### 1. Viewing a Contact Card

In any message view:
```tsx
// Click on user avatar -> Opens contact card automatically
<button onClick={() => setSelectedUserId(message.sender_id)}>
  <img src={avatar} />
</button>

{selectedUserId && (
  <UserContactCard
    userId={selectedUserId}
    onClose={() => setSelectedUserId(null)}
  />
)}
```

### 2. Adding Private Notes

1. Click on a user's avatar
2. Click "Edit" in the "My Private Notes" section
3. Add nickname, notes, or additional info
4. Click "Save"

### 3. Showing Online Status

```tsx
import { OnlineIndicator, OnlineStatusBadge } from '../UserContact';

// Simple dot indicator
<OnlineIndicator userId={userId} size="medium" />

// Badge with text
<OnlineStatusBadge userId={userId} />

// Dot with text
<OnlineIndicator userId={userId} showText={true} />
```

### 4. Tracking Presence

```tsx
import { useUserPresence } from '../../hooks/usePresence';

function UserItem({ userId }) {
  const { isOnline, lastActive, loading } = useUserPresence(userId);
  
  return (
    <div>
      <span>{isOnline ? 'Online' : lastActive.text}</span>
    </div>
  );
}
```

## Database Functions

### Annotation Management

#### `get_or_create_annotation(user_id, target_user_id)`
Gets existing annotation or creates a new one.

#### `update_contact_annotation(...)`
Updates annotation with new values.

#### `get_enriched_user_profile(requesting_user_id, target_user_id)`
Returns user profile with requesting user's annotations merged in.

### Presence Management

#### `update_user_presence(user_id, status)`
Updates user's online status and last_active_at timestamp.

#### `mark_inactive_users(timeout_minutes)`
Marks users as offline if inactive for specified minutes.

#### `get_online_users_count()`
Returns count of currently online users.

#### `get_last_active_status(user_id)`
Returns human-readable status like "Active 5m ago".

## Security & Privacy

### Row Level Security (RLS)

#### user_contact_annotations
- Users can ONLY see their own annotations
- Users can ONLY create/update/delete their own annotations
- Target users CANNOT see annotations others made about them

```sql
-- Users can only view own annotations
CREATE POLICY "Users can view own annotations"
    ON user_contact_annotations FOR SELECT
    USING (user_id = auth.uid());
```

#### user_profiles
- Public profiles viewable by everyone
- Private profiles only viewable by owner
- Online status is public information

## Performance Considerations

### Presence Heartbeat
- Updates every 60 seconds (configurable)
- Uses efficient UPDATE query
- Minimal database load

### Real-time Subscriptions
- Uses Supabase real-time channels
- Automatic cleanup on component unmount
- Efficient presence broadcasting

### Caching
- Last active status cached client-side
- Updates every minute for offline users
- Real-time for online users

## Migration Steps

1. **Run Database Migration**
   ```bash
   # In Supabase SQL Editor
   # Run: supabase/migrations/012_user_contact_annotations_and_presence.sql
   ```

2. **No Code Changes Required**
   - Presence tracking starts automatically
   - Contact cards work immediately in Messages view

3. **Optional: Add Indicators to Other Views**
   ```tsx
   import { OnlineIndicator } from '../UserContact';
   
   // In your component
   <OnlineIndicator userId={userId} showText={true} />
   ```

## Future Enhancements

### Potential Additions:
1. **Custom Status Messages** - "In a meeting", "Out for lunch"
2. **Do Not Disturb Mode** - Hide online status
3. **Contact Groups** - Organize favorites into groups
4. **Shared Notes** - Team-wide notes on contacts
5. **Contact History** - Track interaction history
6. **Smart Suggestions** - AI-suggested contact info
7. **Bulk Actions** - Add multiple favorites at once
8. **Export/Import** - Backup contact annotations

## Troubleshooting

### Contact Card Not Opening
- Check that `userId` is valid UUID
- Verify user exists in user_profiles table
- Check console for errors

### Presence Not Updating
- Verify user is logged in
- Check browser console for auth errors
- Ensure Supabase connection is active

### Annotations Not Saving
- Check user authentication
- Verify RLS policies are enabled
- Check database connection

## API Reference

### userContactService

```typescript
// Get annotation
const annotation = await userContactService.getAnnotation(targetUserId);

// Update annotation
await userContactService.updateAnnotation({
  targetUserId: 'user-uuid',
  nickname: 'Babe',
  customNotes: 'My favorite person!',
  isFavorite: true
});

// Get enriched profile
const profile = await userContactService.getEnrichedProfile(targetUserId);

// Update presence
await userContactService.updatePresence('online');

// Start heartbeat
const cleanup = userContactService.startPresenceHeartbeat(60000);
// Call cleanup() to stop
```

## Testing Checklist

- [ ] Click user avatar in messages - card opens
- [ ] Edit private notes - saves successfully
- [ ] Add nickname - displays in card
- [ ] Mark as favorite - shows star icon
- [ ] View public info - displays correctly
- [ ] Close card - returns to messages
- [ ] Online indicator - shows green for active users
- [ ] Offline indicator - shows gray with last active time
- [ ] Presence updates - changes in real-time
- [ ] Multiple users - each has unique annotations
- [ ] Privacy - can't see others' annotations

## Summary

This implementation provides a comprehensive contact management system with:
- ✅ Clickable user profiles
- ✅ Private annotations per user
- ✅ Real-time online/offline status
- ✅ Last active tracking
- ✅ Secure and private
- ✅ Easy to integrate
- ✅ Performant and scalable

Users can now have personalized contact information that's completely private, while seeing real-time presence information for all Pulse users.
