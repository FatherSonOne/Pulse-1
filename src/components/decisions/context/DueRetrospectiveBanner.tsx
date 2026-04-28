// DueRetrospectiveBanner: polls for due retrospective prompts and surfaces
// the OutcomeRetrospective for the FIRST due prompt at the top of the
// Active view. Skipping or recording an outcome dismisses the banner; on
// next reload the next due prompt surfaces.
//
// Phase 4 of the Decisions and Tasks overhaul.

import React, { useEffect, useState } from 'react';
import { decisionContextService, type RetrospectivePrompt } from '../../../services/decisionContextService';
import { decisionService } from '../../../services/decisionService';
import { OutcomeRetrospective } from './OutcomeRetrospective';

interface DueRetrospectiveBannerProps {
  workspaceId: string;
  userId: string;
}

interface PromptWithDecision extends RetrospectivePrompt {
  decisionTitle: string;
}

export const DueRetrospectiveBanner: React.FC<DueRetrospectiveBannerProps> = ({
  workspaceId,
  userId,
}) => {
  const [prompt, setPrompt] = useState<PromptWithDecision | null>(null);

  useEffect(() => {
    let cancelled = false;
    let mounted = true;

    const loadNext = async () => {
      const due = await decisionContextService.getDuePrompts(workspaceId, userId);
      if (cancelled || !mounted) return;
      if (due.length === 0) {
        setPrompt(null);
        return;
      }
      const next = due[0];
      // Look up the decision title for the prompt's decisionId.
      const { decisions } = await decisionService.getWorkspaceDecisions(workspaceId);
      if (cancelled || !mounted) return;
      const match = decisions.find((d) => d.id === next.decisionId);
      setPrompt({
        ...next,
        decisionTitle: match?.title || 'a past decision',
      });
    };

    loadNext();
    return () => {
      cancelled = true;
      mounted = false;
    };
  }, [workspaceId, userId]);

  if (!prompt) return null;

  return (
    <OutcomeRetrospective
      decisionId={prompt.decisionId}
      decisionTitle={prompt.decisionTitle}
      workspaceId={workspaceId}
      userId={userId}
      promptId={prompt.id}
      onResolved={() => setPrompt(null)}
      onDismiss={() => setPrompt(null)}
    />
  );
};
