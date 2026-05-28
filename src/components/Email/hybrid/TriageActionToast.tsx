// TriageActionToast — floating "✓ Archive · Sender · UNDO" banner above the stage.
// Rendered inside TriageView; lifetime matches state.actedLast.
import React from 'react';
import { Check, Undo2 } from 'lucide-react';
import type { TriageActedLast } from '../../../store/emailUIStore';

interface TriageActionToastProps {
  acted: TriageActedLast;
  onUndo: () => void;
}

export const TriageActionToast: React.FC<TriageActionToastProps> = ({ acted, onUndo }) => (
  <div className="action-toast" key={acted.idx} role="status" aria-live="polite">
    <span className="check">
      <Check className="w-3 h-3" />
    </span>
    <span>
      <strong className="font-semibold">{acted.label}</strong>
      {acted.sender && <span className="pulse-ink-3-color"> · {acted.sender}</span>}
    </span>
    <button type="button" className="undo-btn" onClick={onUndo}>
      <Undo2 className="w-2.5 h-2.5" />
      <span>UNDO</span>
    </button>
  </div>
);

export default TriageActionToast;
