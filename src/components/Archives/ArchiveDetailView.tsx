// src/components/Archives/ArchiveDetailView.tsx
// Detail pane for a selected archive item — header, toolbar, content, footer

import React, { useRef } from 'react';
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  Copy,
  FolderPlus,
  Frown,
  HardDrive,
  History,
  Languages,
  Link,
  Link2,
  ListChecks,
  Loader2,
  Mail,
  Maximize,
  Meh,
  Minimize,
  Pin,
  Printer,
  Share2,
  Smile,
  Sparkles,
  Square,
  SquarePen,
  Star,
  Tags,
  Trash2,
  UserCog,
  Volume2,
  Wand2,
} from 'lucide-react';
import { useArchiveStore } from '../../store/archiveStore';
import { getTypeConfig, getTypeLabel } from './archiveHelpers';
import type { ArchiveType } from '../../types';

export const ArchiveDetailView: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    selectedItem,
    relatedItems,
    driveConnected,
    exporting,
    aiProcessing,
    isEditing,
    isSpeaking,
    isFullscreen,
    ttsLoading,
    shareSuccess,
    setSelectedItem,
    handleToggleStar,
    handleExportToDrive,
    handleShare,
    handleStartEdit,
    handleTogglePin,
    openModal,
    handleSummarize,
    handleExtractActions,
    handleFindRelated,
    handleSendToEmail,
    handleCreateTask,
    handleAddToCalendar,
    handlePrint,
    handleFullscreen,
    handleShowHistory,
    confirmDelete,
    setIsSpeaking,
    setTtsLoading,
  } = useArchiveStore();

  if (!selectedItem) return null;

  // Text-to-Speech — uses OpenAI TTS API with fallback to browser speech
  const handleTextToSpeech = async () => {
    if (!selectedItem) return;

    // If already speaking, stop
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setTtsLoading(false);
      return;
    }

    const openaiApiKey = localStorage.getItem('openai_api_key') || '';

    // If OpenAI API key is available, use OpenAI TTS
    if (openaiApiKey) {
      setTtsLoading(true);
      try {
        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: selectedItem.content.substring(0, 4096),
            voice: 'alloy',
            response_format: 'mp3',
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error(`TTS API error: ${ttsResponse.status}`);
        }

        const audioBlob = await ttsResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Clean up previous audio
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
        };

        setTtsLoading(false);
        setIsSpeaking(true);
        await audio.play();
        return;
      } catch (error) {
        console.error('[Archives] OpenAI TTS failed, falling back to browser:', error);
        setTtsLoading(false);
        // Fall through to browser speech synthesis
      }
    }

    // Fallback to browser speech synthesis
    const utterance = new SpeechSynthesisUtterance(selectedItem.content);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openModal('deleteConfirm', id);
  };

  const handleStarClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggleStar(id);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Detail Header */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <button
              onClick={() => setSelectedItem(null)}
              className="text-zinc-500 mb-4 flex items-center gap-2 text-xs hover:text-zinc-900 dark:hover:text-white transition"
              title="Back to Archives"
            >
              <ArrowLeft /> Back to Archives
            </button>

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {(() => {
                const config = getTypeConfig(selectedItem.type);
                return (
                  <div className={`px-2.5 py-1 rounded-lg ${config.bg} ${config.border} border flex items-center gap-1.5`}>
                    <config.Icon className={`${config.color} w-3 h-3`} />
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${config.color}`}>
                      {getTypeLabel(selectedItem.type)}
                    </span>
                  </div>
                );
              })()}
              {selectedItem.sentiment && (
                <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  selectedItem.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                  selectedItem.sentiment === 'negative' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                  'bg-zinc-500/10 border-zinc-500/20 text-zinc-500'
                }`}>
                  {selectedItem.sentiment === 'positive' ? <Smile className="w-3 h-3" /> : selectedItem.sentiment === 'negative' ? <Frown className="w-3 h-3" /> : <Meh className="w-3 h-3" />}
                  <span className="text-[10px] font-mono uppercase tracking-wider capitalize">{selectedItem.sentiment}</span>
                </div>
              )}
              {selectedItem.driveFileId && (
                <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-1.5">
                  <HardDrive className="text-blue-500 text-xs" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-blue-500">Synced</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-light text-zinc-900 dark:text-white tracking-tight">{selectedItem.title}</h1>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-zinc-500 text-xs font-mono">
              {selectedItem.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <button
              onClick={(e) => handleStarClick(selectedItem.id, e)}
              className={`p-2 rounded-lg transition ${selectedItem.starred ? 'text-amber-500' : 'text-zinc-400 hover:text-amber-500'}`}
              title={selectedItem.starred ? 'Unstar' : 'Star'}
            >
              <Star className={`w-4 h-4 ${selectedItem.starred ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tags */}
        {(selectedItem.tags?.length > 0 || selectedItem.aiTags?.length) && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {selectedItem.tags?.map(tag => (
              <span key={tag} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] text-zinc-500 font-mono">
                #{tag}
              </span>
            ))}
            {selectedItem.aiTags?.map(tag => (
              <span key={tag} className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-500 font-mono">
                <Wand2 className="mr-1" />{tag}
              </span>
            ))}
          </div>
        )}

        {/* Document Toolbar */}
        <div className="flex items-center gap-1 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex-wrap">
          {/* Edit & Organize */}
          <button
            onClick={handleStartEdit}
            className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-rose-500/10 text-rose-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            title="Edit"
          >
            <SquarePen className="text-sm" />
          </button>
          <button
            onClick={handleTogglePin}
            className={`p-2 rounded-lg transition-all ${selectedItem.pinned ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            title={selectedItem.pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className={`w-4 h-4 ${selectedItem.pinned ? '' : 'rotate-45'}`} />
          </button>
          <button
            onClick={() => openModal('collectionPicker')}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Add to Collection"
          >
            <FolderPlus className="text-sm" />
          </button>
          <button
            onClick={() => openModal('tags')}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Add Tags"
          >
            <Tags className="text-sm" />
          </button>

          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

          {/* AI Tools */}
          <button
            onClick={handleSummarize}
            disabled={aiProcessing !== null}
            className={`p-2 rounded-lg transition-all ${aiProcessing === 'summarize' ? 'bg-rose-500/10 text-rose-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
            title="AI Summarize"
          >
            <Sparkles className={`w-4 h-4 ${aiProcessing === 'summarize' ? 'animate-pulse' : ''}`} />
          </button>
          <button
            onClick={handleExtractActions}
            disabled={aiProcessing !== null}
            className={`p-2 rounded-lg transition-all ${aiProcessing === 'extract' ? 'bg-rose-500/10 text-rose-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
            title="Extract Action Items"
          >
            <ListChecks className={`w-4 h-4 ${aiProcessing === 'extract' ? 'animate-pulse' : ''}`} />
          </button>
          <button
            onClick={handleFindRelated}
            disabled={aiProcessing !== null}
            className={`p-2 rounded-lg transition-all ${aiProcessing === 'related' ? 'bg-rose-500/10 text-rose-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
            title="Find Related"
          >
            <Link2 className={`w-4 h-4 ${aiProcessing === 'related' ? 'animate-pulse' : ''}`} />
          </button>
          <button
            onClick={() => openModal('translate')}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
            title="Translate"
          >
            <Languages className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

          {/* Export & Integration */}
          <button
            onClick={handleSendToEmail}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Send to Email"
          >
            <Mail className="text-sm" />
          </button>
          <button
            onClick={handleCreateTask}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Create Task"
          >
            <CheckCircle2 className="text-sm" />
          </button>
          <button
            onClick={handleAddToCalendar}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Add to Calendar"
          >
            <CalendarPlus className="text-sm" />
          </button>
          <button
            onClick={() => openModal('contactPicker')}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Link to Contact"
          >
            <UserCog className="text-sm" />
          </button>

          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

          {/* Utility */}
          <button
            onClick={handlePrint}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Print"
          >
            <Printer className="text-sm" />
          </button>
          <button
            onClick={handleFullscreen}
            className={`p-2 rounded-lg transition-all ${isFullscreen ? 'bg-zinc-800 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            onClick={handleTextToSpeech}
            disabled={ttsLoading}
            className={`p-2 rounded-lg transition-all ${ttsLoading ? 'bg-blue-500/10 text-blue-500' : isSpeaking ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'} disabled:opacity-50`}
            title={ttsLoading ? 'Loading audio...' : isSpeaking ? 'Stop Speaking' : 'Read Aloud'}
          >
            {ttsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSpeaking ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleShowHistory}
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="Version History"
          >
            <History className="text-sm" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* AI Summary — canonical PULSE AI · SUMMARY provenance pattern */}
          {selectedItem.aiSummary && (
            <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-xl p-4">
              <div className="inline-flex items-center gap-1.5 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
                  Pulse AI · Summary
                </span>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{selectedItem.aiSummary}</p>
            </div>
          )}

          {/* Main Content */}
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <pre className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono bg-transparent border-none p-0 m-0">
                {selectedItem.content}
              </pre>
            </div>
          </div>

          {/* Related Items */}
          {relatedItems.length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link className="text-zinc-500 text-xs" />
                <span className="text-sm font-medium text-zinc-900 dark:text-white">Related Items</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {relatedItems.map(item => {
                  const config = getTypeConfig(item.type);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                        <config.Icon className={`${config.color} w-3 h-3`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-zinc-900 dark:text-white truncate">{item.title}</h4>
                        <span className="text-[10px] text-zinc-500">{item.date.toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => handleDelete(selectedItem.id, e)}
            className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-500 rounded-xl text-xs font-medium hover:border-rose-500/50 hover:text-rose-500 transition flex items-center gap-2"
          >
            <Trash2 /> Delete
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(selectedItem.content)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-medium hover:border-zinc-300 dark:hover:border-zinc-700 transition flex items-center gap-2"
          >
            <Copy /> Copy
          </button>
          {driveConnected && !selectedItem.driveFileId && (
            <button
              onClick={() => handleExportToDrive(selectedItem)}
              disabled={exporting}
              className={`px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                exporting
                  ? 'text-blue-500 border-blue-500/50 cursor-not-allowed'
                  : 'text-zinc-600 dark:text-zinc-400 hover:border-blue-500/50 hover:text-blue-500'
              }`}
            >
              {exporting ? (
                <>
                  <Loader2 className="animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <HardDrive /> Export to Drive
                </>
              )}
            </button>
          )}
          <button
            onClick={() => handleShare(selectedItem)}
            className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition flex items-center gap-2"
          >
            <Share2 /> Share
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveDetailView;
