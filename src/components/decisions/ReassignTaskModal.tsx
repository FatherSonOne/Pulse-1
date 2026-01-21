import React, { useState, useEffect } from 'react';
import { X, User, Search } from 'lucide-react';
import { Task } from '../../services/taskService';
import { Contact } from '../../types';
import { supabase } from '../../services/supabase';
import './ReassignTaskModal.css';

interface ReassignTaskModalProps {
  task: Task;
  currentAssignee?: string;
  onClose: () => void;
  onReassign: (taskId: string, newAssignee: string) => Promise<void>;
}

export const ReassignTaskModal: React.FC<ReassignTaskModalProps> = ({
  task,
  currentAssignee,
  onClose,
  onReassign
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(currentAssignee || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .order('name', { ascending: true });

      if (contactsError) throw contactsError;

      // Convert to Contact type
      const mappedContacts: Contact[] = (contactsData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        role: c.role || '',
        company: c.company,
        email: c.email,
        phone: c.phone,
        avatarColor: c.avatar_color || '#6b7280',
        status: 'offline' as const,
        source: 'local' as const,
        contactType: c.contact_type,
        isTeamMember: c.is_team_member,
      }));

      setContacts(mappedContacts);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Failed to load contacts');
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (contact.company && contact.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleReassign = async () => {
    if (!selectedAssignee) {
      setError('Please select an assignee');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onReassign(task.id, selectedAssignee);
      onClose();
    } catch (err) {
      console.error('Error reassigning task:', err);
      setError('Failed to reassign task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="reassign-modal-overlay" onClick={onClose}>
      <div className="reassign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reassign-modal-header">
          <div className="reassign-modal-header-content">
            <h3>Reassign Task</h3>
            <p className="reassign-modal-task-title">{task.title}</p>
          </div>
          <button
            type="button"
            className="reassign-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="reassign-modal-body">
          {currentAssignee && (
            <div className="reassign-current-assignee">
              <User size={16} />
              <span>
                Current assignee: <strong>{currentAssignee}</strong>
              </span>
            </div>
          )}

          <div className="reassign-search-container">
            <Search size={18} className="reassign-search-icon" />
            <input
              type="text"
              className="reassign-search-input"
              placeholder="Search contacts by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div className="reassign-error">
              {error}
            </div>
          )}

          <div className="reassign-contacts-list">
            {filteredContacts.length === 0 ? (
              <div className="reassign-empty-state">
                <User size={48} color="#ccc" />
                <p>No contacts found</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className={`reassign-contact-item ${
                    selectedAssignee === contact.email ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedAssignee(contact.email)}
                >
                  <div
                    className="reassign-contact-avatar"
                    style={{ backgroundColor: contact.avatarColor }}
                  >
                    {getInitials(contact.name)}
                  </div>
                  <div className="reassign-contact-info">
                    <div className="reassign-contact-name">{contact.name}</div>
                    <div className="reassign-contact-details">
                      {contact.email}
                      {contact.company && ` • ${contact.company}`}
                    </div>
                  </div>
                  {selectedAssignee === contact.email && (
                    <div className="reassign-contact-selected-indicator">
                      ✓
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="reassign-modal-footer">
          <button
            type="button"
            className="reassign-modal-button reassign-modal-button-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="reassign-modal-button reassign-modal-button-primary"
            onClick={handleReassign}
            disabled={!selectedAssignee || isLoading}
          >
            {isLoading ? 'Reassigning...' : 'Reassign Task'}
          </button>
        </div>
      </div>
    </div>
  );
};
