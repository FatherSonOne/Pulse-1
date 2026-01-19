import { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Link, List, ListOrdered } from 'lucide-react';
import './RichTextEditor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      // Only update if different to avoid cursor jumping
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      editorRef.current.innerHTML = value || '';
      // Restore cursor position if possible
      if (range && editorRef.current.contains(range.commonAncestorContainer)) {
        try {
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (e) {
          // Ignore selection errors
        }
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      executeCommand('createLink', url);
    }
  };

  return (
    <div className={`rich-text-editor ${className || ''} ${isFocused ? 'focused' : ''}`}>
      <div className="rich-text-toolbar">
        <button
          type="button"
          onClick={() => executeCommand('bold')}
          title="Bold"
          className="toolbar-btn"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('italic')}
          title="Italic"
          className="toolbar-btn"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('underline')}
          title="Underline"
          className="toolbar-btn"
        >
          <Underline size={14} />
        </button>
        <div className="toolbar-divider" />
        <button
          type="button"
          onClick={() => executeCommand('insertUnorderedList')}
          title="Bullet List"
          className="toolbar-btn"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('insertOrderedList')}
          title="Numbered List"
          className="toolbar-btn"
        >
          <ListOrdered size={14} />
        </button>
        <div className="toolbar-divider" />
        <button
          type="button"
          onClick={insertLink}
          title="Insert Link"
          className="toolbar-btn"
        >
          <Link size={14} />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="rich-text-content"
        data-placeholder={placeholder || 'Start typing...'}
      />
    </div>
  );
}