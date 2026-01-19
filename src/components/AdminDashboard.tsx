
import React, { useState, useEffect, useCallback } from 'react';
import AdminMessageEditor from './AdminMessageEditor';
import { adminService, AdminUser, AdminSettings, DashboardStats, ActivityLogEntry } from '../services/adminService';

interface AdminDashboardProps {
  userId: string;
}

type TabType = 'overview' | 'users' | 'messages' | 'settings';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUser['role']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminUser['status']>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    pendingApprovals: 0,
  });

  // Activity logs
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  // Settings
  const [settings, setSettings] = useState<AdminSettings | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load all data in parallel
      const [usersData, statsData, logsData, settingsData] = await Promise.all([
        adminService.getAllUsers(),
        adminService.getDashboardStats(),
        adminService.getActivityLogs(10),
        adminService.getSettings(),
      ]);

      setUsers(usersData);
      setStats(statsData);
      setActivityLogs(logsData);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleUpdateUserStatus = async (userId: string, newStatus: AdminUser['status']) => {
    try {
      await adminService.updateUserStatus(userId, newStatus);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
      }
      // Refresh activity logs
      const logs = await adminService.getActivityLogs(10);
      setActivityLogs(logs);
    } catch (err) {
      console.error('Failed to update user status:', err);
      alert('Failed to update user status. Please try again.');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: AdminUser['role']) => {
    try {
      await adminService.updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      }
      // Refresh activity logs
      const logs = await adminService.getActivityLogs(10);
      setActivityLogs(logs);
    } catch (err) {
      console.error('Failed to update user role:', err);
      alert('Failed to update user role. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await adminService.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSelectedUser(null);
      // Refresh stats
      const statsData = await adminService.getDashboardStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user. Please try again.');
    }
  };

  const handleSettingChange = async (setting: keyof AdminSettings, value: boolean) => {
    if (!settings) return;

    try {
      const updated = await adminService.updateSettings({
        ...settings,
        [setting]: value,
      });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update setting:', err);
      alert('Failed to update setting. Please try again.');
    }
  };

  const handleExportUsersCSV = async () => {
    try {
      const csv = await adminService.exportUsersCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export users:', err);
      alert('Failed to export users. Please try again.');
    }
  };

  const handleExportMessagesJSON = async () => {
    try {
      const json = await adminService.exportMessagesJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `messages-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export messages:', err);
      alert('Failed to export messages. Please try again.');
    }
  };

  const getStatusColor = (status: AdminUser['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'suspended': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  const getRoleColor = (role: AdminUser['role']) => {
    switch (role) {
      case 'admin': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'moderator': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'user': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('approved') || action.includes('active')) return { icon: 'fa-user-check', color: 'emerald' };
    if (action.includes('message') || action.includes('sent')) return { icon: 'fa-envelope', color: 'blue' };
    if (action.includes('settings')) return { icon: 'fa-gear', color: 'zinc' };
    if (action.includes('suspended') || action.includes('banned')) return { icon: 'fa-ban', color: 'red' };
    if (action.includes('signup') || action.includes('created')) return { icon: 'fa-user-plus', color: 'purple' };
    if (action.includes('deleted')) return { icon: 'fa-trash', color: 'red' };
    if (action.includes('role')) return { icon: 'fa-shield', color: 'blue' };
    return { icon: 'fa-circle-info', color: 'zinc' };
  };

  if (loading && users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-950 rounded-2xl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <i className="fa-solid fa-shield-halved text-white"></i>
              </div>
              Admin Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Manage users, messages, and system settings</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-full ${settings?.maintenanceMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} border flex items-center gap-2`}>
              <div className={`w-2 h-2 ${settings?.maintenanceMode ? 'bg-amber-500' : 'bg-emerald-500'} rounded-full animate-pulse`}></div>
              <span className={`text-xs font-medium ${settings?.maintenanceMode ? 'text-amber-500' : 'text-emerald-500'}`}>
                {settings?.maintenanceMode ? 'Maintenance Mode' : 'System Online'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
          {[
            { id: 'overview', icon: 'fa-chart-pie', label: 'Overview' },
            { id: 'users', icon: 'fa-users', label: 'Users' },
            { id: 'messages', icon: 'fa-envelope', label: 'Messages' },
            { id: 'settings', icon: 'fa-gear', label: 'Settings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
          <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
          <button onClick={loadData} className="text-red-600 dark:text-red-400 text-sm underline">
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: 'fa-users', color: 'blue' },
                { label: 'Active Users', value: stats.activeUsers, icon: 'fa-user-check', color: 'emerald' },
                { label: 'Total Messages', value: stats.totalMessages.toLocaleString(), icon: 'fa-comments', color: 'purple' },
                { label: 'Pending Approvals', value: stats.pendingApprovals, icon: 'fa-clock', color: 'amber' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800"
                >
                  <div className={`w-10 h-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center mb-3`}>
                    <i className={`fa-solid ${stat.icon} text-${stat.color}-500`}></i>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-zinc-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Approve Pending', icon: 'fa-user-check', color: 'emerald', action: () => setActiveTab('users') },
                { label: 'Send Broadcast', icon: 'fa-bullhorn', color: 'blue', action: () => setActiveTab('messages') },
                { label: 'View Reports', icon: 'fa-chart-bar', color: 'purple', action: () => {} },
                { label: 'System Health', icon: 'fa-heartbeat', color: 'red', action: () => setActiveTab('settings') },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.action}
                  className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 hover:border-${action.color}-500/50 transition group text-left`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-${action.color}-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition`}>
                    <i className={`fa-solid ${action.icon} text-${action.color}-500`}></i>
                  </div>
                  <p className="font-medium text-zinc-900 dark:text-white">{action.label}</p>
                  <p className="text-xs text-zinc-500 mt-1">Click to manage</p>
                </button>
              ))}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-zinc-500"></i>
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {users.slice(0, 4).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center text-white font-bold">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full" />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                        <p className="text-xs text-zinc-500 mt-1">{formatRelativeTime(user.lastActive)}</p>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-center text-zinc-500 py-4">No users found</p>
                  )}
                </div>
              </div>

              {/* Activity Log */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-zinc-500"></i>
                  Activity Log
                </h3>
                <div className="space-y-3">
                  {activityLogs.map((log) => {
                    const { icon, color } = getActivityIcon(log.action);
                    return (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800"
                      >
                        <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center flex-shrink-0`}>
                          <i className={`fa-solid ${icon} text-${color}-500 text-xs`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{log.action}</p>
                          <p className="text-xs text-zinc-500">{log.actorName}</p>
                        </div>
                        <span className="text-xs text-zinc-400 flex-shrink-0">{formatRelativeTime(log.createdAt)}</span>
                      </div>
                    );
                  })}
                  {activityLogs.length === 0 && (
                    <p className="text-center text-zinc-500 py-4">No activity yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* System Status Banner */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-2xl p-6 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-server text-emerald-500 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-white">
                      {settings?.maintenanceMode ? 'Maintenance Mode Active' : 'All Systems Operational'}
                    </h4>
                    <p className="text-sm text-zinc-500">Last checked: Just now</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">99.9%</p>
                    <p className="text-xs text-zinc-500">Uptime</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">24ms</p>
                    <p className="text-xs text-zinc-500">Latency</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">0</p>
                    <p className="text-xs text-zinc-500">Errors</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="flex h-full">
            {/* Users List */}
            <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-zinc-200 dark:border-zinc-800`}>
              {/* Search & Filters */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition"
                  />
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-zinc-500"></i>
                </div>
                <div className="flex gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="user">User</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Users List */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="text-xs text-zinc-500 px-3 py-2">{filteredUsers.length} users</div>
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-4 rounded-xl mb-2 text-left transition border ${
                      selectedUser?.id === user.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/30'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 object-cover" />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">{user.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </div>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-center text-zinc-500 py-8">No users found</p>
                )}
              </div>
            </div>

            {/* User Detail */}
            <div className={`${selectedUser ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
              {selectedUser ? (
                <div className="flex flex-col h-full animate-fade-in">
                  {/* User Header */}
                  <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="md:hidden text-zinc-500 mb-4 flex items-center gap-2 text-xs hover:text-zinc-900 dark:hover:text-white transition"
                    >
                      <i className="fa-solid fa-arrow-left"></i> Back to list
                    </button>

                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center text-white text-2xl font-bold shadow-lg overflow-hidden">
                        {selectedUser.avatarUrl ? (
                          <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="w-16 h-16 object-cover" />
                        ) : (
                          selectedUser.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedUser.name}</h2>
                        <p className="text-sm text-zinc-500">{selectedUser.email}</p>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getRoleColor(selectedUser.role)}`}>
                            {selectedUser.role}
                          </span>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(selectedUser.status)}`}>
                            {selectedUser.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User Stats */}
                  <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{selectedUser.messagesCount}</p>
                        <p className="text-xs text-zinc-500">Messages</p>
                      </div>
                      <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{selectedUser.groupsCount}</p>
                        <p className="text-xs text-zinc-500">Groups</p>
                      </div>
                      <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{formatRelativeTime(selectedUser.lastActive)}</p>
                        <p className="text-xs text-zinc-500">Last Active</p>
                      </div>
                    </div>
                  </div>

                  {/* User Actions */}
                  <div className="flex-1 p-6 space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Change Role</label>
                      <div className="flex gap-2">
                        {(['user', 'moderator', 'admin'] as const).map(role => (
                          <button
                            key={role}
                            onClick={() => handleUpdateUserRole(selectedUser.id, role)}
                            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                              selectedUser.role === role
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Account Status</label>
                      <div className="flex gap-2">
                        {(['active', 'suspended', 'pending'] as const).map(status => (
                          <button
                            key={status}
                            onClick={() => handleUpdateUserStatus(selectedUser.id, status)}
                            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                              selectedUser.status === status
                                ? status === 'active'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : status === 'suspended'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                            }`}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs text-zinc-500 mb-1">Account created</p>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        {selectedUser.createdAt.toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-red-50 dark:bg-red-900/10">
                    <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">Danger Zone</h4>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleUpdateUserStatus(selectedUser.id, 'suspended')}
                        className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                      >
                        <i className="fa-solid fa-ban mr-2"></i>
                        Ban User
                      </button>
                      <button
                        onClick={() => handleDeleteUser(selectedUser.id)}
                        className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                      >
                        <i className="fa-solid fa-trash mr-2"></i>
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                  <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-user text-4xl opacity-50"></i>
                  </div>
                  <p>Select a user to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="animate-fade-in">
            <AdminMessageEditor userId={userId} />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-6 animate-fade-in">
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">System Settings</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Allow New Registrations</p>
                    <p className="text-sm text-zinc-500">Enable or disable new user signups</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.allowNewRegistrations ?? true}
                      onChange={(e) => handleSettingChange('allowNewRegistrations', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Email Notifications</p>
                    <p className="text-sm text-zinc-500">Send email alerts for admin events</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.emailNotifications ?? true}
                      onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Maintenance Mode</p>
                    <p className="text-sm text-zinc-500">Temporarily disable access for non-admins</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.maintenanceMode ?? false}
                      onChange={(e) => handleSettingChange('maintenanceMode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:bg-red-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Export Data</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleExportUsersCSV}
                  className="px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium hover:border-zinc-400 transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-file-csv"></i> Export Users (CSV)
                </button>
                <button
                  onClick={handleExportMessagesJSON}
                  className="px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium hover:border-zinc-400 transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-file-export"></i> Export Messages (JSON)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
