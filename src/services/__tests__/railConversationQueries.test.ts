// Unit tests for the Messages relationship-rail per-conversation queries
// (Path D step 5 read-path): taskService.getOpenTasksByMessageIds +
// decisionService.getDecisionsByMessageIds. Mocks supabaseClient — no network.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '../supabaseClient';
import { createMockQueryBuilder } from './helpers/supabaseMock';
import { taskService } from '../taskService';
import { decisionService } from '../decisionService';

vi.mock('../supabaseClient', () => ({ supabase: { from: vi.fn() } }));
// These modules are imported at the top of the services but unused by the
// methods under test — stub them so importing the services doesn't cascade.
vi.mock('../ecosystemNotifyService', () => ({
  ecosystemNotifyService: { notifyTaskCreated: vi.fn(), notifyDecisionCreated: vi.fn() },
}));
vi.mock('../ai/aiService', () => ({ invokeAIJson: vi.fn() }));

const fromMock = vi.mocked(supabase.from);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('taskService.getOpenTasksByMessageIds', () => {
  it('returns [] without querying when given no message ids', async () => {
    const result = await taskService.getOpenTasksByMessageIds('ws-1', []);
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('queries extracted_tasks scoped by workspace, message ids, active statuses, unarchived', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 't1', title: 'Do the thing' }], error: null });
    fromMock.mockReturnValue(builder as any);

    const result = await taskService.getOpenTasksByMessageIds('ws-1', ['m1', 'm2']);

    expect(fromMock).toHaveBeenCalledWith('extracted_tasks');
    expect(builder.eq).toHaveBeenCalledWith('workspace_id', 'ws-1');
    expect(builder.in).toHaveBeenCalledWith('origin_message_id', ['m1', 'm2']);
    expect(builder.in).toHaveBeenCalledWith('status', [
      'pending',
      'todo',
      'in_progress',
      'in_review',
      'blocked',
    ]);
    expect(builder.is).toHaveBeenCalledWith('archived_at', null);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('returns [] on a query error', async () => {
    fromMock.mockReturnValue(createMockQueryBuilder({ data: null, error: { message: 'boom' } }) as any);
    const result = await taskService.getOpenTasksByMessageIds('ws-1', ['m1']);
    expect(result).toEqual([]);
  });
});

describe('decisionService.getDecisionsByMessageIds', () => {
  it('returns [] without querying when given no message ids', async () => {
    const result = await decisionService.getDecisionsByMessageIds('ws-1', []);
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('queries decisions by workspace + message ids and aliases proposal_text/created_by', async () => {
    const builder = createMockQueryBuilder({
      data: [
        { id: 'd1', proposal_text: 'Ship Friday', created_by: 'u1', status: 'decided', message_id: 'm1' },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder as any);

    const result = await decisionService.getDecisionsByMessageIds('ws-1', ['m1']);

    expect(fromMock).toHaveBeenCalledWith('decisions');
    expect(builder.eq).toHaveBeenCalledWith('workspace_id', 'ws-1');
    expect(builder.in).toHaveBeenCalledWith('message_id', ['m1']);
    expect(result[0].title).toBe('Ship Friday');
    expect(result[0].proposed_by).toBe('u1');
    expect(result[0].status).toBe('decided');
  });

  it('returns [] on a query error', async () => {
    fromMock.mockReturnValue(createMockQueryBuilder({ data: null, error: { message: 'boom' } }) as any);
    const result = await decisionService.getDecisionsByMessageIds('ws-1', ['m1']);
    expect(result).toEqual([]);
  });
});
