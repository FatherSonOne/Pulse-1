// src/components/Archives/ArchiveModals.tsx
// All archive modals rendered as a single fragment

import React from 'react';
import {
  Check,
  Copy,
  Download,
  Facebook,
  HardDrive,
  History,
  Linkedin,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  Twitter,
  X,
} from 'lucide-react';
import { useArchiveStore } from '../../store/archiveStore';
import type { SmartFolderRule } from '../../types';

export const ArchiveModals: React.FC = () => {
  const {
    selectedItem,
    modals,
    exportProgress,
    shareSuccess,
    isEditing,
    editTitle,
    editContent,
    newTag,
    collections,
    contacts,
    contactSearch,
    versionHistory,
    restoringVersion,
    newCollectionName,
    newCollectionColor,
    newCollectionIcon,
    newFolderName,
    newFolderRules,
    newFolderOperator,
    selectedItems,
    bulkTagValue,
    aiProcessing,
    closeModal,
    openModal,
    handleShareTo,
    handleSaveEdit,
    handleAddTag,
    handleRemoveTag,
    handleAddToCollectionTool,
    handleLinkToContact,
    handleTranslate,
    handleRestoreVersion,
    confirmDelete,
    handleCreateCollection,
    handleCreateSmartFolder,
    handleBulkTag,
    handleBulkAddToCollection,
    setEditTitle,
    setEditContent,
    setNewTag,
    setContactSearch,
    setNewCollectionName,
    setNewCollectionColor,
    setNewCollectionIcon,
    setNewFolderName,
    setNewFolderRules,
    setNewFolderOperator,
    setBulkTagValue,
  } = useArchiveStore();

  return (
    <>
      {/* Export Progress Modal */}
      {exportProgress && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-80">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <HardDrive className="text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-white">Exporting to Drive</h3>
                <p className="text-xs text-zinc-500">{exportProgress.current} of {exportProgress.total}</p>
              </div>
            </div>
            <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {modals.share && selectedItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('share')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Share</h3>
              <button
                onClick={() => closeModal('share')}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
              >
                <X />
              </button>
            </div>

            {/* Preview */}
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 mb-4">
              <p className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-1">{selectedItem.title}</p>
              <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{selectedItem.content.substring(0, 100)}...</p>
            </div>

            {/* Share targets — neutral chrome (no per-brand colors, no toy
                scale-on-hover) so the sheet reads as a tool, not a sticker
                sheet. After neutralization every tile is identical, so they
                render from one source of truth. */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {([
                { id: 'email', label: 'Email', Icon: Mail },
                { id: 'twitter', label: 'X', Icon: Twitter },
                { id: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
                { id: 'facebook', label: 'Facebook', Icon: Facebook },
                { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
                { id: 'telegram', label: 'Telegram', Icon: Send },
                { id: 'sms', label: 'SMS', Icon: MessageSquare },
                { id: 'copy', label: 'Copy', Icon: Copy },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => handleShareTo(id, selectedItem)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.10] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">{label}</span>
                </button>
              ))}
            </div>

            {/* Download Option */}
            <button
              onClick={() => handleShareTo('download', selectedItem)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Download />
              <span>Download as file</span>
            </button>
          </div>
        </div>
      )}

      {/* Share Success Toast */}
      {shareSuccess && (
        <div className="fixed bottom-[calc(1.5rem+var(--pulse-bottom-bar))] left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-fade-in z-50 flex items-center gap-2">
          <Check />
          {shareSuccess}
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && selectedItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => useArchiveStore.setState({ isEditing: false })}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Edit Document</h3>
              <button
                type="button"
                onClick={() => useArchiveStore.setState({ isEditing: false })}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <X />
              </button>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                  placeholder="Document title"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-zinc-500 mb-1">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-64 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white resize-none font-mono text-sm"
                  placeholder="Document content"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => useArchiveStore.setState({ isEditing: false })}
                className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Modal */}
      {modals.tags && selectedItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('tags')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Manage Tags</h3>
              <button
                type="button"
                onClick={() => closeModal('tags')}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <X />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-sm"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItem.tags?.map(tag => (
                <span key={tag} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-zinc-400 hover:text-rose-500 transition"
                    title="Remove tag"
                  >
                    <X className="text-xs" />
                  </button>
                </span>
              ))}
              {(!selectedItem.tags || selectedItem.tags.length === 0) && (
                <p className="text-sm text-zinc-500">No tags yet. Add some above.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collection Picker Modal */}
      {modals.collectionPicker && selectedItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('collectionPicker')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Add to Collection</h3>
              <button
                type="button"
                onClick={() => closeModal('collectionPicker')}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <X />
              </button>
            </div>
            <div className="space-y-2">
              {collections.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No collections yet. Create one from the sidebar.</p>
              ) : collections.map(col => (
                <button
                  type="button"
                  key={col.id}
                  onClick={() => handleAddToCollectionTool(col.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-left"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: col.color + '20' }}>
                    <i className={`fa-solid ${col.icon} text-sm`} style={{ color: col.color }}></i>
                  </div>
                  <span className="text-sm text-zinc-900 dark:text-white">{col.name}</span>
                  <span className="ml-auto text-xs text-zinc-400">{col.itemCount}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Picker Modal */}
      {modals.contactPicker && selectedItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('contactPicker')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Link to Contact</h3>
              <button
                type="button"
                onClick={() => closeModal('contactPicker')}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <X />
              </button>
            </div>
            <div className="mb-3">
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-sm"
                placeholder="Search contacts..."
              />
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {contacts.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">{contactSearch ? 'No contacts found' : 'Loading contacts...'}</p>
              ) : contacts.map((user: any) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => handleLinkToContact(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-left"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                      {(user.displayName || user.fullName || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-900 dark:text-white block truncate">{user.displayName || user.fullName}</span>
                    {user.handle && <span className="text-xs text-zinc-500">@{user.handle}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Translate Modal */}
      {modals.translate && selectedItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('translate')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Translate</h3>
              <button
                type="button"
                onClick={() => closeModal('translate')}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <X />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { code: 'es', name: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}' },
                { code: 'fr', name: 'French', flag: '\u{1F1EB}\u{1F1F7}' },
                { code: 'de', name: 'German', flag: '\u{1F1E9}\u{1F1EA}' },
                { code: 'it', name: 'Italian', flag: '\u{1F1EE}\u{1F1F9}' },
                { code: 'pt', name: 'Portuguese', flag: '\u{1F1F5}\u{1F1F9}' },
                { code: 'zh', name: 'Chinese', flag: '\u{1F1E8}\u{1F1F3}' },
                { code: 'ja', name: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}' },
                { code: 'ko', name: 'Korean', flag: '\u{1F1F0}\u{1F1F7}' },
              ].map(lang => (
                <button
                  type="button"
                  key={lang.code}
                  onClick={() => handleTranslate(lang.code)}
                  disabled={aiProcessing !== null}
                  className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-left disabled:opacity-50"
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className="text-sm text-zinc-900 dark:text-white">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {modals.history && selectedItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('history')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Version History</h3>
              <button
                type="button"
                onClick={() => closeModal('history')}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <X />
              </button>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {versionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="text-3xl text-zinc-400 mb-2" />
                  <p className="text-sm text-zinc-500">Loading version history...</p>
                </div>
              ) : (
                versionHistory.map((version, i) => (
                  <div key={version.id} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <div className={`w-2 h-2 rounded-full mt-2 ${i === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-900 dark:text-white">{version.action}</p>
                      <p className="text-xs text-zinc-500">
                        {version.date.toLocaleDateString()} at {version.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {version.user}
                      </p>
                      {version.title && version.title !== selectedItem?.title && (
                        <p className="text-xs text-zinc-400 mt-1">Title: &quot;{version.title}&quot;</p>
                      )}
                    </div>
                    {i > 0 && version.content && (
                      <button
                        type="button"
                        onClick={() => handleRestoreVersion(version)}
                        disabled={restoringVersion !== null}
                        className="text-xs text-rose-500 hover:text-rose-600 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {restoringVersion === version.id ? (
                          <>
                            <Loader2 className="animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          'Restore'
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modals.deleteConfirm && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('deleteConfirm')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-zinc-900 dark:text-white text-lg mb-2">Delete Archive Item</h3>
            <p className="text-sm text-zinc-500 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => closeModal('deleteConfirm')} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">Cancel</button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Action Items Result Modal */}
      {modals.actionItemsResult && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('actionItemsResult')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Extracted Action Items</h3>
              <button type="button" onClick={() => closeModal('actionItemsResult')} className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"><X /></button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {modals.actionItemsResult.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No action items found in this content.</p>
              ) : modals.actionItemsResult.map((action, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <p className="text-sm text-zinc-900 dark:text-white">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Collection Modal */}
      {modals.createCollection && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('createCollection')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">New Collection</h3>
              <button type="button" onClick={() => closeModal('createCollection')} className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"><X /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Name</label>
                <input type="text" value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white" placeholder="Collection name" />
              </div>
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'].map(color => (
                    <button type="button" key={color} onClick={() => setNewCollectionColor(color)} className={`w-8 h-8 rounded-full border-2 transition ${newCollectionColor === color ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {['fa-folder', 'fa-briefcase', 'fa-lightbulb', 'fa-book', 'fa-star', 'fa-heart', 'fa-bookmark', 'fa-tag'].map(icon => (
                    <button type="button" key={icon} onClick={() => setNewCollectionIcon(icon)} className={`w-10 h-10 rounded-lg flex items-center justify-center transition border ${newCollectionIcon === icon ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
                      <i className={`fa-solid ${icon}`}></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button type="button" onClick={() => closeModal('createCollection')} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">Cancel</button>
              <button type="button" onClick={handleCreateCollection} disabled={!newCollectionName.trim()} className="px-4 py-2 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Create Collection</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Smart Folder Modal */}
      {modals.createSmartFolder && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('createSmartFolder')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">New Smart Folder</h3>
              <button type="button" onClick={() => closeModal('createSmartFolder')} className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"><X /></button>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Name</label>
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white" placeholder="Smart folder name" />
              </div>
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Match</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewFolderOperator('and')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${newFolderOperator === 'and' ? 'bg-rose-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>ALL rules (AND)</button>
                  <button type="button" onClick={() => setNewFolderOperator('or')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${newFolderOperator === 'or' ? 'bg-rose-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>ANY rule (OR)</button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-500 mb-2">Rules</label>
                <div className="space-y-2">
                  {newFolderRules.map((rule, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={rule.field} onChange={(e) => { const updated = [...newFolderRules]; updated[i] = { ...rule, field: e.target.value as SmartFolderRule['field'] }; setNewFolderRules(updated); }} className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white">
                        <option value="type">Type</option>
                        <option value="tags">Tags</option>
                        <option value="content">Content</option>
                        <option value="sentiment">Sentiment</option>
                        <option value="date">Date</option>
                      </select>
                      <select value={rule.operator} onChange={(e) => { const updated = [...newFolderRules]; updated[i] = { ...rule, operator: e.target.value as SmartFolderRule['operator'] }; setNewFolderRules(updated); }} className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white">
                        <option value="equals">equals</option>
                        <option value="contains">contains</option>
                        <option value="startsWith">starts with</option>
                        {rule.field === 'date' && <option value="before">before</option>}
                        {rule.field === 'date' && <option value="after">after</option>}
                      </select>
                      {rule.field === 'type' ? (
                        <select value={rule.value as string} onChange={(e) => { const updated = [...newFolderRules]; updated[i] = { ...rule, value: e.target.value }; setNewFolderRules(updated); }} className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white">
                          <option value="">Select type...</option>
                          <option value="transcript">Transcript</option>
                          <option value="meeting_note">Meeting Note</option>
                          <option value="vox_transcript">Vox Transcript</option>
                          <option value="journal">Journal</option>
                          <option value="summary">Summary</option>
                          <option value="decision_log">Decision Log</option>
                          <option value="artifact">Artifact</option>
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                          <option value="document">Document</option>
                          <option value="war_room_session">War Room Session</option>
                        </select>
                      ) : rule.field === 'sentiment' ? (
                        <select value={rule.value as string} onChange={(e) => { const updated = [...newFolderRules]; updated[i] = { ...rule, value: e.target.value }; setNewFolderRules(updated); }} className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white">
                          <option value="">Select...</option>
                          <option value="positive">Positive</option>
                          <option value="neutral">Neutral</option>
                          <option value="negative">Negative</option>
                        </select>
                      ) : rule.field === 'date' ? (
                        <input type="date" value={rule.value as string} onChange={(e) => { const updated = [...newFolderRules]; updated[i] = { ...rule, value: e.target.value }; setNewFolderRules(updated); }} className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white" />
                      ) : (
                        <input type="text" value={rule.value as string} onChange={(e) => { const updated = [...newFolderRules]; updated[i] = { ...rule, value: e.target.value }; setNewFolderRules(updated); }} className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white" placeholder="Value..." />
                      )}
                      {newFolderRules.length > 1 && (
                        <button type="button" onClick={() => setNewFolderRules(newFolderRules.filter((_, idx) => idx !== i))} className="w-8 h-8 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition"><X /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setNewFolderRules([...newFolderRules, { field: 'type', operator: 'equals', value: '' }])} className="mt-2 text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition">
                  <Plus /> Add Rule
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button type="button" onClick={() => closeModal('createSmartFolder')} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">Cancel</button>
              <button type="button" onClick={handleCreateSmartFolder} disabled={!newFolderName.trim() || newFolderRules.every(r => r.value === '')} className="px-4 py-2 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Create Smart Folder</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {modals.bulkTag && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('bulkTag')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Tag {selectedItems.size} Items</h3>
              <button type="button" onClick={() => closeModal('bulkTag')} className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"><X /></button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={bulkTagValue} onChange={(e) => setBulkTagValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBulkTag()} className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-sm" placeholder="Enter tag..." />
              <button type="button" onClick={handleBulkTag} disabled={!bulkTagValue.trim()} className="px-4 py-2 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Collection Picker Modal */}
      {modals.bulkCollection && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-50" onClick={() => closeModal('bulkCollection')}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Add {selectedItems.size} Items to Collection</h3>
              <button type="button" onClick={() => closeModal('bulkCollection')} className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"><X /></button>
            </div>
            <div className="space-y-2">
              {collections.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No collections. Create one first.</p>
              ) : collections.map(col => (
                <button type="button" key={col.id} onClick={() => handleBulkAddToCollection(col.id)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-left">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: col.color + '20' }}>
                    <i className={`fa-solid ${col.icon} text-sm`} style={{ color: col.color }}></i>
                  </div>
                  <span className="text-sm text-zinc-900 dark:text-white">{col.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ArchiveModals;
