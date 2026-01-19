// Analytics Dashboard Component
import React, { useMemo } from 'react';
import { TrendingUp, MessageSquare, Users, Clock, Target, Zap } from 'lucide-react';
import type { Thread } from '../../types';

interface MessageAnalyticsProps {
  threads: Thread[];
  timeRange?: 'week' | 'month' | 'all';
}

export const MessageAnalyticsDashboard: React.FC<MessageAnalyticsProps> = ({
  threads,
  timeRange = 'week'
}) => {
  const analytics = useMemo(() => {
    const now = Date.now();
    const timeRangeMs = timeRange === 'week' ? 7 * 24 * 60 * 60 * 1000 : 
                        timeRange === 'month' ? 30 * 24 * 60 * 60 * 1000 : 
                        Infinity;
    
    const filteredThreads = threads.filter(t => 
      t.messages[0] && (now - t.messages[0].timestamp.getTime()) <= timeRangeMs
    );
    
    const allMessages = filteredThreads.flatMap(t => t.messages);
    const myMessages = allMessages.filter(m => m.sender === 'me');
    
    // Response times
    const responseTimes: number[] = [];
    allMessages.forEach((msg, i) => {
      if (i > 0 && msg.sender === 'me' && allMessages[i-1].sender !== 'me') {
        const diff = msg.timestamp.getTime() - allMessages[i-1].timestamp.getTime();
        responseTimes.push(diff / (1000 * 60 * 60)); // hours
      }
    });
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b) / responseTimes.length 
      : 0;
    
    // Most active contacts
    const contactActivity = new Map<string, number>();
    filteredThreads.forEach(t => {
      contactActivity.set(t.contactName, (contactActivity.get(t.contactName) || 0) + t.messages.length);
    });
    
    const topContacts = Array.from(contactActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Peak hours
    const hourCounts = new Array(24).fill(0);
    myMessages.forEach(m => {
      const hour = m.timestamp.getHours();
      hourCounts[hour]++;
    });
    
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    
    // Streak calculation
    const daysWithMessages = new Set(
      myMessages.map(m => new Date(m.timestamp).toDateString())
    );
    
    return {
      totalMessages: allMessages.length,
      sentMessages: myMessages.length,
      receivedMessages: allMessages.length - myMessages.length,
      avgResponseTime,
      activeConversations: filteredThreads.length,
      topContacts,
      peakHour,
      daysActive: daysWithMessages.size,
      avgMessagesPerDay: myMessages.length / Math.max(daysWithMessages.size, 1)
    };
  }, [threads, timeRange]);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Message Analytics
        </h3>
        <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Total Messages</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {analytics.totalMessages}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {analytics.sentMessages} sent • {analytics.receivedMessages} received
          </div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Avg Response</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {analytics.avgResponseTime.toFixed(1)}h
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Active Chats</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {analytics.activeConversations}
          </div>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Days Active</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {analytics.daysActive}
          </div>
        </div>
        
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Peak Hour</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {analytics.peakHour}:00
          </div>
        </div>
        
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Msgs/Day</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {analytics.avgMessagesPerDay.toFixed(1)}
          </div>
        </div>
      </div>
      
      {/* Top Contacts */}
      {analytics.topContacts.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Most Active Conversations
          </div>
          <div className="space-y-2">
            {analytics.topContacts.map(([name, count], index) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-6 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{count} messages</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${(count / analytics.topContacts[0][1]) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
