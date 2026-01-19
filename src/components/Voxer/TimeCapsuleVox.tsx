// Time Capsule Vox Component
// Schedule voxes to be delivered at a future time

import React, { useState, useRef, useCallback } from 'react';
import { TimeCapsuleVox as TimeCapsuleType, TimeCapsuleRecurrence } from '../../services/voxer/advancedVoxerTypes';
import { Contact } from '../../types';

// ============================================
// TYPES
// ============================================

interface TimeCapsuleVoxProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  currentUserId: string;
  onSchedule: (capsule: Omit<TimeCapsuleType, 'id' | 'status' | 'createdAt'>) => void;
}

interface ScheduledCapsuleCardProps {
  capsule: TimeCapsuleType;
  recipientNames: string[];
  onCancel: (id: string) => void;
  onEdit: (capsule: TimeCapsuleType) => void;
}

// ============================================
// OCCASION PRESETS
// ============================================

const OCCASION_PRESETS = [
  { id: 'birthday', icon: '🎂', label: 'Birthday', color: 'bg-pink-500' },
  { id: 'anniversary', icon: '💕', label: 'Anniversary', color: 'bg-red-500' },
  { id: 'reminder', icon: '⏰', label: 'Reminder', color: 'bg-blue-500' },
  { id: 'check-in', icon: '👋', label: 'Check-in', color: 'bg-emerald-500' },
  { id: 'motivation', icon: '💪', label: 'Motivation', color: 'bg-orange-500' },
  { id: 'gratitude', icon: '🙏', label: 'Gratitude', color: 'bg-purple-500' },
  { id: 'custom', icon: '✨', label: 'Custom', color: 'bg-zinc-500' },
];

// ============================================
// MAIN TIME CAPSULE COMPONENT
// ============================================

export const TimeCapsuleVox: React.FC<TimeCapsuleVoxProps> = ({
  isOpen,
  onClose,
  contacts,
  currentUserId,
  onSchedule,
}) => {
  // State
  const [step, setStep] = useState<'record' | 'recipients' | 'schedule'>('record');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [recurrence, setRecurrence] = useState<TimeCapsuleRecurrence>('once');
  const [occasion, setOccasion] = useState('custom');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notifyBefore, setNotifyBefore] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // RECORDING FUNCTIONS
  // ============================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setAudioDuration(0);

      timerRef.current = setInterval(() => {
        setAudioDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 100);

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ============================================
  // NAVIGATION
  // ============================================

  const handleNext = () => {
    if (step === 'record' && audioBlob) {
      setStep('recipients');
    } else if (step === 'recipients' && selectedRecipients.length > 0) {
      setStep('schedule');
    }
  };

  const handleBack = () => {
    if (step === 'recipients') {
      setStep('record');
    } else if (step === 'schedule') {
      setStep('recipients');
    }
  };

  const handleSchedule = () => {
    // Combine date and time
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const deliveryDate = new Date(scheduledDate);
    deliveryDate.setHours(hours, minutes, 0, 0);

    onSchedule({
      voxId: `capsule-vox-${Date.now()}`,
      senderId: currentUserId,
      recipientIds: selectedRecipients,
      scheduledFor: deliveryDate,
      recurrence,
      title: title || undefined,
      message: message || undefined,
      occasion,
      notifyBeforeSend: notifyBefore ? 30 : undefined,
    });

    // Reset and close
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setStep('record');
    setAudioBlob(null);
    setAudioDuration(0);
    setSelectedRecipients([]);
    setScheduledDate(new Date());
    setScheduledTime('09:00');
    setRecurrence('once');
    setOccasion('custom');
    setTitle('');
    setMessage('');
    setNotifyBefore(false);
  };

  // ============================================
  // TOGGLE RECIPIENT
  // ============================================

  const toggleRecipient = (contactId: string) => {
    setSelectedRecipients(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-scaleIn">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div>
                <h2 className="font-bold text-lg dark:text-white">Time Capsule</h2>
                <p className="text-xs text-zinc-500">Schedule a vox for the future</p>
              </div>
            </div>
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {['record', 'recipients', 'schedule'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 ${step === s ? 'text-purple-500' : 'text-zinc-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s ? 'bg-purple-500 text-white' : 
                    ['record', 'recipients', 'schedule'].indexOf(step) > i ? 'bg-emerald-500 text-white' :
                    'bg-zinc-200 dark:bg-zinc-700'
                  }`}>
                    {['record', 'recipients', 'schedule'].indexOf(step) > i ? (
                      <i className="fa-solid fa-check text-[10px]"></i>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className="text-xs font-medium capitalize hidden sm:inline">{s}</span>
                </div>
                {i < 2 && <div className="flex-1 h-0.5 bg-zinc-200 dark:bg-zinc-700" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          
          {/* Step 1: Record */}
          {step === 'record' && (
            <div className="space-y-6">
              {/* Occasion Selection */}
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-3 block">
                  What's the occasion?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {OCCASION_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setOccasion(preset.id)}
                      className={`p-3 rounded-xl border-2 transition flex flex-col items-center gap-1 ${
                        occasion === preset.id 
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <span className="text-2xl">{preset.icon}</span>
                      <span className="text-[10px] text-zinc-600 dark:text-zinc-400">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Happy Birthday!"
                  className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
              </div>

              {/* Recording Area */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6">
                {audioBlob ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                      <i className="fa-solid fa-check text-2xl text-emerald-500"></i>
                    </div>
                    <p className="font-semibold dark:text-white">Recorded!</p>
                    <p className="text-sm text-zinc-500">{audioDuration} seconds</p>
                    <button
                      onClick={() => setAudioBlob(null)}
                      className="mt-3 text-sm text-purple-500 hover:text-purple-600"
                    >
                      <i className="fa-solid fa-redo mr-1"></i>
                      Record again
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onMouseLeave={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition transform hover:scale-105 ${
                        isRecording 
                          ? 'bg-red-500 text-white animate-pulse' 
                          : 'bg-purple-500 hover:bg-purple-600 text-white'
                      }`}
                    >
                      <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                    </button>
                    <p className="mt-3 text-sm text-zinc-500">
                      {isRecording ? `Recording... ${audioDuration}s` : 'Hold to record your message'}
                    </p>
                  </div>
                )}
              </div>

              {/* Text Message */}
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">
                  Add a text note (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="A little note to go with your vox..."
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-purple-500 dark:text-white resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Recipients */}
          {step === 'recipients' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Select who should receive this time capsule:
              </p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {contacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => toggleRecipient(contact.id)}
                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${
                      selectedRecipients.includes(contact.id)
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500'
                        : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-2 border-transparent'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-bold`}>
                      {contact.name.charAt(0)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium dark:text-white">{contact.name}</div>
                      <div className="text-xs text-zinc-500">{contact.role}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedRecipients.includes(contact.id)
                        ? 'bg-purple-500 border-purple-500 text-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}>
                      {selectedRecipients.includes(contact.id) && (
                        <i className="fa-solid fa-check text-xs"></i>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {selectedRecipients.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-sm text-purple-600 dark:text-purple-400">
                  <i className="fa-solid fa-users mr-2"></i>
                  {selectedRecipients.length} recipient{selectedRecipients.length > 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 'schedule' && (
            <div className="space-y-6">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate.toISOString().split('T')[0]}
                    onChange={(e) => setScheduledDate(new Date(e.target.value))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-3 block">
                  Repeat
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['once', 'daily', 'weekly', 'monthly', 'yearly'] as TimeCapsuleRecurrence[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setRecurrence(r)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition capitalize ${
                        recurrence === r
                          ? 'bg-purple-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notify Before */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm dark:text-white">Notify me before sending</div>
                  <div className="text-xs text-zinc-500">Get a reminder 30 minutes before</div>
                </div>
                <button
                  onClick={() => setNotifyBefore(!notifyBefore)}
                  className={`w-12 h-6 rounded-full transition ${notifyBefore ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${notifyBefore ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Summary */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <h4 className="font-semibold dark:text-white mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <i className="fa-solid fa-calendar w-5"></i>
                    <span>
                      {scheduledDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: scheduledDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })} at {scheduledTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <i className="fa-solid fa-repeat w-5"></i>
                    <span className="capitalize">{recurrence}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <i className="fa-solid fa-users w-5"></i>
                    <span>{selectedRecipients.length} recipient{selectedRecipients.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          {step !== 'record' && (
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-semibold text-zinc-700 dark:text-zinc-300 transition"
            >
              Back
            </button>
          )}
          
          {step === 'schedule' ? (
            <button
              onClick={handleSchedule}
              disabled={!audioBlob || selectedRecipients.length === 0}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-clock-rotate-left mr-2"></i>
              Schedule Capsule
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={step === 'record' ? !audioBlob : selectedRecipients.length === 0}
              className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SCHEDULED CAPSULE CARD
// ============================================

export const ScheduledCapsuleCard: React.FC<ScheduledCapsuleCardProps> = ({
  capsule,
  recipientNames,
  onCancel,
  onEdit,
}) => {
  const preset = OCCASION_PRESETS.find(p => p.id === capsule.occasion) || OCCASION_PRESETS[6];
  const isExpired = new Date(capsule.scheduledFor) < new Date();
  
  const getTimeRemaining = () => {
    const now = new Date();
    const scheduled = new Date(capsule.scheduledFor);
    const diff = scheduled.getTime() - now.getTime();
    
    if (diff <= 0) return 'Sending...';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={`p-4 rounded-2xl border ${capsule.status === 'sent' ? 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl ${preset.color} flex items-center justify-center text-2xl`}>
          {preset.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold dark:text-white truncate">
              {capsule.title || preset.label}
            </h4>
            <span className={`text-xs px-2 py-1 rounded-full ${
              capsule.status === 'sent' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
              capsule.status === 'cancelled' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' :
              'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            }`}>
              {capsule.status}
            </span>
          </div>
          
          <p className="text-xs text-zinc-500 mt-1">
            To: {recipientNames.join(', ')}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
            <span>
              <i className="fa-solid fa-calendar mr-1"></i>
              {new Date(capsule.scheduledFor).toLocaleDateString()}
            </span>
            <span>
              <i className="fa-solid fa-clock mr-1"></i>
              {new Date(capsule.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {capsule.recurrence !== 'once' && (
              <span>
                <i className="fa-solid fa-repeat mr-1"></i>
                {capsule.recurrence}
              </span>
            )}
          </div>

          {capsule.status === 'scheduled' && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
                <i className="fa-solid fa-hourglass-half mr-1 animate-pulse"></i>
                {getTimeRemaining()}
              </div>
              <button
                onClick={() => onEdit(capsule)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 transition"
              >
                <i className="fa-solid fa-pen text-xs"></i>
              </button>
              <button
                onClick={() => onCancel(capsule.id)}
                className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-red-500 transition"
              >
                <i className="fa-solid fa-times text-xs"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeCapsuleVox;
