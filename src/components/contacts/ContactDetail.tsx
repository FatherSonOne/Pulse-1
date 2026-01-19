import React, { useState, useEffect } from 'react';
import { Contact } from '../../types';
import { ContactAIInsightsTab } from './ContactAIInsightsTab';
import { RelationshipHealthCard, RelationshipScoreBadge } from './RelationshipHealthCard';
import { LeadGradeBadge, LeadStatusBadge } from './LeadScoreIndicator';
import {
  RelationshipProfile,
  RelationshipInsights,
  LeadScore,
  RelationshipSuggestion,
} from '../../types/relationshipTypes';

interface ContactDetailProps {
  contact: Contact | null;
  onClose: () => void;
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onEdit: (contact: Contact) => void;
  // New relationship intelligence props
  relationshipProfile?: RelationshipProfile | null;
  insights?: RelationshipInsights | null;
  leadScore?: LeadScore | null;
  isLoadingInsights?: boolean;
  onRefreshInsights?: () => void;
  onSuggestedAction?: (suggestion: RelationshipSuggestion) => void;
}

export const ContactDetail: React.FC<ContactDetailProps> = ({
  contact,
  onClose,
  onAction,
  onEdit,
  relationshipProfile,
  insights,
  leadScore,
  isLoadingInsights = false,
  onRefreshInsights,
  onSuggestedAction,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'ai'>('overview');

  if (!contact) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <span className="font-semibold text-zinc-900 dark:text-white">Contact Details</span>
        </div>
        <div className="flex gap-2">
           <button onClick={() => onEdit(contact)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition" title="Edit">
             <i className="fa-solid fa-pen"></i>
           </button>
           <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition" title="More">
             <i className="fa-solid fa-ellipsis-vertical"></i>
           </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full ${contact.avatarColor} flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg`}>
                  {contact.name.charAt(0)}
              </div>
              {/* Relationship Score Badge */}
              {relationshipProfile && (
                <div className="absolute -bottom-1 -right-1">
                  <RelationshipScoreBadge
                    score={relationshipProfile.relationshipScore}
                    trend={relationshipProfile.relationshipTrend}
                  />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white text-center">{contact.name}</h2>
            <p className="text-zinc-500 text-sm">{contact.role}</p>
            {contact.company && <p className="text-blue-600 dark:text-blue-400 text-sm font-medium mt-1">{contact.company}</p>}

            {/* Lead Score & Status Badges */}
            {leadScore && (
              <div className="flex items-center gap-2 mt-3">
                <LeadGradeBadge grade={leadScore.leadGrade} size="md" />
                <LeadStatusBadge status={leadScore.leadStatus} />
              </div>
            )}
        </div>

        {/* Action Bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
            <button onClick={() => onAction('message', contact.id)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                <i className="fa-solid fa-message text-xl mb-1"></i>
                <span className="text-xs font-bold uppercase">Message</span>
            </button>
            <button onClick={() => onAction('vox', contact.id)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition">
                <i className="fa-solid fa-walkie-talkie text-xl mb-1"></i>
                <span className="text-xs font-bold uppercase">Vox</span>
            </button>
            <button onClick={() => onAction('meet', contact.id)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition">
                <i className="fa-solid fa-video text-xl mb-1"></i>
                <span className="text-xs font-bold uppercase">Meet</span>
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'overview' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
                Overview
            </button>
            <button 
                onClick={() => setActiveTab('activity')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'activity' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
                Activity
            </button>
            <button 
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'ai' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
                <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                AI Insights
            </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
            <div className="space-y-6">
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Contact Info</h3>
                    {contact.email && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                <i className="fa-solid fa-envelope"></i>
                            </div>
                            <span className="text-zinc-900 dark:text-zinc-300 select-all">{contact.email}</span>
                        </div>
                    )}
                    {contact.phone && (
                         <div className="flex items-center gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                <i className="fa-solid fa-phone"></i>
                            </div>
                            <span className="text-zinc-900 dark:text-zinc-300 select-all">{contact.phone}</span>
                        </div>
                    )}
                    {contact.address && (
                         <div className="flex items-center gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                <i className="fa-solid fa-location-dot"></i>
                            </div>
                            <span className="text-zinc-900 dark:text-zinc-300">{contact.address}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Notes</h3>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 min-h-[100px]">
                        {contact.notes || "No notes added."}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'activity' && (
             <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
                <i className="fa-solid fa-clock-rotate-left text-3xl mb-3"></i>
                <p>No recent activity</p>
            </div>
        )}

        {activeTab === 'ai' && (
            relationshipProfile ? (
              <ContactAIInsightsTab
                profile={relationshipProfile}
                insights={insights || null}
                leadScore={leadScore || null}
                isLoading={isLoadingInsights}
                onRefreshInsights={onRefreshInsights || (() => {})}
                onSuggestedAction={onSuggestedAction}
              />
            ) : (
              <div className="space-y-6">
                {/* Placeholder when no relationship data yet */}
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <i className="fa-solid fa-wand-magic-sparkles text-4xl mb-4 text-purple-400"></i>
                  <h3 className="font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    No Relationship Data Yet
                  </h3>
                  <p className="text-sm text-center max-w-xs">
                    AI insights will appear here once we have interaction history with this contact.
                  </p>
                </div>
              </div>
            )
        )}

      </div>
    </div>
  );
};
