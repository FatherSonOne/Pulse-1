import React, { useState, useEffect, useCallback } from 'react';
import { saveTestResult, loadTestResults, saveTesterName, clearTestResults, TestStatus } from '../services/testMatrixService';
import { getSessionUserSync } from '../services/authService';

interface TestCase {
  id: string;
  name: string;
  steps: string[];
  expected: string;
  status: TestStatus;
  notes: string;
}

interface TestSection {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tests: TestCase[];
}

const initialTestData: TestSection[] = [
  {
    id: 'auth',
    title: 'Authentication',
    priority: 'critical',
    tests: [
      { id: 'auth-1', name: 'Google OAuth Login', steps: ['Click "Continue with Google"', 'Complete Google auth'], expected: 'User redirected back, logged in, Dashboard shown', status: 'pending', notes: '' },
      { id: 'auth-2', name: 'Microsoft OAuth Login', steps: ['Click "Continue with Microsoft"', 'Complete MS auth'], expected: 'User redirected back, logged in, Dashboard shown', status: 'pending', notes: '' },
      { id: 'auth-3', name: 'Email Signup', steps: ['Click "Sign in with Email"', 'Click "Create an account"', 'Fill form, submit'], expected: 'Account created, user logged in', status: 'pending', notes: '' },
      { id: 'auth-4', name: 'Email Login', steps: ['Click "Sign in with Email"', 'Enter credentials, submit'], expected: 'User logged in, Dashboard shown', status: 'pending', notes: '' },
      { id: 'auth-5', name: 'Invalid Email Login', steps: ['Enter wrong password'], expected: 'Error message displayed', status: 'pending', notes: '' },
      { id: 'auth-6', name: 'Session Persistence', steps: ['Login', 'Refresh page'], expected: 'User remains logged in', status: 'pending', notes: '' },
      { id: 'auth-7', name: 'Logout', steps: ['Go to Settings', 'Logout'], expected: 'User logged out, Login screen shown', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    priority: 'high',
    tests: [
      { id: 'dash-1', name: 'Dashboard Load', steps: ['Navigate to Dashboard'], expected: 'Dashboard loads with widgets', status: 'pending', notes: '' },
      { id: 'dash-2', name: 'Quick Stats Display', steps: ['View dashboard stats'], expected: 'Shows tasks, messages, focus time', status: 'pending', notes: '' },
      { id: 'dash-3', name: 'Task Widget', steps: ['View task section'], expected: 'Tasks from database displayed', status: 'pending', notes: '' },
      { id: 'dash-4', name: 'Calendar Widget', steps: ['View calendar section'], expected: 'Events from database displayed', status: 'pending', notes: '' },
      { id: 'dash-5', name: 'Navigation', steps: ['Click each nav item'], expected: 'Correct view loads', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'contacts',
    title: 'Contacts',
    priority: 'high',
    tests: [
      { id: 'cont-1', name: 'View Contacts', steps: ['Navigate to Contacts'], expected: 'Contact list displayed', status: 'pending', notes: '' },
      { id: 'cont-2', name: 'Create Contact', steps: ['Click Add, fill form, save'], expected: 'New contact appears in list', status: 'pending', notes: '' },
      { id: 'cont-3', name: 'Edit Contact', steps: ['Click contact, edit, save'], expected: 'Changes persisted', status: 'pending', notes: '' },
      { id: 'cont-4', name: 'Delete Contact', steps: ['Delete a contact'], expected: 'Contact removed from list', status: 'pending', notes: '' },
      { id: 'cont-5', name: 'Search Contacts', steps: ['Type in search bar'], expected: 'Filtered results shown', status: 'pending', notes: '' },
      { id: 'cont-6', name: 'Contact Actions', steps: ['Click message/call buttons'], expected: 'Navigates to correct feature', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'tasks',
    title: 'Tasks',
    priority: 'high',
    tests: [
      { id: 'task-1', name: 'View Tasks', steps: ['Navigate to Calendar/Tasks'], expected: 'Task list displayed', status: 'pending', notes: '' },
      { id: 'task-2', name: 'Create Task', steps: ['Click New Task, fill, save'], expected: 'Task appears in list', status: 'pending', notes: '' },
      { id: 'task-3', name: 'Complete Task', steps: ['Check/uncheck task'], expected: 'Status updates, persists on refresh', status: 'pending', notes: '' },
      { id: 'task-4', name: 'Edit Task', steps: ['Click task, modify, save'], expected: 'Changes persisted', status: 'pending', notes: '' },
      { id: 'task-5', name: 'Delete Task', steps: ['Delete a task'], expected: 'Task removed', status: 'pending', notes: '' },
      { id: 'task-6', name: 'Task Priority', steps: ['Set different priorities'], expected: 'Visual indicator changes', status: 'pending', notes: '' },
      { id: 'task-7', name: 'Real-time Updates', steps: ['Create task in another tab'], expected: 'Task appears in first tab', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'calendar',
    title: 'Calendar',
    priority: 'high',
    tests: [
      { id: 'cal-1', name: 'View Calendar', steps: ['Navigate to Calendar'], expected: 'Calendar displayed with events', status: 'pending', notes: '' },
      { id: 'cal-2', name: 'Create Event', steps: ['Click date, fill form, save'], expected: 'Event appears on calendar', status: 'pending', notes: '' },
      { id: 'cal-3', name: 'Edit Event', steps: ['Click event, modify, save'], expected: 'Changes persisted', status: 'pending', notes: '' },
      { id: 'cal-4', name: 'Delete Event', steps: ['Delete an event'], expected: 'Event removed from calendar', status: 'pending', notes: '' },
      { id: 'cal-5', name: 'Month Navigation', steps: ['Click prev/next month'], expected: 'Calendar updates correctly', status: 'pending', notes: '' },
      { id: 'cal-6', name: 'Quick Scheduler', steps: ['Use quick scheduler widget'], expected: 'Event created successfully', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'messages',
    title: 'Messages',
    priority: 'high',
    tests: [
      { id: 'msg-1', name: 'View Messages', steps: ['Navigate to Messages'], expected: 'Message threads displayed', status: 'pending', notes: '' },
      { id: 'msg-2', name: 'Open Thread', steps: ['Click a thread'], expected: 'Messages shown', status: 'pending', notes: '' },
      { id: 'msg-3', name: 'Send Message', steps: ['Type and send message'], expected: 'Message appears in thread', status: 'pending', notes: '' },
      { id: 'msg-4', name: 'Real-time Receive', steps: ['Receive message from another user'], expected: 'Message appears immediately', status: 'pending', notes: '' },
      { id: 'msg-5', name: 'Search Messages', steps: ['Use search function'], expected: 'Relevant messages found', status: 'pending', notes: '' },
      { id: 'msg-6', name: 'Message Status', steps: ['Send message'], expected: 'Shows sent/delivered status', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'email',
    title: 'Email',
    priority: 'medium',
    tests: [
      { id: 'email-1', name: 'View Email', steps: ['Navigate to Email'], expected: 'Email inbox displayed', status: 'pending', notes: '' },
      { id: 'email-2', name: 'Read Email', steps: ['Click an email'], expected: 'Email content shown', status: 'pending', notes: '' },
      { id: 'email-3', name: 'Compose Email', steps: ['Click compose'], expected: 'Email composer opens', status: 'pending', notes: '' },
      { id: 'email-4', name: 'Send Email', steps: ['Compose and send'], expected: 'Email sent (if connected)', status: 'pending', notes: '' },
      { id: 'email-5', name: 'Star Email', steps: ['Click star icon'], expected: 'Email starred', status: 'pending', notes: '' },
      { id: 'email-6', name: 'Folder Navigation', steps: ['Click different folders'], expected: 'Correct emails shown', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'ai',
    title: 'AI Features',
    priority: 'medium',
    tests: [
      { id: 'ai-1', name: 'Live AI Session', steps: ['Start Live AI session'], expected: 'Audio/video interface loads', status: 'pending', notes: '' },
      { id: 'ai-2', name: 'Gemini Chat', steps: ['Ask a question'], expected: 'AI responds', status: 'pending', notes: '' },
      { id: 'ai-3', name: 'Research (Perplexity)', steps: ['Navigate to Research, query'], expected: 'Search results displayed', status: 'pending', notes: '' },
      { id: 'ai-4', name: 'AI Lab Tools', steps: ['Try each AI Lab tool'], expected: 'Tools function correctly', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'integrations',
    title: 'Integrations',
    priority: 'medium',
    tests: [
      { id: 'int-1', name: 'Slack Messages', steps: ['View Slack integration'], expected: 'Slack messages displayed', status: 'pending', notes: '' },
      { id: 'int-2', name: 'Calendar Sync', steps: ['Check calendar sync status'], expected: 'Shows sync indicator if connected', status: 'pending', notes: '' },
      { id: 'int-3', name: 'Contact Import', steps: ['Import contacts from provider'], expected: 'Contacts imported to database', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'settings',
    title: 'Settings',
    priority: 'low',
    tests: [
      { id: 'set-1', name: 'Theme Toggle', steps: ['Switch dark/light mode'], expected: 'Theme changes, persists', status: 'pending', notes: '' },
      { id: 'set-2', name: 'Profile View', steps: ['View profile section'], expected: 'User info displayed', status: 'pending', notes: '' },
      { id: 'set-3', name: 'Provider Connect', steps: ['Connect additional provider'], expected: 'Connection flow starts', status: 'pending', notes: '' },
    ]
  },
  // Phase 6-7: War Room / NotebookLM Features
  {
    id: 'warroom',
    title: 'War Room / Projects',
    priority: 'high',
    tests: [
      { id: 'wr-1', name: 'Create Project', steps: ['Click New Project', 'Enter name and description', 'Save'], expected: 'Project created, appears in list', status: 'pending', notes: '' },
      { id: 'wr-2', name: 'Open Project', steps: ['Click on a project'], expected: 'War Room opens with project context', status: 'pending', notes: '' },
      { id: 'wr-3', name: 'Edit Project', steps: ['Open project settings', 'Modify name/color/icon', 'Save'], expected: 'Changes persisted', status: 'pending', notes: '' },
      { id: 'wr-4', name: 'Delete Project', steps: ['Open project settings', 'Click delete', 'Confirm'], expected: 'Project and sessions deleted', status: 'pending', notes: '' },
      { id: 'wr-5', name: 'Archive Project', steps: ['Open project settings', 'Click archive'], expected: 'Project hidden from main list', status: 'pending', notes: '' },
      { id: 'wr-6', name: 'Project Color/Icon', steps: ['Change project color and icon'], expected: 'Visual changes reflected immediately', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'documents',
    title: 'Document Management',
    priority: 'high',
    tests: [
      { id: 'doc-1', name: 'Upload Text File', steps: ['Click upload in sidebar', 'Select .txt file'], expected: 'File uploaded, text extracted, appears in list', status: 'pending', notes: '' },
      { id: 'doc-2', name: 'Upload PDF', steps: ['Click upload', 'Select .pdf file'], expected: 'PDF processed, text extracted', status: 'pending', notes: '' },
      { id: 'doc-3', name: 'Upload DOCX', steps: ['Click upload', 'Select .docx file'], expected: 'DOCX processed, text extracted', status: 'pending', notes: '' },
      { id: 'doc-4', name: 'Upload Image (OCR)', steps: ['Click upload', 'Select image with text'], expected: 'OCR extracts text from image', status: 'pending', notes: '' },
      { id: 'doc-5', name: 'Upload Excel', steps: ['Click upload', 'Select .xlsx file'], expected: 'Spreadsheet data extracted', status: 'pending', notes: '' },
      { id: 'doc-6', name: 'View Document', steps: ['Click document in sidebar'], expected: 'Document viewer opens with content', status: 'pending', notes: '' },
      { id: 'doc-7', name: 'Delete Document', steps: ['Click delete on document'], expected: 'Document removed from list and context', status: 'pending', notes: '' },
      { id: 'doc-8', name: 'Add to Context', steps: ['Toggle document checkbox'], expected: 'Document added to AI context', status: 'pending', notes: '' },
      { id: 'doc-9', name: 'Remove from Context', steps: ['Uncheck document checkbox'], expected: 'Document removed from AI context', status: 'pending', notes: '' },
      { id: 'doc-10', name: 'Bulk Select', steps: ['Select All checkbox'], expected: 'All documents selected for context', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'docsearch',
    title: 'Document Search',
    priority: 'medium',
    tests: [
      { id: 'search-1', name: 'Basic Search', steps: ['Type query in search box'], expected: 'Results appear as you type', status: 'pending', notes: '' },
      { id: 'search-2', name: 'Search All Docs', steps: ['Set scope to All Docs', 'Search'], expected: 'Searches across all project documents', status: 'pending', notes: '' },
      { id: 'search-3', name: 'Search Active Context', steps: ['Set scope to Active Context', 'Search'], expected: 'Only searches selected documents', status: 'pending', notes: '' },
      { id: 'search-4', name: 'Click Search Result', steps: ['Click on a search result'], expected: 'Document viewer opens, term highlighted', status: 'pending', notes: '' },
      { id: 'search-5', name: 'Filter by Type', steps: ['Filter search by file type'], expected: 'Results filtered by selected type', status: 'pending', notes: '' },
      { id: 'search-6', name: 'No Results', steps: ['Search for non-existent term'], expected: 'No results message displayed', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'highlights',
    title: 'Highlights & Annotations',
    priority: 'medium',
    tests: [
      { id: 'hl-1', name: 'Create Highlight', steps: ['Select text in document', 'Choose color'], expected: 'Text highlighted with chosen color', status: 'pending', notes: '' },
      { id: 'hl-2', name: 'Add Note to Highlight', steps: ['Click highlight', 'Add note'], expected: 'Note saved with highlight', status: 'pending', notes: '' },
      { id: 'hl-3', name: 'Delete Highlight', steps: ['Click highlight', 'Delete'], expected: 'Highlight removed', status: 'pending', notes: '' },
      { id: 'hl-4', name: 'Create Annotation', steps: ['Click annotation tool', 'Add text'], expected: 'Annotation marker appears', status: 'pending', notes: '' },
      { id: 'hl-5', name: 'View Annotation', steps: ['Click annotation marker'], expected: 'Annotation content displayed', status: 'pending', notes: '' },
      { id: 'hl-6', name: 'Resolve Annotation', steps: ['Mark annotation as resolved'], expected: 'Status updated to resolved', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'collections',
    title: 'Tags & Collections',
    priority: 'medium',
    tests: [
      { id: 'coll-1', name: 'Create Tag', steps: ['Go to tags', 'Create new tag'], expected: 'Tag created with color/icon', status: 'pending', notes: '' },
      { id: 'coll-2', name: 'Apply Tag to Doc', steps: ['Select document', 'Add tag'], expected: 'Tag appears on document', status: 'pending', notes: '' },
      { id: 'coll-3', name: 'Filter by Tag', steps: ['Click tag to filter'], expected: 'Only tagged documents shown', status: 'pending', notes: '' },
      { id: 'coll-4', name: 'Create Collection', steps: ['Create new collection'], expected: 'Collection created', status: 'pending', notes: '' },
      { id: 'coll-5', name: 'Add Doc to Collection', steps: ['Add document to collection'], expected: 'Document appears in collection', status: 'pending', notes: '' },
      { id: 'coll-6', name: 'Smart Collection', steps: ['Create smart collection with rules'], expected: 'Documents auto-filtered by rules', status: 'pending', notes: '' },
      { id: 'coll-7', name: 'Favorite Document', steps: ['Click star on document'], expected: 'Document added to favorites', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'sharing',
    title: 'Sharing & Collaboration',
    priority: 'medium',
    tests: [
      { id: 'share-1', name: 'Share Document', steps: ['Click share on document', 'Enter email'], expected: 'Share invitation sent', status: 'pending', notes: '' },
      { id: 'share-2', name: 'Share with Permissions', steps: ['Set view/edit/comment permissions'], expected: 'Permissions applied correctly', status: 'pending', notes: '' },
      { id: 'share-3', name: 'Generate Public Link', steps: ['Create public share link'], expected: 'Link generated, works without login', status: 'pending', notes: '' },
      { id: 'share-4', name: 'Revoke Share', steps: ['Remove share access'], expected: 'User loses access', status: 'pending', notes: '' },
      { id: 'share-5', name: 'View Activity Feed', steps: ['Open activity feed'], expected: 'Shows recent actions on shared items', status: 'pending', notes: '' },
      { id: 'share-6', name: 'Share Project', steps: ['Share entire project'], expected: 'All project docs accessible', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'ragchat',
    title: 'RAG Chat & AI Context',
    priority: 'high',
    tests: [
      { id: 'rag-1', name: 'Chat with Context', steps: ['Add docs to context', 'Ask question'], expected: 'AI references document content', status: 'pending', notes: '' },
      { id: 'rag-2', name: 'Citation Display', steps: ['Ask factual question'], expected: 'Citations shown with source docs', status: 'pending', notes: '' },
      { id: 'rag-3', name: 'Click Citation', steps: ['Click on citation link'], expected: 'Opens document at cited section', status: 'pending', notes: '' },
      { id: 'rag-4', name: 'No Context Chat', steps: ['Remove all docs from context', 'Ask question'], expected: 'AI responds without document knowledge', status: 'pending', notes: '' },
      { id: 'rag-5', name: 'Multi-Doc Context', steps: ['Add multiple docs', 'Ask cross-doc question'], expected: 'AI synthesizes from multiple sources', status: 'pending', notes: '' },
      { id: 'rag-6', name: 'Context Limit', steps: ['Add many large docs'], expected: 'Graceful handling of context limits', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'pwa',
    title: 'PWA & Offline',
    priority: 'medium',
    tests: [
      { id: 'pwa-1', name: 'Install PWA', steps: ['Click install prompt', 'Add to home screen'], expected: 'App installed as PWA', status: 'pending', notes: '' },
      { id: 'pwa-2', name: 'Offline Access', steps: ['Go offline', 'Open app'], expected: 'Cached content available', status: 'pending', notes: '' },
      { id: 'pwa-3', name: 'Offline Document View', steps: ['Go offline', 'View cached document'], expected: 'Document displays from cache', status: 'pending', notes: '' },
      { id: 'pwa-4', name: 'Sync on Reconnect', steps: ['Make changes offline', 'Go online'], expected: 'Changes sync to server', status: 'pending', notes: '' },
      { id: 'pwa-5', name: 'Push Notifications', steps: ['Enable notifications', 'Trigger event'], expected: 'Notification received', status: 'pending', notes: '' },
      { id: 'pwa-6', name: 'Cache Management', steps: ['Check storage usage'], expected: 'Cache size reasonable', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'mobile',
    title: 'Mobile Experience',
    priority: 'medium',
    tests: [
      { id: 'mob-1', name: 'Responsive Layout', steps: ['View on mobile device'], expected: 'Layout adapts correctly', status: 'pending', notes: '' },
      { id: 'mob-2', name: 'Touch Gestures', steps: ['Swipe to navigate'], expected: 'Swipe gestures work', status: 'pending', notes: '' },
      { id: 'mob-3', name: 'Pull to Refresh', steps: ['Pull down on list'], expected: 'Content refreshes', status: 'pending', notes: '' },
      { id: 'mob-4', name: 'Mobile Navigation', steps: ['Use bottom nav bar'], expected: 'Navigation works correctly', status: 'pending', notes: '' },
      { id: 'mob-5', name: 'Mobile Document Viewer', steps: ['Open document on mobile'], expected: 'Document readable, scrollable', status: 'pending', notes: '' },
      { id: 'mob-6', name: 'Mobile Upload', steps: ['Upload file from mobile'], expected: 'File picker works, upload succeeds', status: 'pending', notes: '' },
      { id: 'mob-7', name: 'Keyboard Handling', steps: ['Focus input on mobile'], expected: 'Keyboard appears, input visible', status: 'pending', notes: '' },
    ]
  },
  {
    id: 'performance',
    title: 'Performance',
    priority: 'low',
    tests: [
      { id: 'perf-1', name: 'Initial Load Time', steps: ['Clear cache, load app'], expected: 'App loads in < 3 seconds', status: 'pending', notes: '' },
      { id: 'perf-2', name: 'Document List Scroll', steps: ['Scroll through 50+ documents'], expected: 'Smooth scrolling, no lag', status: 'pending', notes: '' },
      { id: 'perf-3', name: 'Large Document View', steps: ['Open document with 10K+ words'], expected: 'Renders without freezing', status: 'pending', notes: '' },
      { id: 'perf-4', name: 'Search Performance', steps: ['Search with many documents'], expected: 'Results appear quickly', status: 'pending', notes: '' },
      { id: 'perf-5', name: 'Chat Response Time', steps: ['Send message with context'], expected: 'Response begins < 5 seconds', status: 'pending', notes: '' },
      { id: 'perf-6', name: 'Memory Usage', steps: ['Use app for extended period'], expected: 'Memory stable, no leaks', status: 'pending', notes: '' },
    ]
  },
];

const statusColors: Record<TestStatus, { bg: string; text: string; icon: string }> = {
  pass: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: 'fa-check-circle' },
  fail: { bg: 'bg-red-500/20', text: 'text-red-400', icon: 'fa-times-circle' },
  pending: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: 'fa-clock' },
  blocked: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: 'fa-exclamation-triangle' },
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const TestMatrix: React.FC = () => {
  const [testData, setTestData] = useState<TestSection[]>(initialTestData);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['auth']));
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);
  const [filterStatus, setFilterStatus] = useState<TestStatus | 'all'>('all');
  const [testerName, setTesterName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const user = getSessionUserSync();
  const userId = user?.id || 'anonymous';

  // Load saved test results on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const savedData = await loadTestResults(userId);

        if (savedData.tester_name) {
          setTesterName(savedData.tester_name);
        }

        // Apply saved results to initial test data
        if (Object.keys(savedData.results).length > 0) {
          setTestData(prev => prev.map(section => ({
            ...section,
            tests: section.tests.map(test => {
              const saved = savedData.results[test.id];
              if (saved) {
                return { ...test, status: saved.status, notes: saved.notes };
              }
              return test;
            })
          })));
        }
      } catch (error) {
        console.error('Failed to load test results:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Save a single test result with debounce
  const saveResult = useCallback(async (testId: string, status: TestStatus, notes: string) => {
    setIsSaving(true);
    try {
      await saveTestResult(testId, status, notes, testerName, userId);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save test result:', error);
    } finally {
      setIsSaving(false);
    }
  }, [testerName, userId]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateTestStatus = (sectionId: string, testId: string, status: TestStatus) => {
    let currentNotes = '';
    setTestData(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          tests: section.tests.map(test => {
            if (test.id === testId) {
              currentNotes = test.notes;
              return { ...test, status };
            }
            return test;
          })
        };
      }
      return section;
    }));
    // Save to Supabase
    saveResult(testId, status, currentNotes);
  };

  const updateTestNotes = (sectionId: string, testId: string, notes: string) => {
    let currentStatus: TestStatus = 'pending';
    setTestData(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          tests: section.tests.map(test => {
            if (test.id === testId) {
              currentStatus = test.status;
              return { ...test, notes };
            }
            return test;
          })
        };
      }
      return section;
    }));
    // Save to Supabase
    saveResult(testId, currentStatus, notes);
  };

  // Handle tester name change with debounced save
  const handleTesterNameChange = (name: string) => {
    setTesterName(name);
  };

  // Save tester name when input loses focus
  const handleTesterNameBlur = async () => {
    if (testerName) {
      try {
        await saveTesterName(testerName, userId);
      } catch (error) {
        console.error('Failed to save tester name:', error);
      }
    }
  };

  // Reset all test results
  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all test results? This cannot be undone.')) {
      try {
        await clearTestResults(userId);
        setTestData(initialTestData);
        setTesterName('');
        setLastSaved(null);
      } catch (error) {
        console.error('Failed to reset test results:', error);
      }
    }
  };

  const getStats = () => {
    const allTests = testData.flatMap(s => s.tests);
    return {
      total: allTests.length,
      pass: allTests.filter(t => t.status === 'pass').length,
      fail: allTests.filter(t => t.status === 'fail').length,
      pending: allTests.filter(t => t.status === 'pending').length,
      blocked: allTests.filter(t => t.status === 'blocked').length,
    };
  };

  const stats = getStats();
  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;

  const filteredData = testData.map(section => ({
    ...section,
    tests: filterStatus === 'all'
      ? section.tests
      : section.tests.filter(t => t.status === filterStatus)
  })).filter(section => section.tests.length > 0);

  const exportResults = () => {
    const results = {
      tester: testerName,
      date: new Date().toISOString(),
      stats,
      sections: testData.map(s => ({
        title: s.title,
        tests: s.tests.map(t => ({
          name: t.name,
          status: t.status,
          notes: t.notes
        }))
      }))
    };
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-test-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
          <i className="fa-solid fa-clipboard-check text-white text-2xl"></i>
        </div>
        <div className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Loading Test Matrix...</div>
        <div className="text-sm text-zinc-500">Retrieving your saved progress</div>
        <i className="fa-solid fa-spinner fa-spin text-blue-500 text-xl mt-4"></i>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <i className="fa-solid fa-clipboard-check text-white"></i>
              </div>
              Test Matrix
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Pulse App Pre-Launch Testing Checklist</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Save Status Indicator */}
            {isSaving && (
              <span className="text-sm text-blue-500 flex items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                Saving...
              </span>
            )}
            {!isSaving && lastSaved && (
              <span className="text-sm text-emerald-500 flex items-center gap-2">
                <i className="fa-solid fa-check"></i>
                Saved
              </span>
            )}
            <input
              type="text"
              placeholder="Tester Name"
              value={testerName}
              onChange={(e) => handleTesterNameChange(e.target.value)}
              onBlur={handleTesterNameBlur}
              className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition flex items-center gap-2"
              title="Reset all test results"
            >
              <i className="fa-solid fa-rotate-left"></i>
              Reset
            </button>
            <button
              onClick={exportResults}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition flex items-center gap-2"
            >
              <i className="fa-solid fa-download"></i>
              Export Results
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Total Tests</div>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-500">{stats.pass}</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Passed</div>
          </div>
          <div className="bg-red-500/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-red-500">{stats.fail}</div>
            <div className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide">Failed</div>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-500">{stats.blocked}</div>
            <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide">Blocked</div>
          </div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{passRate}%</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Pass Rate</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.pass / stats.total) * 100}%` }}></div>
          <div className="bg-red-500 transition-all" style={{ width: `${(stats.fail / stats.total) * 100}%` }}></div>
          <div className="bg-amber-500 transition-all" style={{ width: `${(stats.blocked / stats.total) * 100}%` }}></div>
        </div>

        {/* Filter Buttons */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {(['all', 'pending', 'pass', 'fail', 'blocked'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && ` (${stats[status]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Test Sections */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 max-w-6xl mx-auto">
          {filteredData.map(section => (
            <div key={section.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
              >
                <div className="flex items-center gap-4">
                  <span className={`w-3 h-3 rounded-full ${priorityColors[section.priority]}`}></span>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{section.title}</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase">
                    {section.priority}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {section.tests.filter(t => t.status === 'pass').length}/{section.tests.length} passed
                  </span>
                </div>
                <i className={`fa-solid fa-chevron-${expandedSections.has(section.id) ? 'up' : 'down'} text-zinc-400`}></i>
              </button>

              {/* Section Content */}
              {expandedSections.has(section.id) && (
                <div className="border-t border-zinc-200 dark:border-zinc-800">
                  <table className="w-full">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Test Case</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Steps</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Expected</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider w-40">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {section.tests.map(test => (
                        <tr key={test.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                          <td className="px-6 py-4">
                            <div className="font-medium text-zinc-900 dark:text-white">{test.name}</div>
                            {test.notes && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                <i className="fa-solid fa-note-sticky mr-1"></i>
                                {test.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <ol className="text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside space-y-1">
                              {test.steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 hidden lg:table-cell">
                            {test.expected}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1">
                              {(['pass', 'fail', 'blocked', 'pending'] as TestStatus[]).map(status => (
                                <button
                                  key={status}
                                  onClick={() => updateTestStatus(section.id, test.id, status)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                                    test.status === status
                                      ? statusColors[status].bg + ' ' + statusColors[status].text
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                  }`}
                                  title={status.charAt(0).toUpperCase() + status.slice(1)}
                                >
                                  <i className={`fa-solid ${statusColors[status].icon} text-sm`}></i>
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setSelectedTest(test)}
                              className="mt-2 text-xs text-blue-500 hover:text-blue-400 transition w-full"
                            >
                              Add Notes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 max-w-6xl mx-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Critical Priority</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">High Priority</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Medium Priority</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Low Priority</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.pass.bg} ${statusColors.pass.text}`}>
                  <i className={`fa-solid ${statusColors.pass.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Passed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.fail.bg} ${statusColors.fail.text}`}>
                  <i className={`fa-solid ${statusColors.fail.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Failed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.blocked.bg} ${statusColors.blocked.text}`}>
                  <i className={`fa-solid ${statusColors.blocked.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Blocked</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.pending.bg} ${statusColors.pending.text}`}>
                  <i className={`fa-solid ${statusColors.pending.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{selectedTest.name}</h3>
            <p className="text-sm text-zinc-500 mb-4">Add notes about this test case</p>
            <textarea
              value={selectedTest.notes}
              onChange={(e) => {
                const sectionId = testData.find(s => s.tests.some(t => t.id === selectedTest.id))?.id;
                if (sectionId) {
                  updateTestNotes(sectionId, selectedTest.id, e.target.value);
                  setSelectedTest({ ...selectedTest, notes: e.target.value });
                }
              }}
              placeholder="Enter test notes, bugs found, observations..."
              className="w-full h-32 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedTest(null)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestMatrix;
