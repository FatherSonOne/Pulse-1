import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Archive, Download, Trash2 } from 'lucide-react';

interface VoxMessageMenuProps {
  isDarkMode: boolean;
  accentColor: string;
  onArchive: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  onClose: () => void;
  /** Bounding rect of the "..." trigger button — used for portal positioning */
  anchorRect: DOMRect;
}

const VoxMessageMenu: React.FC<VoxMessageMenuProps> = ({
  isDarkMode,
  accentColor,
  onArchive,
  onDownload,
  onDelete,
  onClose,
  anchorRect,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine whether to open upward (insufficient space below)
  const APPROX_HEIGHT = 135;
  const spaceBelow = window.innerHeight - anchorRect.bottom - 80;
  const openUpward = spaceBelow < APPROX_HEIGHT;

  // Fixed position relative to viewport — escapes overflow:hidden on parent cards
  const style: React.CSSProperties = openUpward
    ? {
        position: 'fixed',
        bottom: window.innerHeight - anchorRect.top + 4,
        right: window.innerWidth - anchorRect.right,
        zIndex: 9999,
      }
    : {
        position: 'fixed',
        top: anchorRect.bottom + 4,
        right: window.innerWidth - anchorRect.right,
        zIndex: 9999,
      };

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const bg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-800';
  const hoverBg = isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';

  const handleArchive = () => { onArchive(); onClose(); };
  const handleDownload = () => { onDownload(); onClose(); };
  const handleDelete = () => { onDelete?.(); onClose(); };

  // Portal into the React root so React 18's event delegation (attached to #root,
  // a child of body) can capture clicks. Using document.body as the portal target
  // places the menu ABOVE #root in the DOM, so click events bubble past #root
  // without React seeing them — buttons become non-interactive.
  const portalTarget =
    document.getElementById('root') ??
    document.getElementById('app') ??
    document.body;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      // eslint-disable-next-line react/forbid-component-props
      style={style}
      className={`rounded-lg border shadow-xl py-1 min-w-[150px] ${bg}`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleArchive(); }}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${textPrimary} ${hoverBg} transition-colors`}
      >
        <Archive className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
        <span>Archive</span>
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleDownload(); }}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${textPrimary} ${hoverBg} transition-colors`}
      >
        <Download className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
        <span>Download</span>
      </button>

      {onDelete && (
        <>
          <div className={`my-1 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 ${hoverBg} transition-colors`}
          >
            <Trash2 className="w-4 h-4 flex-shrink-0" />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>,
    portalTarget
  );
};

export default VoxMessageMenu;
