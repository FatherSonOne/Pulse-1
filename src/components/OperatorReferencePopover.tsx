import React, { useRef, useEffect } from 'react';

interface OperatorReferencePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
}

const OPERATORS = [
  { operator: 'from:', example: 'from:alice',        description: 'Filter by sender' },
  { operator: 'to:',   example: 'to:bob@co.com',     description: 'Filter by recipient' },
  { operator: 'subject:', example: 'subject:invoice', description: 'Email subject' },
  { operator: 'after:', example: 'after:2024-01-01',  description: 'After date' },
  { operator: 'before:', example: 'before:last week', description: 'Before date' },
  { operator: 'is:',   example: 'is:unread',          description: 'Message status' },
  { operator: 'has:',  example: 'has:attachment',     description: 'Has attachment' },
  { operator: 'label:', example: 'label:important',   description: 'Label/tag' },
  { operator: '-',     example: '-from:spam',          description: 'Exclude operator' },
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
      aria-label="Search operators reference"
      className="operator-reference-popover absolute right-0 top-full mt-1 z-50 w-96 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">
        Search Operators
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 dark:text-gray-500">
            <th className="pb-1 px-1 font-medium">Operator</th>
            <th className="pb-1 px-1 font-medium">Example</th>
            <th className="pb-1 px-1 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {OPERATORS.map(row => (
            <tr
              key={row.operator}
              onClick={() => { onInsert(row.example); onClose(); }}
              className="cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <td className="py-1 px-1">
                <code className="text-xs font-mono text-purple-600 dark:text-purple-400">
                  {row.operator}
                </code>
              </td>
              <td className="py-1 px-1">
                <code className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {row.example}
                </code>
              </td>
              <td className="py-1 px-1 text-gray-500 dark:text-gray-400 text-xs">
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 px-1">
        Click any row to insert it into the search box.
      </p>
    </div>
  );
};

export default OperatorReferencePopover;
