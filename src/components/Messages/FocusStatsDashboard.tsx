/**
 * FocusStatsDashboard Component
 * Comprehensive statistics dashboard for focus sessions
 * Features: Daily/weekly/monthly views, time distribution chart, streaks, completion rate
 * Integrates into FocusMode settings modal
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FocusSessionStats } from '../../services/focusModeService';

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface DailyData {
  date: string;
  focusMinutes: number;
  sessionsCompleted: number;
  dayOfWeek: string;
}

interface FocusStatsDashboardProps {
  isVisible: boolean;
  stats: FocusSessionStats;
  dailyData: DailyData[];
  onClose: () => void;
  userId: string;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

const chartBarVariants = {
  hidden: { scaleY: 0 },
  visible: (custom: number) => ({
    scaleY: 1,
    transition: {
      duration: 0.5,
      delay: custom * 0.05,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

// Format helpers
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatHours = (minutes: number): string => {
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  bgColor: string;
}> = ({ icon, label, value, subValue, color, bgColor }) => (
  <motion.div
    className={`p-4 rounded-xl ${bgColor} border border-gray-700/50`}
    variants={cardVariants}
  >
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} bg-opacity-20 flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-xl font-bold text-white truncate">{value}</p>
        {subValue && <p className="text-xs text-gray-400 mt-0.5">{subValue}</p>}
      </div>
    </div>
  </motion.div>
);

// Time Distribution Chart Component
const TimeDistributionChart: React.FC<{
  data: DailyData[];
  timeRange: TimeRange;
}> = ({ data, timeRange }) => {
  const maxMinutes = Math.max(...data.map(d => d.focusMinutes), 1);

  const formatLabel = (item: DailyData): string => {
    if (timeRange === 'daily') {
      return item.dayOfWeek.slice(0, 3);
    }
    if (timeRange === 'weekly') {
      return `W${data.indexOf(item) + 1}`;
    }
    return new Date(item.date).toLocaleDateString('en-US', { month: 'short' });
  };

  return (
    <div className="h-48 flex items-end justify-between gap-2 px-2">
      {data.map((item, index) => {
        const heightPercent = (item.focusMinutes / maxMinutes) * 100;
        const isToday = item.date === new Date().toISOString().split('T')[0];

        return (
          <div
            key={item.date}
            className="flex-1 flex flex-col items-center gap-2 max-w-12"
          >
            <div className="relative w-full h-32 flex items-end justify-center">
              <motion.div
                className={`w-full rounded-t-lg ${
                  isToday
                    ? 'bg-gradient-to-t from-blue-600 to-blue-400'
                    : 'bg-gradient-to-t from-gray-700 to-gray-600'
                }`}
                style={{ originY: 1 }}
                variants={chartBarVariants}
                custom={index}
                initial="hidden"
                animate="visible"
                whileHover={{ filter: 'brightness(1.1)' }}
              >
                <div style={{ height: `${Math.max(heightPercent, 4)}%` }} className="min-h-[4px] rounded-t-lg" />
              </motion.div>

              {/* Tooltip on hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-gray-800 px-2 py-1 rounded text-xs text-white whitespace-nowrap shadow-lg">
                  {formatDuration(item.focusMinutes)}
                </div>
              </div>
            </div>

            <span className={`text-xs ${isToday ? 'text-blue-400 font-medium' : 'text-gray-500'}`}>
              {formatLabel(item)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Progress Ring Component
const ProgressRing: React.FC<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}> = ({ progress, size = 120, strokeWidth = 8, color = '#3b82f6' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <motion.span
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(progress)}%
          </motion.span>
        </div>
      </div>
    </div>
  );
};

// Streak Display Component
const StreakDisplay: React.FC<{
  currentStreak: number;
  longestStreak: number;
}> = ({ currentStreak, longestStreak }) => {
  const streakDays = Array.from({ length: 7 }, (_, i) => i < currentStreak);

  return (
    <motion.div
      className="p-5 rounded-xl bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
      variants={cardVariants}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{currentStreak}</p>
            <p className="text-sm text-orange-400/80">Day Streak</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Best</p>
          <p className="text-lg font-semibold text-gray-300">{longestStreak} days</p>
        </div>
      </div>

      {/* Week Visualization */}
      <div className="flex items-center justify-between gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <motion.div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                streakDays[index]
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-600'
              }`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.05 + 0.3 }}
            >
              {streakDays[index] && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              )}
            </motion.div>
            <span className="text-xs text-gray-500">{day}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export const FocusStatsDashboard: React.FC<FocusStatsDashboardProps> = ({
  isVisible,
  stats,
  dailyData,
  onClose,
  userId,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const now = new Date();
    let daysToShow = 7;

    if (timeRange === 'daily') daysToShow = 7;
    else if (timeRange === 'weekly') daysToShow = 7;
    else if (timeRange === 'monthly') daysToShow = 30;

    // Generate placeholder data if needed
    const result: DailyData[] = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const existingData = dailyData.find(d => d.date === dateStr);
      if (existingData) {
        result.push(existingData);
      } else {
        result.push({
          date: dateStr,
          focusMinutes: 0,
          sessionsCompleted: 0,
          dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
        });
      }
    }

    return result;
  }, [dailyData, timeRange]);

  // Calculate period stats
  const periodStats = useMemo(() => {
    const totalMinutes = filteredData.reduce((sum, d) => sum + d.focusMinutes, 0);
    const totalSessions = filteredData.reduce((sum, d) => sum + d.sessionsCompleted, 0);
    const avgMinutesPerDay = totalMinutes / filteredData.length;

    return { totalMinutes, totalSessions, avgMinutesPerDay };
  }, [filteredData]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl"
            variants={cardVariants}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Focus Statistics</h2>
                  <p className="text-sm text-gray-400 mt-1">Track your productivity journey</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-4">
                {(['overview', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard
                        icon={
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        label="Total Focus"
                        value={formatDuration(stats.totalFocusTime)}
                        subValue={`${formatHours(stats.totalFocusTime)} total`}
                        color="bg-blue-400"
                        bgColor="bg-gray-800/50"
                      />
                      <StatCard
                        icon={
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        label="Sessions"
                        value={stats.completedSessions}
                        subValue={`of ${stats.totalSessions} total`}
                        color="bg-green-400"
                        bgColor="bg-gray-800/50"
                      />
                      <StatCard
                        icon={
                          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        }
                        label="Avg Session"
                        value={formatDuration(Math.round(stats.averageSessionLength))}
                        color="bg-purple-400"
                        bgColor="bg-gray-800/50"
                      />
                      <StatCard
                        icon={
                          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        }
                        label="This Week"
                        value={stats.sessionsThisWeek}
                        subValue={formatDuration(stats.focusTimeThisWeek)}
                        color="bg-yellow-400"
                        bgColor="bg-gray-800/50"
                      />
                    </div>

                    {/* Completion Rate + Time Chart Row */}
                    <div className="grid md:grid-cols-5 gap-6">
                      {/* Completion Rate */}
                      <motion.div
                        className="md:col-span-2 p-5 rounded-xl bg-gray-800/50 border border-gray-700/50"
                        variants={cardVariants}
                      >
                        <h3 className="text-sm font-medium text-gray-400 mb-4">Completion Rate</h3>
                        <div className="flex items-center justify-center">
                          <ProgressRing
                            progress={stats.completionRate}
                            color={
                              stats.completionRate >= 80
                                ? '#10b981'
                                : stats.completionRate >= 60
                                ? '#3b82f6'
                                : '#f59e0b'
                            }
                          />
                        </div>
                        <p className="text-center text-sm text-gray-500 mt-4">
                          {stats.completedSessions} of {stats.totalSessions} sessions completed
                        </p>
                      </motion.div>

                      {/* Time Distribution Chart */}
                      <motion.div
                        className="md:col-span-3 p-5 rounded-xl bg-gray-800/50 border border-gray-700/50"
                        variants={cardVariants}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-gray-400">Focus Time</h3>
                          <div className="flex gap-1">
                            {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                              <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                  timeRange === range
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-400 hover:text-white'
                                }`}
                              >
                                {range.charAt(0).toUpperCase() + range.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <TimeDistributionChart data={filteredData} timeRange={timeRange} />
                      </motion.div>
                    </div>

                    {/* Streak Section */}
                    <StreakDisplay
                      currentStreak={stats.currentStreak}
                      longestStreak={stats.longestStreak}
                    />

                    {/* Period Summary */}
                    <motion.div
                      className="p-5 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20"
                      variants={cardVariants}
                    >
                      <h3 className="text-sm font-medium text-gray-400 mb-3">
                        {timeRange === 'daily' ? 'This Week' : timeRange === 'weekly' ? 'Last 7 Days' : 'Last 30 Days'}
                      </h3>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {formatDuration(periodStats.totalMinutes)}
                          </p>
                          <p className="text-xs text-gray-500">Total Focus</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">{periodStats.totalSessions}</p>
                          <p className="text-xs text-gray-500">Sessions</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {formatDuration(Math.round(periodStats.avgMinutesPerDay))}
                          </p>
                          <p className="text-xs text-gray-500">Daily Avg</p>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {activeTab === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-medium text-gray-400 mb-4">Recent Sessions</h3>

                    {filteredData
                      .filter(d => d.sessionsCompleted > 0)
                      .reverse()
                      .map((day, index) => (
                        <motion.div
                          key={day.date}
                          className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50 border border-gray-700/50"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                              <span className="text-lg font-bold text-blue-400">
                                {new Date(day.date).getDate()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-white">{day.dayOfWeek}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(day.date).toLocaleDateString('en-US', {
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-white">{formatDuration(day.focusMinutes)}</p>
                            <p className="text-sm text-gray-500">
                              {day.sessionsCompleted} session{day.sessionsCompleted !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </motion.div>
                      ))}

                    {filteredData.filter(d => d.sessionsCompleted > 0).length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-400 font-medium">No sessions yet</p>
                        <p className="text-gray-600 text-sm mt-1">Start a focus session to see your history</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FocusStatsDashboard;
