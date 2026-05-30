/**
 * FocalScaffold + ActBtn — the scrollable focal body with a sticky footer of
 * actions (handoff §5.1). Mirrors the playground's DetailScaffold.
 */
import { type LucideIcon } from 'lucide-react';

export function FocalScaffold({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <>
      <div className="ck-focal-body">{children}</div>
      <div className="ck-focal-foot">{footer}</div>
    </>
  );
}

interface ActBtnProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}

export function ActBtn({ icon: Icon, label, onClick, primary, danger, disabled, title }: ActBtnProps) {
  return (
    <button
      type="button"
      className="ck-act-btn"
      data-primary={primary || undefined}
      data-danger={danger || undefined}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}
