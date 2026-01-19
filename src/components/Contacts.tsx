import React from 'react';
import { Contact } from '../types';
import { ContactsLayout } from './contacts/ContactsLayout';

interface ContactsProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  openAddContact?: boolean;
}

const Contacts: React.FC<ContactsProps> = (props) => {
  return <ContactsLayout {...props} />;
};

export default Contacts;
