// ComposeFab — floating bottom-right Compose button.
// Phase 7 wires onClick to the existing emailComposeStore.openCompose().
import React from 'react';
import { PenLine } from 'lucide-react';
import { Keycap } from '../primitives';

interface ComposeFabProps {
  onClick?: () => void;
}

export const ComposeFab: React.FC<ComposeFabProps> = ({ onClick }) => (
  <button
    type="button"
    className="fab-compose"
    title="Compose new email"
    aria-label="Compose new email"
    onClick={onClick}
  >
    <PenLine className="w-4 h-4" />
    <span>Compose</span>
    <Keycap>C</Keycap>
  </button>
);

export default ComposeFab;
