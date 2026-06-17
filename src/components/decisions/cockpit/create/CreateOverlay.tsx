/**
 * CreateOverlay — routes the chosen New mode to its existing flow:
 *   decision → DecisionWizard (self-portals; submit writes via wizardSubmit)
 *   task     → CreateTaskModal (real row via taskService.createTask)
 *   ai       → DecisionMission chat (ragService), in a cockpit modal shell
 * All paths refresh the cockpit via onCreated; wizard/task also close on save.
 */
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { DecisionWizard } from '../../wizard/DecisionWizard';
import type { FrameId } from '../../wizard/types';
import { CreateTaskModal } from '../../../tasks/CreateTaskModal';
import { DecisionMission } from '../../../WarRoom/missions/DecisionMission';
import { DecisionTemplates } from '../../DecisionTemplates';
import { taskService, type Task } from '../../../../services/taskService';
import { ragService, type AIMessage, type ThinkingStep } from '../../../../services/ragService';
import { useAIErrorHandler } from '../../../../hooks/useAIErrorHandler';
import type { User } from '../../../../types';
import { submitWizardOutput } from './wizardSubmit';
import { submitTemplateSelection } from './templateSubmit';

export type CreateMode = 'decision' | 'task' | 'template' | 'ai';

interface CreateOverlayProps {
  mode: CreateMode;
  workspaceId: string;
  currentUserId: string;
  workspaceMembers: User[];
  initialFrameId?: FrameId;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateOverlay({
  mode, workspaceId, currentUserId, workspaceMembers, initialFrameId, onClose, onCreated,
}: CreateOverlayProps) {
  const handleAIError = useAIErrorHandler();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinkingLogs, setThinkingLogs] = useState<Map<string, ThinkingStep[]>>(new Map());

  const handleSend = useCallback(async (message: string) => {
    const userMessage: AIMessage = { id: `msg-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    try {
      const response = await ragService.chat(message, [], '', (logs) => {
        setThinkingLogs(new Map([[userMessage.id, logs]]));
      });
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}-ai`, role: 'assistant', content: response, created_at: new Date().toISOString() }]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      if (!handleAIError(error)) {
        setMessages((prev) => [...prev, { id: `msg-${Date.now()}-error`, role: 'assistant', content: 'Sorry, I encountered an error processing your request. Please try again.', created_at: new Date().toISOString() }]);
      }
    } finally {
      setLoading(false);
    }
  }, [handleAIError]);

  if (mode === 'decision') {
    return (
      <DecisionWizard
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        workspaceMembers={workspaceMembers}
        initialFrameId={initialFrameId}
        onClose={onClose}
        onSubmit={async (output) => {
          await submitWizardOutput(output, { workspaceId, userId: currentUserId });
          onCreated();
        }}
      />
    );
  }

  if (mode === 'task') {
    return createPortal(
      <CreateTaskModal
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        workspaceMembers={workspaceMembers}
        onClose={onClose}
        onCreate={async (newTask: Partial<Task>) => {
          try {
            await taskService.createTask({
              workspace_id: newTask.workspace_id!,
              title: newTask.title!,
              description: newTask.description,
              priority: newTask.priority,
              assignee_id: newTask.assignee_id,
              deadline: newTask.deadline,
              status: newTask.status,
              metadata: newTask.metadata,
            });
            onCreated();
            onClose();
          } catch (error) {
            console.error('Failed to create task:', error);
            toast.error('Could not create task');
          }
        }}
      />,
      document.body
    );
  }

  if (mode === 'template') {
    // DecisionTemplates self-portals and calls onClose() right after onSelectTemplate.
    // The async create runs to completion in this closure (services + onCreated outlive
    // the unmount), then refreshes the cockpit.
    return (
      <DecisionTemplates
        workspaceId={workspaceId}
        onClose={onClose}
        onSelectTemplate={(template, variables) => {
          const t = toast.loading('Creating from template…');
          submitTemplateSelection(template, variables, { workspaceId, userId: currentUserId })
            .then(() => {
              toast.success('Decision created from template', { id: t });
              onCreated();
            })
            .catch((error) => {
              console.error('Failed to create from template:', error);
              toast.error('Could not create from template', { id: t });
            });
        }}
      />
    );
  }

  // Ask Pulse AI — advisory mission chat.
  return createPortal(
    <div className="ck-modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ck-modal" role="dialog" aria-modal="true" aria-label="Ask Pulse AI">
        <div className="ck-modal-head">
          <h2 className="ck-modal-title">Ask Pulse AI</h2>
          <button className="ck-hbtn" style={{ width: 28, height: 28 }} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="ck-modal-body">
          <DecisionMission
            key="cockpit-decision-mission"
            messages={messages}
            isLoading={loading}
            thinkingLogs={thinkingLogs}
            onSendMessage={handleSend}
            sessionTitle="Decision Mission"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
