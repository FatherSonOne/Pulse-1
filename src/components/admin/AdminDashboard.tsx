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
import './AdminDashboard.css';

type AdminTab = 'messages' | 'analytics' | 'integrations' | 'webhooks' | 'settings';

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
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'webhooks', label: 'Webhooks', icon: '🪝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
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
            <span className="tab-icon">{tab.icon}</span>
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
