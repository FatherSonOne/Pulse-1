// ============================================
// ADMIN DASHBOARD COMPONENT
// Main admin interface for Pulse configuration
// ============================================

import React, { useState } from 'react';
import AdminMessageEditor from '../AdminMessageEditor';
import MessageAnalytics from '../MessageAnalytics';
import IntegrationManager from './IntegrationManager';
import SettingsPanel from './SettingsPanel';
import WebhookManager from './WebhookManager';
import SearchAnalyticsDashboard from './SearchAnalyticsDashboard';
import { AnimatedIcon } from '../ui/AnimatedIcon';
import './AdminDashboard.css';

type AdminTab = 'messages' | 'analytics' | 'integrations' | 'webhooks' | 'settings' | 'search';

interface AdminDashboardProps {
  userId: string;
}

/**
 * AdminDashboard Component
 * Central hub for all admin functionality
 */
const AdminDashboard: React.FC<AdminDashboardProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('messages');

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'messages', label: 'Messages', icon: 'chat' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
    { id: 'integrations', label: 'Integrations', icon: 'link' },
    { id: 'webhooks', label: 'Webhooks', icon: 'hook' },
    { id: 'settings', label: 'Settings', icon: 'gear' },
    { id: 'search', label: 'Search', icon: 'search' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'messages':
        return <AdminMessageEditor userId={userId} />;
      case 'analytics':
        return <MessageAnalytics />;
      case 'integrations':
        return <IntegrationManager />;
      case 'webhooks':
        return <WebhookManager />;
      case 'settings':
        return <SettingsPanel userId={userId} />;
      case 'search':
        return <SearchAnalyticsDashboard userId={userId} />;
      default:
        return null;
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Pulse Admin</h1>
        <p className="admin-subtitle">Manage messages, integrations, and settings</p>
      </header>

      <nav className="admin-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon"><AnimatedIcon icon={tab.icon} size={18} /></span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="admin-content">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default AdminDashboard;
