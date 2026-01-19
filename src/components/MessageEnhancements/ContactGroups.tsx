import React, { useState, useMemo, useCallback } from 'react';

// Types
interface GroupMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: 'admin' | 'member';
  joinedAt: Date;
  lastActive?: Date;
  isOnline?: boolean;
}

interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  members: GroupMember[];
  createdAt: Date;
  createdBy: string;
  isPrivate: boolean;
  settings: {
    allowMemberInvite: boolean;
    muteNotifications: boolean;
    autoArchiveDays?: number;
  };
  stats: {
    messageCount: number;
    activeMembers: number;
    lastActivity: Date;
  };
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'announcement';
  groupId?: string;
  icon: string;
  color: string;
  members: string[];
  pinnedMessages: string[];
  createdAt: Date;
  lastActivity: Date;
  unreadCount: number;
  isMuted: boolean;
}

interface ContactGroupsProps {
  groups?: ContactGroup[];
  channels?: Channel[];
  currentUserId?: string;
  onCreateGroup?: (group: Omit<ContactGroup, 'id' | 'createdAt' | 'stats'>) => void;
  onUpdateGroup?: (groupId: string, updates: Partial<ContactGroup>) => void;
  onDeleteGroup?: (groupId: string) => void;
  onAddMember?: (groupId: string, member: Omit<GroupMember, 'joinedAt'>) => void;
  onRemoveMember?: (groupId: string, memberId: string) => void;
  onCreateChannel?: (channel: Omit<Channel, 'id' | 'createdAt' | 'lastActivity' | 'unreadCount'>) => void;
  onJoinChannel?: (channelId: string) => void;
  onLeaveChannel?: (channelId: string) => void;
  onSelectGroup?: (groupId: string) => void;
  onSelectChannel?: (channelId: string) => void;
  onClose?: () => void;
}

// Mock data generators
const generateMockGroups = (): ContactGroup[] => {
  const now = Date.now();
  return [
    {
      id: 'group-1',
      name: 'Product Team',
      description: 'Main product development team discussions',
      icon: '💻',
      color: '#8b5cf6',
      members: [
        { id: 'user-1', name: 'Alice Johnson', role: 'admin', joinedAt: new Date(now - 90 * 24 * 60 * 60 * 1000), isOnline: true },
        { id: 'user-2', name: 'Bob Smith', role: 'member', joinedAt: new Date(now - 60 * 24 * 60 * 60 * 1000), isOnline: true },
        { id: 'user-3', name: 'Charlie Brown', role: 'member', joinedAt: new Date(now - 30 * 24 * 60 * 60 * 1000), isOnline: false },
        { id: 'user-4', name: 'Diana Prince', role: 'member', joinedAt: new Date(now - 15 * 24 * 60 * 60 * 1000), isOnline: true },
      ],
      createdAt: new Date(now - 90 * 24 * 60 * 60 * 1000),
      createdBy: 'user-1',
      isPrivate: false,
      settings: { allowMemberInvite: true, muteNotifications: false },
      stats: { messageCount: 1250, activeMembers: 4, lastActivity: new Date(now - 30 * 60 * 1000) },
    },
    {
      id: 'group-2',
      name: 'Marketing',
      description: 'Marketing campaigns and strategy',
      icon: '📢',
      color: '#ec4899',
      members: [
        { id: 'user-5', name: 'Eve Wilson', role: 'admin', joinedAt: new Date(now - 60 * 24 * 60 * 60 * 1000), isOnline: false },
        { id: 'user-1', name: 'Alice Johnson', role: 'member', joinedAt: new Date(now - 45 * 24 * 60 * 60 * 1000), isOnline: true },
      ],
      createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000),
      createdBy: 'user-5',
      isPrivate: false,
      settings: { allowMemberInvite: false, muteNotifications: false },
      stats: { messageCount: 450, activeMembers: 2, lastActivity: new Date(now - 2 * 60 * 60 * 1000) },
    },
    {
      id: 'group-3',
      name: 'Executive Team',
      description: 'Leadership discussions',
      icon: '👔',
      color: '#f59e0b',
      members: [
        { id: 'user-1', name: 'Alice Johnson', role: 'admin', joinedAt: new Date(now - 120 * 24 * 60 * 60 * 1000), isOnline: true },
        { id: 'user-6', name: 'Frank Miller', role: 'admin', joinedAt: new Date(now - 120 * 24 * 60 * 60 * 1000), isOnline: false },
      ],
      createdAt: new Date(now - 120 * 24 * 60 * 60 * 1000),
      createdBy: 'user-6',
      isPrivate: true,
      settings: { allowMemberInvite: false, muteNotifications: false },
      stats: { messageCount: 320, activeMembers: 2, lastActivity: new Date(now - 24 * 60 * 60 * 1000) },
    },
  ];
};

const generateMockChannels = (): Channel[] => {
  const now = Date.now();
  return [
    {
      id: 'channel-1',
      name: 'general',
      description: 'General discussions',
      type: 'public',
      icon: '#️⃣',
      color: '#6b7280',
      members: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
      pinnedMessages: [],
      createdAt: new Date(now - 90 * 24 * 60 * 60 * 1000),
      lastActivity: new Date(now - 10 * 60 * 1000),
      unreadCount: 5,
      isMuted: false,
    },
    {
      id: 'channel-2',
      name: 'announcements',
      description: 'Important company announcements',
      type: 'announcement',
      icon: '📣',
      color: '#f59e0b',
      members: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6'],
      pinnedMessages: ['msg-1', 'msg-2'],
      createdAt: new Date(now - 90 * 24 * 60 * 60 * 1000),
      lastActivity: new Date(now - 2 * 24 * 60 * 60 * 1000),
      unreadCount: 0,
      isMuted: false,
    },
    {
      id: 'channel-3',
      name: 'design',
      description: 'Design team discussions',
      type: 'public',
      groupId: 'group-1',
      icon: '🎨',
      color: '#8b5cf6',
      members: ['user-1', 'user-3'],
      pinnedMessages: [],
      createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000),
      lastActivity: new Date(now - 4 * 60 * 60 * 1000),
      unreadCount: 12,
      isMuted: false,
    },
    {
      id: 'channel-4',
      name: 'random',
      description: 'Off-topic fun',
      type: 'public',
      icon: '🎲',
      color: '#22c55e',
      members: ['user-1', 'user-2', 'user-4'],
      pinnedMessages: [],
      createdAt: new Date(now - 45 * 24 * 60 * 60 * 1000),
      lastActivity: new Date(now - 1 * 60 * 60 * 1000),
      unreadCount: 3,
      isMuted: true,
    },
  ];
};

const GROUP_ICONS = ['👥', '💻', '📢', '🎯', '🚀', '💡', '🔧', '📊', '🎨', '📚', '🏢', '🌟'];
const CHANNEL_ICONS = ['#️⃣', '📣', '🎨', '🔧', '💬', '📊', '🎯', '💡', '🔒', '🌐'];
const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#06b6d4', '#6366f1'];

export const ContactGroups: React.FC<ContactGroupsProps> = ({
  groups: propGroups,
  channels: propChannels,
  currentUserId = 'user-1',
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddMember,
  onRemoveMember,
  onCreateChannel,
  onJoinChannel,
  onLeaveChannel,
  onSelectGroup,
  onSelectChannel,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'groups' | 'channels' | 'create'>('groups');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  // Create form states
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    icon: '👥',
    color: '#8b5cf6',
    isPrivate: false,
  });

  const [newChannel, setNewChannel] = useState({
    name: '',
    description: '',
    type: 'public' as Channel['type'],
    icon: '#️⃣',
    color: '#6b7280',
    groupId: '',
  });

  // Use provided or mock data
  const groups = useMemo(() => propGroups || generateMockGroups(), [propGroups]);
  const channels = useMemo(() => propChannels || generateMockChannels(), [propChannels]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(query) ||
      g.description?.toLowerCase().includes(query) ||
      g.members.some(m => m.name.toLowerCase().includes(query))
    );
  }, [groups, searchQuery]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.description?.toLowerCase().includes(query)
    );
  }, [channels, searchQuery]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleCreateGroup = useCallback(() => {
    if (!newGroup.name.trim()) return;

    onCreateGroup?.({
      name: newGroup.name,
      description: newGroup.description || undefined,
      icon: newGroup.icon,
      color: newGroup.color,
      members: [{ id: currentUserId, name: 'You', role: 'admin' }],
      createdBy: currentUserId,
      isPrivate: newGroup.isPrivate,
      settings: {
        allowMemberInvite: true,
        muteNotifications: false,
      },
    });

    setNewGroup({ name: '', description: '', icon: '👥', color: '#8b5cf6', isPrivate: false });
    setShowCreateGroup(false);
  }, [newGroup, currentUserId, onCreateGroup]);

  const handleCreateChannel = useCallback(() => {
    if (!newChannel.name.trim()) return;

    onCreateChannel?.({
      name: newChannel.name.toLowerCase().replace(/\s+/g, '-'),
      description: newChannel.description || undefined,
      type: newChannel.type,
      icon: newChannel.icon,
      color: newChannel.color,
      groupId: newChannel.groupId || undefined,
      members: [currentUserId],
      pinnedMessages: [],
      isMuted: false,
    });

    setNewChannel({ name: '', description: '', type: 'public', icon: '#️⃣', color: '#6b7280', groupId: '' });
    setShowCreateChannel(false);
  }, [newChannel, currentUserId, onCreateChannel]);

  // Selected group details view
  const selectedGroupData = useMemo(() =>
    groups.find(g => g.id === selectedGroup),
    [groups, selectedGroup]
  );

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>👥</span>
            Groups & Channels
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            {groups.length} groups · {channels.length} channels
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '10px',
        padding: '10px 14px',
        marginBottom: '16px',
      }}>
        <span style={{ opacity: 0.5 }}>🔍</span>
        <input
          type="text"
          placeholder="Search groups and channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
      }}>
        {[
          { id: 'groups', label: 'Groups', icon: '👥', count: groups.length },
          { id: 'channels', label: 'Channels', icon: '#️⃣', count: channels.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as typeof activeTab);
              setSelectedGroup(null);
            }}
            style={{
              background: activeTab === tab.id ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
              border: activeTab === tab.id ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(255,255,255,0.15)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Groups List */}
        {activeTab === 'groups' && !selectedGroup && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.6, margin: 0 }}>
                YOUR GROUPS
              </h3>
              <button
                onClick={() => setShowCreateGroup(true)}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                + Create Group
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group.id);
                    onSelectGroup?.(group.id);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: `3px solid ${group.color}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: `${group.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      flexShrink: 0,
                    }}>
                      {group.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{group.name}</span>
                        {group.isPrivate && (
                          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>🔒</span>
                        )}
                      </div>

                      {group.description && (
                        <p style={{
                          margin: '0 0 8px',
                          fontSize: '0.85rem',
                          opacity: 0.7,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {group.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem' }}>
                        <span style={{ opacity: 0.6 }}>
                          👤 {group.members.length} members
                        </span>
                        <span style={{ opacity: 0.6 }}>
                          💬 {group.stats.messageCount}
                        </span>
                        <span style={{ opacity: 0.5 }}>
                          {formatDate(group.stats.lastActivity)}
                        </span>
                      </div>

                      {/* Online members */}
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                        <div style={{ display: 'flex' }}>
                          {group.members.filter(m => m.isOnline).slice(0, 4).map((member, i) => (
                            <div
                              key={member.id}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${group.color}, ${group.color}88)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                marginLeft: i > 0 ? '-8px' : 0,
                                border: '2px solid rgba(30, 30, 50, 1)',
                                position: 'relative',
                              }}
                              title={member.name}
                            >
                              {member.name.charAt(0)}
                              <span style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#22c55e',
                                border: '2px solid rgba(30, 30, 50, 1)',
                              }} />
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: '8px' }}>
                          {group.members.filter(m => m.isOnline).length} online
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredGroups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>👥</span>
                  <p>No groups found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Group Detail View */}
        {activeTab === 'groups' && selectedGroup && selectedGroupData && (
          <div>
            <button
              onClick={() => setSelectedGroup(null)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                color: 'white',
                cursor: 'pointer',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              ← Back to Groups
            </button>

            <div style={{
              background: `${selectedGroupData.color}15`,
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: `${selectedGroupData.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                }}>
                  {selectedGroupData.icon}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{selectedGroupData.name}</h3>
                  {selectedGroupData.description && (
                    <p style={{ margin: '4px 0 0', opacity: 0.7 }}>{selectedGroupData.description}</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem' }}>
                <div>
                  <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>Members</div>
                  <div style={{ fontWeight: 'bold' }}>{selectedGroupData.members.length}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>Messages</div>
                  <div style={{ fontWeight: 'bold' }}>{selectedGroupData.stats.messageCount}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>Created</div>
                  <div style={{ fontWeight: 'bold' }}>{formatDate(selectedGroupData.createdAt)}</div>
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.6, marginBottom: '12px' }}>
              MEMBERS
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedGroupData.members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px',
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${selectedGroupData.color}, ${selectedGroupData.color}88)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    position: 'relative',
                  }}>
                    {member.name.charAt(0)}
                    {member.isOnline && (
                      <span style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#22c55e',
                        border: '2px solid rgba(30, 30, 50, 1)',
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {member.name}
                      {member.role === 'admin' && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.7rem',
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fbbf24',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}>
                          Admin
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                      Joined {formatDate(member.joinedAt)}
                    </div>
                  </div>

                  {member.id !== currentUserId && (
                    <button
                      onClick={() => onRemoveMember?.(selectedGroupData.id, member.id)}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channels List */}
        {activeTab === 'channels' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.6, margin: 0 }}>
                YOUR CHANNELS
              </h3>
              <button
                onClick={() => setShowCreateChannel(true)}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                + Create Channel
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredChannels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => onSelectChannel?.(channel.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    opacity: channel.isMuted ? 0.6 : 1,
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: `${channel.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                  }}>
                    {channel.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 'bold' }}>#{channel.name}</span>
                      {channel.type === 'private' && <span style={{ fontSize: '0.7rem' }}>🔒</span>}
                      {channel.type === 'announcement' && <span style={{ fontSize: '0.7rem' }}>📣</span>}
                      {channel.isMuted && <span style={{ fontSize: '0.7rem' }}>🔇</span>}
                    </div>
                    {channel.description && (
                      <p style={{
                        margin: '2px 0 0',
                        fontSize: '0.8rem',
                        opacity: 0.6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {channel.description}
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {channel.unreadCount > 0 && (
                      <div style={{
                        background: '#ef4444',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        marginBottom: '4px',
                      }}>
                        {channel.unreadCount}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                      {formatDate(channel.lastActivity)}
                    </div>
                  </div>
                </div>
              ))}

              {filteredChannels.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>#️⃣</span>
                  <p>No channels found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowCreateGroup(false)}
        >
          <div
            style={{
              background: 'rgba(30, 30, 50, 0.98)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>Create Group</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Icon & Color
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {GROUP_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewGroup(prev => ({ ...prev, icon }))}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: newGroup.icon === icon ? `2px solid ${newGroup.color}` : '2px solid transparent',
                      background: newGroup.icon === icon ? `${newGroup.color}30` : 'rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewGroup(prev => ({ ...prev, color }))}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: newGroup.color === color ? '3px solid white' : '3px solid transparent',
                      background: color,
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Name *
              </label>
              <input
                type="text"
                value={newGroup.name}
                onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Group name"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Description
              </label>
              <textarea
                value={newGroup.description}
                onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What's this group about?"
                rows={2}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={newGroup.isPrivate}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>Make this group private</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateGroup(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroup.name.trim()}
                style={{
                  background: newGroup.name.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: newGroup.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowCreateChannel(false)}
        >
          <div
            style={{
              background: 'rgba(30, 30, 50, 0.98)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>Create Channel</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Name *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ opacity: 0.5 }}>#</span>
                <input
                  type="text"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  placeholder="channel-name"
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: 'white',
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Type
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'public', label: 'Public', icon: '#️⃣' },
                  { id: 'private', label: 'Private', icon: '🔒' },
                  { id: 'announcement', label: 'Announcement', icon: '📣' },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setNewChannel(prev => ({ ...prev, type: type.id as Channel['type'] }))}
                    style={{
                      flex: 1,
                      background: newChannel.type === type.id ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                      border: newChannel.type === type.id ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
                      borderRadius: '8px',
                      padding: '10px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{type.icon}</span>
                    <span style={{ fontSize: '0.8rem' }}>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Description
              </label>
              <input
                type="text"
                value={newChannel.description}
                onChange={(e) => setNewChannel(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What's this channel for?"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateChannel(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannel.name.trim()}
                style={{
                  background: newChannel.name.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: newChannel.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Group badge component
export const GroupBadge: React.FC<{
  name: string;
  icon: string;
  color: string;
  memberCount?: number;
  onClick?: () => void;
}> = ({ name, icon, color, memberCount, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        background: `${color}20`,
        border: `1px solid ${color}50`,
        borderRadius: '20px',
        padding: '4px 12px',
        color: 'white',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.85rem',
      }}
    >
      <span>{icon}</span>
      <span>{name}</span>
      {memberCount !== undefined && (
        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({memberCount})</span>
      )}
    </button>
  );
};

export default ContactGroups;
