/**
 * EventCommentThread.tsx
 * Notion-style threaded comment panel for calendar events.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CornerDownRight, Edit3, MoreHorizontal, RefreshCw, Send, Trash2 } from 'lucide-react';
import {
  CommentThread,
  EventComment,
  addComment,
  editComment,
  deleteComment,
  getComments,
  subscribeToComments,
} from '../../services/eventCommentsService';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderBody(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2])      parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4]) parts.push(<code key={m.index} className="text-[12px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded font-mono">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const CAvatar: React.FC<{ author?: EventComment['author']; small?: boolean }> = ({ author, small }) => {
  const dim = small ? 'w-5 h-5 text-[8px]' : 'w-7 h-7 text-xs';
  if (author?.avatar_url) return <img src={author.avatar_url} alt={author.name} className={`${dim} rounded-full object-cover flex-shrink-0`} />;
  const name = author?.name ?? 'U';
  const hue = name.charCodeAt(0) % 360;
  return (
    <div className={`${dim} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`} style={{ background: author?.avatar_color ?? `hsl(${hue},60%,50%)` }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
};

interface CNodeProps {
  comment: CommentThread | EventComment;
  replies?: EventComment[];
  currentUserId: string;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  depth?: number;
}

const CNode: React.FC<CNodeProps> = ({ comment, replies = [], currentUserId, onReply, onEdit, onDelete, depth = 0 }) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [editMode, setEditMode]   = useState(false);
  const [editBody, setEditBody]   = useState(comment.body);
  const [menuOpen, setMenuOpen]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    if (menuOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const isDeleted = !!comment.deleted_at;
  const isOwn = comment.user_id === currentUserId;

  return (
    <div className={`flex gap-2 ${depth > 0 ? 'mt-2' : 'mt-3'}`}>
      <div className="flex flex-col items-center">
        <CAvatar author={comment.author} small={depth > 0} />
        {replies.length > 0 && <div className="w-px flex-1 mt-1 bg-zinc-200 dark:bg-zinc-700 min-h-[16px]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{comment.author?.name ?? 'Unknown'}</span>
          <span className="text-[10px] text-zinc-400">{timeAgo(comment.created_at)}</span>
          {comment.edited_at && !isDeleted && <span className="text-[10px] italic text-zinc-400">edited</span>}
          {isOwn && !isDeleted && (
            <div className="relative ml-auto" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen(o => !o)} className="text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 rounded transition">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-5 z-30 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[100px]">
                  <button type="button" onClick={() => { setEditMode(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button type="button" onClick={() => { void onDelete(comment.id); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {isDeleted ? (
          <p className="text-xs text-zinc-400 italic">[Comment deleted]</p>
        ) : editMode ? (
          <div className="space-y-1.5">
            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={2} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm dark:text-zinc-200 outline-none focus:border-rose-400 resize-none transition" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditMode(false)} className="text-xs text-zinc-400 hover:text-zinc-600 transition">Cancel</button>
              <button type="button" onClick={() => { void onEdit(comment.id, editBody.trim()); setEditMode(false); }} className="text-xs text-rose-500 font-medium hover:text-rose-400 transition">Save</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{renderBody(comment.body)}</p>
        )}
        {!isDeleted && depth === 0 && (
          <button type="button" onClick={() => setReplyOpen(o => !o)} className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400 hover:text-rose-500 transition font-medium">
            <CornerDownRight className="w-3 h-3" /> Reply
          </button>
        )}
        {replyOpen && (
          <div className="mt-2 flex gap-2">
            <textarea rows={2} placeholder="Write a reply..." value={replyBody} onChange={e => setReplyBody(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { void onReply(comment.id, replyBody.trim()); setReplyBody(''); setReplyOpen(false); } }}
              className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm dark:text-zinc-200 outline-none focus:border-rose-400 resize-none transition" autoFocus />
            <button type="button" onClick={() => { void onReply(comment.id, replyBody.trim()); setReplyBody(''); setReplyOpen(false); }}
              disabled={!replyBody.trim()} className="self-end p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-40 transition">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {replies.length > 0 && (
          <div className="pl-1">
            {replies.map(r => (
              <CNode key={r.id} comment={r} replies={[]} currentUserId={currentUserId} onReply={onReply} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface EventCommentThreadProps {
  eventId: string;
  currentUserId: string;
}

export const EventCommentThread: React.FC<EventCommentThreadProps> = ({ eventId, currentUserId }) => {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setThreads(await getComments(eventId)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => {
    void load();
    const unsub = subscribeToComments(eventId, setThreads);
    return unsub;
  }, [eventId, load]);

  async function submit() {
    if (!newBody.trim()) return;
    setSending(true);
    try { await addComment(eventId, currentUserId, newBody.trim()); setNewBody(''); }
    catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8 text-zinc-400">
      <RefreshCw className="w-4 h-4 animate-spin mr-2" /><span className="text-sm">Loading comments...</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {error && <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{error}</div>}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
        {threads.length === 0
          ? <div className="text-center py-8"><p className="text-sm text-zinc-400">No comments yet - be the first!</p></div>
          : threads.map(t => (
            <CNode key={t.id} comment={t} replies={t.replies} currentUserId={currentUserId}
              onReply={async (pId, body) => { await addComment(eventId, currentUserId, body, pId); }}
              onEdit={async (id, body) => { await editComment(id, currentUserId, body); }}
              onDelete={async (id) => { await deleteComment(id, currentUserId); }}
            />
          ))
        }
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex gap-2 items-end">
          <textarea rows={2} placeholder="Write a comment... (Cmd+Enter to send)" value={newBody} onChange={e => setNewBody(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { void submit(); } }}
            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm dark:text-zinc-200 outline-none focus:border-rose-400 resize-none transition" />
          <button type="button" onClick={() => { void submit(); }} disabled={sending || !newBody.trim()} className="p-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition disabled:opacity-40 shadow-sm">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 mt-1">Supports **bold**, *italic*, `code`</p>
      </div>
    </div>
  );
};

export default EventCommentThread;
