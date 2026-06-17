/**
 * wizardSubmit — turns a DecisionWizard WizardOutput into real rows. Ported
 * verbatim from DecisionTaskHub.handleWizardSubmit + extractDecisionContext so
 * the cockpit's New-decision path is byte-for-byte equivalent (decision +
 * activity log + structured context + tasks + venue + optional template).
 */
import { decisionService } from '../../../../services/decisionService';
import { taskService } from '../../../../services/taskService';
import { decisionActivityService } from '../../../../services/decisionActivityService';
import { decisionContextService, type Criterion, type DecisionOption } from '../../../../services/decisionContextService';
import { createPlace, attachPlaceToEntity } from '../../../../services/locationService';
import type { WizardOutput } from '../../wizard/types';

/** Extract structured-context fields from a wizard Step 2 payload (per frame). */
export function extractDecisionContext(
  frameId: string,
  step2: Record<string, unknown>
): { criteria: Criterion[]; options: DecisionOption[]; stakeholders: string[] } {
  const result = { criteria: [] as Criterion[], options: [] as DecisionOption[], stakeholders: [] as string[] };
  const s = step2;

  if (Array.isArray(s.stakeholders)) {
    result.stakeholders = s.stakeholders.filter((x): x is string => typeof x === 'string');
  }

  switch (frameId) {
    case 'pick_tool': {
      const candidates = (s.candidates as string[] | undefined) ?? [];
      const criteria = (s.criteria as string[] | undefined) ?? [];
      result.options = candidates.map((label, i) => ({ id: `opt-${i}`, label }));
      result.criteria = criteria.map((label, i) => ({ id: `crit-${i}`, label, weight: 3 }));
      break;
    }
    case 'allocate': {
      const recipients = (s.recipients as string[] | undefined) ?? [];
      const criteria = (s.criteria as string[] | undefined) ?? [];
      result.options = recipients.map((label, i) => ({ id: `rec-${i}`, label }));
      result.criteria = (criteria.length > 0 ? criteria : ['impact', 'fit']).map((label, i) => ({ id: `crit-${i}`, label, weight: 3 }));
      break;
    }
    case 'conflict': {
      const positions = (s.partyPositions as Array<{ partyId: string; position: string }> | undefined) ?? [];
      result.options = positions.map((p, i) => ({ id: p.partyId || `pos-${i}`, label: `Position ${i + 1}`, description: p.position }));
      const parties = (s.parties as string[] | undefined) ?? [];
      result.stakeholders = Array.from(new Set([...result.stakeholders, ...parties.filter((x) => typeof x === 'string')]));
      break;
    }
    default:
      break;
  }
  return result;
}

export async function submitWizardOutput(
  output: WizardOutput,
  ctx: { workspaceId: string; userId: string }
): Promise<void> {
  const newDecision = await decisionService.createDecision({
    workspace_id: output.decision.workspace_id,
    title: output.decision.title,
    description: output.decision.description,
    decision_type: output.decision.decision_type as any,
    proposed_by: output.decision.proposed_by,
  });

  if (newDecision) {
    const meta = output.decision.metadata as
      | { frame_id?: string; step2?: Record<string, unknown>; step4?: { decideByDate?: string | null; retrospectiveDays?: number } }
      | undefined;
    const frameId = meta?.frame_id;
    await decisionActivityService.logDecisionEvent({
      decisionId: newDecision.id,
      workspaceId: output.decision.workspace_id,
      userId: output.decision.proposed_by || null,
      action: 'created',
      newValue: output.decision.title,
      metadata: { frame_id: frameId },
    });

    if (frameId && meta?.step2) {
      const c = extractDecisionContext(frameId, meta.step2);
      await decisionContextService.updateContext(newDecision.id, {
        criteria: c.criteria,
        options: c.options,
        stakeholders: c.stakeholders,
        decideByDate: meta.step4?.decideByDate ?? null,
        frameId,
      });
    }
  }

  if (output.tasks.length > 0 && newDecision) {
    for (const task of output.tasks) {
      await taskService.createTask({
        workspace_id: task.workspace_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        deadline: task.deadline,
        status: task.status,
        assignee_id: task.assignee_id,
        // Canonical decision↔task link key is `generated_from_decision` (read by
        // CockpitHub.linkedTaskCounts + queueModel). The wizard previously wrote a
        // divergent `linked_decision` key that nothing read, so wizard-origin tasks
        // went uncounted (launch-readiness 1.5). Existing rows backfilled in
        // migration 20260616000005.
        metadata: { ...(task.metadata ?? {}), generated_from_decision: newDecision.id },
      });
    }
  }

  if (output.venue && newDecision) {
    try {
      const place = await createPlace({
        lat: output.venue.lat,
        lng: output.venue.lng,
        address: output.venue.address,
        name: output.venue.name,
        type: 'venue',
      });
      await attachPlaceToEntity('decision', newDecision.id, place.id, 'venue');
    } catch (placeErr) {
      console.error('Wizard venue attach failed:', placeErr);
    }
  }

  if (output.saveAsTemplate && newDecision) {
    const { decisionTemplateService } = await import('../../../../services/decisionTemplateService');
    await decisionTemplateService.saveWizardAsTemplate({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      templateName: output.saveAsTemplate.name,
      description: output.saveAsTemplate.description,
      config: output.saveAsTemplate.config,
      sharedWithWorkspace: output.saveAsTemplate.sharedWithWorkspace,
      titleTemplate: output.decision.title,
      descriptionTemplate: output.decision.description,
      suggestedTasks: output.tasks.map((t) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        deadline_offset_days: t.deadline
          ? Math.round((new Date(t.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : undefined,
      })),
      defaultDecisionType: output.decision.decision_type,
      category: output.saveAsTemplate.config.frameId,
    });
  }
}
