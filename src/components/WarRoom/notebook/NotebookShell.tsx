/**
 * NotebookShell — War Room "Notebook" redesign (Path A · Sources · Chat · Studio)
 *
 * Flag-gated alternative to StudioLayout, selected in LiveDashboard via
 * `useFeature('warRoomNotebook', userId)`. This is a UI/IA re-skin of the
 * existing War Room engine — RAG, voice, and the 4 generators are consumed
 * as-is (see docs/WAR_ROOM_IMPLEMENTATION_HANDOFF_2026-06-01.md).
 *
 * ── Phase 0 (current) ──────────────────────────────────────────────────────
 * Thin pass-through: renders the legacy `StudioLayout` with the exact same
 * props/children it is handed, so flag-ON behavior is byte-identical to
 * flag-OFF. Subsequent phases grow the real 3-pane (SourcesPane / ChatPane /
 * StudioPane) inside this shell and stop delegating.
 */

import React from 'react';
import { StudioLayout, StudioLayoutProps } from '../StudioLayout';

export type NotebookShellProps = StudioLayoutProps;

export const NotebookShell: React.FC<NotebookShellProps> = (props) => {
  // Phase 0: delegate wholesale to the legacy layout. The flag-ON path renders
  // the same content; later phases replace this body with the Notebook 3-pane.
  return <StudioLayout {...props} />;
};

export default NotebookShell;
