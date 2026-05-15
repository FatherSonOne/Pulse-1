import React from 'react';
import { Contact } from '../types';
import { ContactsLayout } from './contacts/ContactsLayout';

interface ContactsProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  onDeleteContact?: (contactId: string) => Promise<boolean>;
  openAddContact?: boolean;
  isDarkMode?: boolean;
  userId?: string;
  // Map mode was removed — Map is now a top-level AppView (Phase 3 IA
   // promotion). Callers that previously passed 'map' should dispatch
   // `pulse:navigate` with AppView.MAP instead.
  initialMode?: 'today' | 'people' | 'circles';
}

const Contacts: React.FC<ContactsProps> = (props) => {
  return <ContactsLayout {...props} />;
};

export default Contacts;
