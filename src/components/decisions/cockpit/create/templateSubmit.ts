/**
 * templateSubmit — turns a chosen DecisionTemplate (+ filled variables) into real
 * rows. Mirrors wizardSubmit's decision-creation path so a template-started decision
 * is consistent with a wizard-started one: decision (status 'proposed', set by
 * decisionService.createDecision) + activity log + suggested tasks linked via the
 * canonical `generated_from_decision` key. Also stamps `generated_from_template` so
 * the queue's AI-provenance chip (queueModel.isAIExtracted) reflects the origin, and
 * increments the template's usage_count.
 */
import { decisionService } from '../../../../services/decisionService';
import { taskService } from '../../../../services/taskService';
import { decisionActivityService } from '../../../../services/decisionActivityService';
import {
  decisionTemplateService,
  type DecisionTemplate,
  type TemplateVariables,
} from '../../../../services/decisionTemplateService';

/** ms in a day, for deadline_offset_days → absolute deadline. */
const DAY_MS = 24 * 60 * 60 * 1000;

export async function submitTemplateSelection(
  template: DecisionTemplate,
  variables: TemplateVariables,
  ctx: { workspaceId: string; userId: string }
): Promise<void> {
  const applied = decisionTemplateService.applyTemplate(template, variables);

  // NOTE: we intentionally do NOT pass applied.decision_type. A template's
  // default_decision_type is a *voting method* (consensus / majority_vote), whereas
  // decisions.decision_type is a *category* (general / technical / product / process /
  // authority). The two vocabularies are orthogonal, the column has no CHECK constraint,
  // and writing a voting-method into the category column would silently pollute it.
  // Omitting lets createDecision default to 'general' — honest and non-polluting.
  const newDecision = await decisionService.createDecision({
    workspace_id: ctx.workspaceId,
    title: applied.title,
    description: applied.description,
    proposed_by: ctx.userId,
  });
  if (!newDecision) throw new Error('Decision create returned null');

  await decisionActivityService.logDecisionEvent({
    decisionId: newDecision.id,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId || null,
    action: 'created',
    newValue: applied.title,
    metadata: { from_template: template.id },
  });

  for (const task of applied.suggested_tasks) {
    await taskService.createTask({
      workspace_id: ctx.workspaceId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: 'todo',
      deadline:
        task.deadline_offset_days != null
          ? new Date(Date.now() + task.deadline_offset_days * DAY_MS).toISOString()
          : undefined,
      // Canonical decision↔task link key (read by CockpitHub.linkedTaskCounts +
      // queueModel). `generated_from_template` drives the AI-provenance chip.
      metadata: { generated_from_decision: newDecision.id, generated_from_template: template.id },
    });
  }

  // Best-effort usage bump; never block the create on it.
  await decisionTemplateService.trackUsage(template.id).catch(() => {});
}
