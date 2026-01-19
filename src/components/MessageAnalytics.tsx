// =====================================================
// MESSAGE ANALYTICS COMPONENT
// Dashboard for tracking message performance and retention
// =====================================================

import React, { useState, useEffect } from 'react';
import { messageService } from '../services/messageService';
import type {
  InAppMessage,
  MessageMetrics,
  RetentionByExposure,
} from '../types/inAppMessages';

/**
 * MessageAnalytics Component
 * Displays analytics and metrics for in-app messages
 */
const MessageAnalytics: React.FC = () => {
  // ==================== STATE ====================

  const [messages, setMessages] = useState<InAppMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<InAppMessage | null>(null);
  const [metrics, setMetrics] = useState<MessageMetrics | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionByExposure[]>([]);
  const [loading, setLoading] = useState(false);

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadMessages();
    loadRetentionData();
  }, []);

  useEffect(() => {
    if (selectedMessage) {
      loadMessageMetrics(selectedMessage.id);
    }
  }, [selectedMessage]);

  // ==================== DATA LOADING ====================

  const loadMessages = async () => {
    setLoading(true);
    try {
      const allMessages = await messageService.getActiveMessages();
      setMessages(allMessages);
      if (allMessages.length > 0 && !selectedMessage) {
        setSelectedMessage(allMessages[0]);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessageMetrics = async (messageId: string) => {
    setLoading(true);
    try {
      const metricsData = await messageService.getMessageMetrics(messageId);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRetentionData = async () => {
    try {
      const retention = await messageService.getRetentionByExposure();
      setRetentionData(retention);
    } catch (error) {
      console.error('Failed to load retention data:', error);
    }
  };

  // ==================== UTILITY FUNCTIONS ====================

  const getMetricColor = (rate: number): string => {
    if (rate >= 20) return 'text-green-600 dark:text-green-400';
    if (rate >= 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // ==================== RENDER ====================

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
          Message Analytics
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Track engagement, conversion, and retention impact of your in-app messages
        </p>
      </div>

      {/* Message Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Select Message
        </label>
        <select
          value={selectedMessage?.id || ''}
          onChange={(e) => {
            const message = messages.find((m) => m.id === e.target.value);
            setSelectedMessage(message || null);
          }}
          className="w-full md:w-96 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          {messages.map((message) => (
            <option key={message.id} value={message.id}>
              {message.title} {!message.isActive && '(Inactive)'}
            </option>
          ))}
        </select>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Shown */}
          <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Shown</span>
              <i className="fa-solid fa-eye text-zinc-400 dark:text-zinc-600"></i>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white">
              {metrics.totalShown.toLocaleString()}
            </div>
          </div>

          {/* Open Rate */}
          <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Open Rate</span>
              <i className="fa-solid fa-envelope-open text-zinc-400 dark:text-zinc-600"></i>
            </div>
            <div className={`text-3xl font-bold ${getMetricColor(metrics.openRate)}`}>
              {metrics.openRate.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              {metrics.totalOpened} opens
            </div>
          </div>

          {/* Click Rate */}
          <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Click Rate</span>
              <i className="fa-solid fa-mouse-pointer text-zinc-400 dark:text-zinc-600"></i>
            </div>
            <div className={`text-3xl font-bold ${getMetricColor(metrics.clickRate)}`}>
              {metrics.clickRate.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              {metrics.totalClicked} clicks
            </div>
          </div>

          {/* Total Dismissed */}
          <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Dismissed</span>
              <i className="fa-solid fa-times-circle text-zinc-400 dark:text-zinc-600"></i>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white">
              {metrics.totalDismissed.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Engagement Funnel */}
      {metrics && (
        <div className="mb-8 p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            Engagement Funnel
          </h2>

          <div className="space-y-4">
            {/* Shown */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Shown</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {metrics.totalShown}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>

            {/* Opened */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Opened</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {metrics.totalOpened} ({metrics.openRate.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3">
                <div
                  className="bg-green-600 dark:bg-green-500 h-3 rounded-full"
                  style={{
                    width: `${Math.min(100, metrics.openRate)}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Clicked */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Clicked</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {metrics.totalClicked} ({metrics.clickRate.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3">
                <div
                  className="bg-purple-600 dark:bg-purple-500 h-3 rounded-full"
                  style={{
                    width: `${Math.min(100, metrics.clickRate)}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Dismissed */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Dismissed</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {metrics.totalDismissed}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3">
                <div
                  className="bg-red-600 dark:bg-red-500 h-3 rounded-full"
                  style={{
                    width: `${Math.min(100, (metrics.totalDismissed / Math.max(1, metrics.totalShown)) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Avg Time to Action:</span>
                <span className="ml-2 font-medium text-zinc-900 dark:text-white">
                  {metrics.avgTimeToAction.toFixed(1)}s
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retention Impact */}
      <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
          Retention Impact by Message Exposure
        </h2>

        {retentionData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300 font-medium">
                    Exposed to Messages
                  </th>
                  <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                    Total Users
                  </th>
                  <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                    Day 1 Retention
                  </th>
                  <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                    Day 7 Retention
                  </th>
                  <th className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                    Day 30 Retention
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {retentionData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                          row.exposedToMessages
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {row.exposedToMessages ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-900 dark:text-white font-medium">
                      {row.userCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getMetricColor(row.day1Retention)}>
                        {row.day1Retention.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getMetricColor(row.day7Retention)}>
                        {row.day7Retention.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getMetricColor(row.day30Retention)}>
                        {row.day30Retention.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
            No retention data available yet. Data will appear as users engage with messages.
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Insight:</strong> Users with higher message engagement typically show better
              retention rates. Use this data to optimize your messaging strategy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageAnalytics;
