import React, { useState, useEffect, useRef } from 'react';
import { Contact } from '../../types';
import { OnlineIndicator } from '../UserContact/OnlineIndicator';
import { RelationshipScoreBadge } from './RelationshipHealthCard';
import { LeadGradeBadge } from './LeadScoreIndicator';
import {
  RelationshipProfile,
  LeadScore,
  getRelationshipHealthColor,
} from '../../types/relationshipTypes';

interface ContactsListProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  viewStyle: 'list' | 'grid';
  isLoading?: boolean;
  // New relationship intelligence props
  relationshipProfiles?: Map<string, RelationshipProfile>;
  leadScores?: Map<string, LeadScore>;
}

const PAGE_SIZE = 50;

export const ContactsList: React.FC<ContactsListProps> = ({
  contacts,
  onSelectContact,
  selectedIds,
  onToggleSelection,
  viewStyle,
  isLoading,
  relationshipProfiles,
  leadScores,
}) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < contacts.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, contacts.length));
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [contacts.length, visibleCount]);

  // Reset visible count when contacts change (e.g. search/filter)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [contacts]); // Careful: if contacts object ref changes often this might reset scroll. Assuming filteredContacts memoized upstream.

  const visibleContacts = contacts.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <i className="fa-solid fa-user-slash text-4xl mb-4 text-zinc-200 dark:text-zinc-800"></i>
        <p>No contacts found.</p>
      </div>
    );
  }

  const renderStatus = (status: string) => {
    const color = status === 'online' ? 'bg-emerald-500' : status === 'busy' ? 'bg-red-500' : 'bg-zinc-400';
    return <div className={`w-2.5 h-2.5 rounded-full border border-white dark:border-zinc-900 ${color}`} title={status}></div>;
  };

  return (
    <div className="flex-1 overflow-y-auto h-full p-4 bg-white dark:bg-zinc-950">
      {viewStyle === 'list' ? (
        <div className="w-full">
           <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-zinc-950 z-10">
              <div className="col-span-1 text-center"></div>
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Company</div>
              <div className="col-span-2 text-center">Health</div>
              <div className="col-span-1 text-center">Lead</div>
          </div>
          {visibleContacts.map((contact) => {
            const profile = relationshipProfiles?.get(contact.email || '');
            const leadScore = leadScores?.get(contact.email || '');

            return (
              <div
                key={contact.id}
                className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 items-center group transition cursor-pointer ${selectedIds.has(contact.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                onClick={() => onSelectContact(contact)}
              >
                <div className="col-span-1 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => onToggleSelection(contact.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700"
                  />
                </div>
                <div className="col-span-3 flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full ${contact.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                      {contact.name.charAt(0)}
                    </div>
                    {profile?.isVip && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                        <i className="fa-solid fa-star text-[8px] text-white"></i>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-white text-sm">{contact.name}</div>
                    <div className="text-[10px] text-zinc-500">{contact.role}</div>
                  </div>
                </div>
                <div className="col-span-3 text-sm text-zinc-600 dark:text-zinc-400 truncate">{contact.email}</div>
                <div className="col-span-2 text-sm text-zinc-600 dark:text-zinc-400 truncate">{contact.company || '-'}</div>

                {/* Relationship Health Column */}
                <div className="col-span-2 flex justify-center">
                  {profile ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden"
                        title={`Relationship Health: ${profile.relationshipScore}%`}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${profile.relationshipScore}%`,
                            backgroundColor: getRelationshipHealthColor(profile.relationshipScore),
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-500">
                        {profile.relationshipScore}
                      </span>
                      {profile.relationshipTrend === 'rising' && (
                        <i className="fa-solid fa-arrow-up text-[10px] text-green-500"></i>
                      )}
                      {profile.relationshipTrend === 'falling' && (
                        <i className="fa-solid fa-arrow-down text-[10px] text-red-500"></i>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  )}
                </div>

                {/* Lead Grade Column */}
                <div className="col-span-1 flex justify-center">
                  {leadScore ? (
                    <LeadGradeBadge grade={leadScore.leadGrade} size="sm" />
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleContacts.map((contact) => {
            const profile = relationshipProfiles?.get(contact.email || '');
            const contactLeadScore = leadScores?.get(contact.email || '');

            return (
              <div
                key={contact.id}
                className={`bg-white dark:bg-zinc-900 border ${selectedIds.has(contact.id) ? 'border-blue-500' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group relative cursor-pointer shadow-sm hover:shadow-md`}
                onClick={() => onSelectContact(contact)}
              >
                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => onToggleSelection(contact.id)}
                    className="opacity-0 group-hover:opacity-100 checked:opacity-100 transition cursor-pointer rounded border-zinc-300"
                    aria-label={`Select ${contact.name}`}
                  />
                </div>

                {/* Lead Grade Badge */}
                {contactLeadScore && (
                  <div className="absolute top-3 right-3">
                    <LeadGradeBadge grade={contactLeadScore.leadGrade} size="sm" />
                  </div>
                )}

                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full ${contact.avatarColor} flex items-center justify-center text-lg font-bold text-white flex-shrink-0`}>
                      {contact.name.charAt(0)}
                    </div>
                    {contact.pulseUserId ? (
                      <div className="absolute bottom-0 right-0">
                        <OnlineIndicator userId={contact.pulseUserId} size="medium" />
                      </div>
                    ) : (
                      <div className="absolute bottom-0 right-0">{renderStatus(contact.status)}</div>
                    )}
                    {profile?.isVip && (
                      <div className="absolute -top-1 -left-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                        <i className="fa-solid fa-star text-[10px] text-white"></i>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-zinc-900 dark:text-white font-semibold text-base truncate">{contact.name}</h3>
                    <p className="text-zinc-500 text-xs truncate">{contact.role}</p>
                  </div>
                </div>

                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 truncate">
                  <i className="fa-regular fa-envelope mr-2 opacity-50"></i>
                  {contact.email || 'No email'}
                </div>

                {contact.company && (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                     <i className="fa-regular fa-building mr-2 opacity-50"></i>
                     {contact.company}
                  </div>
                )}

                {/* Relationship Health Bar */}
                {profile && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-zinc-500 font-medium">Relationship Health</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold" style={{ color: getRelationshipHealthColor(profile.relationshipScore) }}>
                          {profile.relationshipScore}%
                        </span>
                        {profile.relationshipTrend === 'rising' && (
                          <i className="fa-solid fa-arrow-up text-[8px] text-green-500"></i>
                        )}
                        {profile.relationshipTrend === 'falling' && (
                          <i className="fa-solid fa-arrow-down text-[8px] text-red-500"></i>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${profile.relationshipScore}%`,
                          backgroundColor: getRelationshipHealthColor(profile.relationshipScore),
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* AI Insight - Show only when there's a lead score or buying signals */}
                {contactLeadScore && contactLeadScore.leadStatus === 'hot' && (
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <i className="fa-solid fa-fire text-orange-500 text-xs"></i>
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">Hot Lead</span>
                  </div>
                )}
                {contactLeadScore && contactLeadScore.leadStatus === 'warm' && !profile && (
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <i className="fa-solid fa-handshake text-blue-500 text-xs"></i>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Warm Lead</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Loading Sentinel */}
      <div ref={observerTarget} className="h-8 w-full"></div>
    </div>
  );
};
