/**
 * RetrospectivePane — focal pane for a due retrospective ("Pulse AI · Look
 * back"). Wraps the existing OutcomeRetrospective (rating + reflection) so a
 * due look-back resolves via recordOutcome exactly as the old banner did. Also
 * the Archive focal for decisions (Phase 9 reuses this).
 */
import { OutcomeRetrospective } from '../../context/OutcomeRetrospective';
import type { RetrospectivePrompt } from '../../../../services/decisionContextService';

export interface RetroActions {
  workspaceId: string;
  currentUserId: string;
  onResolved: () => void;
}

interface RetrospectivePaneProps extends RetroActions {
  prompt: RetrospectivePrompt;
  decisionTitle: string;
}

export function RetrospectivePane({ prompt, decisionTitle, workspaceId, currentUserId, onResolved }: RetrospectivePaneProps) {
  return (
    <div className="ck-focal-body">
      <div className="ck-focal-pad">
        <div className="ck-focal-strip">
          <span className="ck-ai-chip">Pulse AI</span>
          <span className="ck-focal-type">Look back</span>
        </div>
        <h2 className="ck-focal-h2">Look back: {decisionTitle}</h2>
        <p className="ck-focal-desc">
          This decision landed a while ago — how did it turn out? Your reflection sharpens future calls.
        </p>
        <OutcomeRetrospective
          decisionId={prompt.decisionId}
          decisionTitle={decisionTitle}
          workspaceId={workspaceId}
          userId={currentUserId}
          promptId={prompt.id}
          onResolved={onResolved}
          onDismiss={onResolved}
        />
      </div>
    </div>
  );
}
