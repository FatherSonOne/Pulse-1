import React, { useRef, useEffect } from 'react';

interface OperatorReferencePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
}

const OPERATORS: { operator: string; example: string; description: string }[] = [
  { operator: 'from:',    example: 'from:alice',         description: 'Filter by sender' },
  { operator: 'to:',      example: 'to:bob@co.com',      description: 'Filter by recipient' },
  { operator: 'subject:', example: 'subject:invoice',    description: 'Email subject' },
  { operator: 'after:',   example: 'after:2024-01-01',   description: 'After date' },
  { operator: 'before:',  example: 'before:last week',   description: 'Before date' },
  { operator: 'is:',      example: 'is:unread',          description: 'Message status' },
  { operator: 'has:',     example: 'has:attachment',     description: 'Has attachment' },
  { operator: 'label:',   example: 'label:important',    description: 'Label/tag' },
  { operator: '-',        example: '-from:spam',         description: 'Exclude operator' },
];

const KEYBOARD_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Cmd+K · /', description: 'Focus search' },
  { keys: '↓ ↑',       description: 'Move between results' },
  { keys: '→',         description: 'Peek the focused result' },
  { keys: '← · Esc',   description: 'Collapse peek' },
  { keys: 'Enter',     description: 'Open full detail panel' },
  { keys: '1 — 5',     description: 'Resume from list' },
  { keys: 'Esc',       description: 'Clear search' },
  { keys: '?',         description: 'Toggle this reference' },
];

export const OperatorReferencePopover: React.FC<OperatorReferencePopoverProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Search operators and keyboard shortcuts"
      className="op-ref-popover"
    >
      <section className="op-ref-section">
        <h3 className="op-ref-section-label">Search Operators</h3>
        <table className="op-ref-table">
          <tbody>
            {OPERATORS.map(row => (
              <tr
                key={row.operator}
                onClick={() => { onInsert(row.example); onClose(); }}
                className="op-ref-row"
              >
                <td className="op-ref-cell-operator">
                  <code className="op-ref-code op-ref-code-primary">{row.operator}</code>
                </td>
                <td className="op-ref-cell-example">
                  <code className="op-ref-code">{row.example}</code>
                </td>
                <td className="op-ref-cell-desc">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="op-ref-section">
        <h3 className="op-ref-section-label">Keyboard</h3>
        <table className="op-ref-table">
          <tbody>
            {KEYBOARD_SHORTCUTS.map(row => (
              <tr key={row.keys} className="op-ref-row op-ref-row-static">
                <td className="op-ref-cell-keys">
                  <code className="op-ref-code op-ref-code-primary">{row.keys}</code>
                </td>
                <td className="op-ref-cell-desc">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="op-ref-footer">Click an operator to insert it · ? to toggle</p>
    </div>
  );
};

export default OperatorReferencePopover;
