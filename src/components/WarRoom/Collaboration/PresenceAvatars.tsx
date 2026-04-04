import React from 'react';
import { useWarRoomStore } from '../../../store/warRoomStore';
import { Users } from 'lucide-react';

export const PresenceAvatars: React.FC = () => {
  const presence = useWarRoomStore(s => s.presence);
  const users = Array.from(presence.values());

  if (users.length <= 1) return null; // Don't show if only the current user

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className="w-7 h-7 rounded-full border-2 border-gray-900 bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold"
            title={user.displayName}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full rounded-full object-cover" />
            ) : (
              user.displayName.charAt(0).toUpperCase()
            )}
          </div>
        ))}
      </div>
      {users.length > 5 && (
        <span className="text-xs text-gray-400">+{users.length - 5}</span>
      )}
      <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 rounded-full">
        <Users className="w-3 h-3 text-emerald-400" />
        <span className="text-[10px] font-medium text-emerald-400">{users.length} online</span>
      </div>
    </div>
  );
};
