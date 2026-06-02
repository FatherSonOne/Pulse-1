import React, { useState, useCallback, useRef, useEffect } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { processWithModel } from '../../../services/geminiService';
import { generateSpeech, getVoices } from '../../../services/elevenLabsService';
import { ProvenanceTag } from '../ProvenanceTag';
import toast from 'react-hot-toast';

import { Activity, Clock, Copy, Download, Lightbulb, Loader2, MessagesSquare, Pause, Play, Podcast, RefreshCw, Smile, Sparkles, Square, Volume2, X } from 'lucide-react';

interface DialogueLine {
  speaker: 'host1' | 'host2';
  text: string;
  emphasis: 'normal' | 'excited' | 'thoughtful';
}

interface PodcastScript {
  title: string;
  description: string;
  duration: string;
  lines: DialogueLine[];
  generatedAt: Date;
}

interface AudioSegment {
  line: DialogueLine;
  audioUrl: string;
  duration: number;
}

interface PodcastGeneratorProps {
  documents: KnowledgeDoc[];
  activeContextIds: Set<string>;
  apiKey: string;
  elevenLabsApiKey?: string;
  onClose: () => void;
}

// Coral Cockpit tokens. WB-4 of docs/WAR_ROOM_STUDIO_RESKIN_HANDOFF_2026-06-02.md.
const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const fieldStyle: React.CSSProperties = {
  background: 'var(--pulse-surface-raised)',
  color: 'var(--pulse-ink)',
  border: '1px solid var(--pulse-border)',
};

const EmphasisIcon: React.FC<{ emphasis: string }> = ({ emphasis }) => {
  if (emphasis === 'excited') return <Smile size={12} />;
  if (emphasis === 'thoughtful') return <Lightbulb size={12} />;
  return null;
};

export const PodcastGenerator: React.FC<PodcastGeneratorProps> = ({
  documents,
  activeContextIds,
  apiKey,
  elevenLabsApiKey,
  onClose
}) => {
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [scriptProgress, setScriptProgress] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [useElevenLabs, setUseElevenLabs] = useState(!!elevenLabsApiKey);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [host1Voice, setHost1Voice] = useState('');
  const [host2Voice, setHost2Voice] = useState('');
  const [elApiKey, setElApiKey] = useState(elevenLabsApiKey || '');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);

  // Get documents to use
  const docsToUse = activeContextIds.size > 0
    ? documents.filter(d => activeContextIds.has(d.id) && d.processing_status === 'completed')
    : documents.filter(d => d.processing_status === 'completed');

  // Load ElevenLabs voices if API key is provided
  useEffect(() => {
    if (elApiKey && useElevenLabs) {
      getVoices(elApiKey).then(voices => {
        if (voices && voices.length > 0) {
          setAvailableVoices(voices);
          // Default to first two distinct voices
          const femaleVoice = voices.find((v: any) =>
            v.labels?.gender === 'female' ||
            v.name.toLowerCase().includes('rachel') ||
            v.name.toLowerCase().includes('bella')
          ) || voices[0];
          const maleVoice = voices.find((v: any) =>
            v.labels?.gender === 'male' ||
            v.name.toLowerCase().includes('adam') ||
            v.name.toLowerCase().includes('marcus')
          ) || voices[1] || voices[0];

          setHost1Voice(femaleVoice?.voice_id || voices[0]?.voice_id);
          setHost2Voice(maleVoice?.voice_id || voices[0]?.voice_id);
        }
      }).catch(console.error);
    }
  }, [elApiKey, useElevenLabs]);

  const generateScript = useCallback(async () => {
    if (docsToUse.length === 0) {
      toast.error('No documents available to generate podcast');
      return;
    }

    setIsGeneratingScript(true);
    setScriptProgress(0);

    try {
      // Combine document content
      const docContents = docsToUse.map(d => ({
        title: d.title,
        content: (d.text_content || d.ai_summary || '').substring(0, 12000)
      }));

      const combinedContent = docContents
        .map(d => `## Document: ${d.title}\n\n${d.content}`)
        .join('\n\n---\n\n');

      setScriptProgress(10);

      const prompt = `You are an expert podcast scriptwriter. Create a natural, engaging podcast-style conversation between two hosts discussing the following documents.

DOCUMENTS:
${combinedContent}

Create a podcast script in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "title": "A catchy episode title",
  "description": "A brief episode description (1-2 sentences)",
  "duration": "Estimated duration (e.g., '8-10 minutes')",
  "lines": [
    {
      "speaker": "host1",
      "text": "The dialogue text...",
      "emphasis": "excited"
    },
    {
      "speaker": "host2",
      "text": "Response text...",
      "emphasis": "thoughtful"
    }
  ]
}

HOST PERSONALITIES:
- Host 1 (Sarah): Enthusiastic, asks probing questions, finds connections between ideas, uses analogies
- Host 2 (Marcus): Analytical, provides deeper context, challenges assumptions, offers counterpoints

REQUIREMENTS:
- Generate 20-30 dialogue exchanges for a 5-8 minute podcast
- Start with an engaging intro that hooks the listener
- Reference specific content from the documents
- Include natural conversation elements (reactions, follow-ups, "aha moments")
- Build to key insights and takeaways
- End with a compelling summary and call-to-action
- Use "emphasis" values: "normal", "excited" (for enthusiasm), or "thoughtful" (for reflection)
- Make it feel like a real conversation, not a lecture
- Include occasional humor or personality`;

      setScriptProgress(30);

      const response = await processWithModel(prompt);
      setScriptProgress(80);

      if (!response) {
        throw new Error('No response from AI');
      }

      // Parse the JSON response
      let parsed: PodcastScript;
      try {
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.slice(7);
        }
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.slice(3);
        }
        if (cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(0, -3);
        }

        parsed = JSON.parse(cleanResponse.trim());
        parsed.generatedAt = new Date();
      } catch (parseError) {
        console.error('Failed to parse script:', parseError);
        throw new Error('Failed to parse AI response');
      }

      setScriptProgress(100);
      setScript(parsed);
      toast.success('Podcast script generated!');

    } catch (error) {
      console.error('Script generation failed:', error);
      toast.error('Failed to generate podcast script');
    } finally {
      setIsGeneratingScript(false);
    }
  }, [docsToUse, apiKey]);

  const generateAudioWithElevenLabs = useCallback(async () => {
    if (!script || !elApiKey) return;

    setIsGeneratingAudio(true);
    setAudioProgress(0);

    try {
      const segments: AudioSegment[] = [];
      const totalLines = script.lines.length;

      for (let i = 0; i < script.lines.length; i++) {
        const line = script.lines[i];
        const voiceId = line.speaker === 'host1' ? host1Voice : host2Voice;

        try {
          const audioUrl = await generateSpeech(elApiKey, line.text, voiceId);
          segments.push({
            line,
            audioUrl,
            duration: 0 // Will be calculated during playback
          });
        } catch (err) {
          console.error(`Failed to generate audio for line ${i}:`, err);
        }

        setAudioProgress(Math.round(((i + 1) / totalLines) * 100));
      }

      setAudioSegments(segments);
      toast.success('Audio generated! Ready to play.');

    } catch (error) {
      console.error('Audio generation failed:', error);
      toast.error('Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [script, elApiKey, host1Voice, host2Voice]);

  const playWithWebSpeech = useCallback(async () => {
    if (!script) return;

    isPlayingRef.current = true;
    setIsPlaying(true);

    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v =>
      v.name.includes('Samantha') ||
      v.name.includes('Karen') ||
      v.name.includes('Female') ||
      v.name.includes('Zira')
    ) || voices[0];
    const maleVoice = voices.find(v =>
      v.name.includes('David') ||
      v.name.includes('Mark') ||
      v.name.includes('Male') ||
      v.name.includes('Daniel')
    ) || voices[1] || voices[0];

    for (let i = currentLineIndex; i < script.lines.length; i++) {
      if (!isPlayingRef.current) break;

      setCurrentLineIndex(i);
      const line = script.lines[i];

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.voice = line.speaker === 'host1' ? femaleVoice : maleVoice;
        utterance.rate = playbackSpeed;
        utterance.pitch = line.speaker === 'host1' ? 1.1 : 0.9;

        if (line.emphasis === 'excited') {
          utterance.rate *= 1.1;
          utterance.pitch += 0.1;
        } else if (line.emphasis === 'thoughtful') {
          utterance.rate *= 0.9;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        speechSynthRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });

      // Small pause between speakers
      if (isPlayingRef.current && i < script.lines.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [script, currentLineIndex, playbackSpeed]);

  const playWithElevenLabs = useCallback(async () => {
    if (audioSegments.length === 0) return;

    isPlayingRef.current = true;
    setIsPlaying(true);

    for (let i = currentLineIndex; i < audioSegments.length; i++) {
      if (!isPlayingRef.current) break;

      setCurrentLineIndex(i);
      const segment = audioSegments[i];

      await new Promise<void>((resolve) => {
        const audio = new Audio(segment.audioUrl);
        audio.playbackRate = playbackSpeed;
        audioRef.current = audio;

        audio.onended = () => resolve();
        audio.onerror = () => resolve();

        audio.play().catch(() => resolve());
      });

      // Small pause between speakers
      if (isPlayingRef.current && i < audioSegments.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [audioSegments, currentLineIndex, playbackSpeed]);

  const handlePlay = () => {
    if (useElevenLabs && audioSegments.length > 0) {
      playWithElevenLabs();
    } else {
      playWithWebSpeech();
    }
  };

  const handlePause = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
    }
    window.speechSynthesis.cancel();
  };

  const handleStop = () => {
    handlePause();
    setCurrentLineIndex(0);
  };

  const handleSeek = (index: number) => {
    handlePause();
    setCurrentLineIndex(index);
  };

  const exportScript = useCallback(() => {
    if (!script) return;

    let markdown = `# ${script.title}\n\n`;
    markdown += `*${script.description}*\n\n`;
    markdown += `**Duration:** ${script.duration}\n\n`;
    markdown += `**Generated:** ${script.generatedAt.toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    script.lines.forEach((line, i) => {
      const speaker = line.speaker === 'host1' ? '**Sarah:**' : '**Marcus:**';
      const emphasisNote = line.emphasis !== 'normal' ? ` *(${line.emphasis})*` : '';
      markdown += `${speaker}${emphasisNote} ${line.text}\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `podcast-script-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Script exported!');
  }, [script]);

  const copyScript = useCallback(() => {
    if (!script) return;

    let text = `${script.title}\n\n`;
    script.lines.forEach(line => {
      const speaker = line.speaker === 'host1' ? 'Sarah:' : 'Marcus:';
      text += `${speaker} ${line.text}\n\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success('Script copied to clipboard!');
  }, [script]);

  // Two-tone speaker labels: host1 carries the coral accent, host2 stays neutral.
  const getSpeakerStyle = (speaker: 'host1' | 'host2'): React.CSSProperties =>
    speaker === 'host1'
      ? { background: 'var(--pulse-coral-bg-08)', color: 'var(--pulse-coral-fg)', border: '1px solid var(--pulse-rose-soft)' }
      : { background: 'var(--pulse-surface)', color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)' };

  // Voice options block (Browser TTS vs ElevenLabs) — shown AFTER a script
  // exists (progressive disclosure), not front-loaded on the intro screen.
  const voiceOptions = (
    <div className="p-4 mb-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
      <p className="mb-3" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Voice</p>
      <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--pulse-ink-2)' }}>
          <input type="radio" checked={!useElevenLabs} onChange={() => setUseElevenLabs(false)} />
          <span className="text-sm">Browser TTS (Free)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--pulse-ink-2)' }}>
          <input type="radio" checked={useElevenLabs} onChange={() => setUseElevenLabs(true)} />
          <span className="text-sm">ElevenLabs (Premium)</span>
        </label>
      </div>
      {useElevenLabs && (
        <div className="space-y-3">
          <input
            type="password"
            value={elApiKey}
            onChange={(e) => setElApiKey(e.target.value)}
            placeholder="ElevenLabs API Key"
            className="text-sm w-full px-3 py-2 rounded-lg focus:outline-none"
            style={fieldStyle}
          />
          {availableVoices.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>Host 1 (Sarah)</label>
                <select value={host1Voice} onChange={(e) => setHost1Voice(e.target.value)} className="text-sm w-full mt-1 px-3 py-2 rounded-lg focus:outline-none" style={fieldStyle}>
                  {availableVoices.map((v: any) => (
                    <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>Host 2 (Marcus)</label>
                <select value={host2Voice} onChange={(e) => setHost2Voice(e.target.value)} className="text-sm w-full mt-1 px-3 py-2 rounded-lg focus:outline-none" style={fieldStyle}>
                  {availableVoices.map((v: any) => (
                    <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--pulse-surface-modal)', border: '1px solid var(--pulse-border)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
              <Podcast size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>Podcast</h3>
                {script && <ProvenanceTag model="GEMINI" kind="PODCAST" />}
              </div>
              <p className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                Generate a podcast-style discussion
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--pulse-ink-3)' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!script ? (
            <div className="text-center py-8">
              {isGeneratingScript ? (
                <div>
                  <Loader2 size={36} className="animate-spin mb-4 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                  <p className="text-sm mb-4" style={{ color: 'var(--pulse-ink-3)' }}>
                    Creating podcast script...
                  </p>
                  <div className="w-48 h-1.5 mx-auto rounded-full overflow-hidden" style={{ background: 'var(--pulse-surface-raised)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${scriptProgress}%`, background: 'var(--pulse-rose)' }} />
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--pulse-ink-3)' }}>
                    {scriptProgress < 30 && 'Analyzing documents...'}
                    {scriptProgress >= 30 && scriptProgress < 80 && 'Writing conversation...'}
                    {scriptProgress >= 80 && 'Finalizing script...'}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
                    <Podcast size={36} />
                  </div>
                  <p className="text-lg font-medium mb-2" style={{ color: 'var(--pulse-ink)' }}>Create Podcast</p>
                  <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--pulse-ink-3)' }}>
                    Generate a podcast-style conversation between two AI hosts discussing your documents. You can switch to premium ElevenLabs voices after the script is ready.
                  </p>

                  {/* Documents preview */}
                  <div className="mb-6">
                    <p className="text-xs mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Documents to discuss</p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                      {docsToUse.slice(0, 5).map(doc => (
                        <span key={doc.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}>
                          {doc.title}
                        </span>
                      ))}
                      {docsToUse.length > 5 && (
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}>
                          +{docsToUse.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={generateScript}
                    disabled={docsToUse.length === 0}
                    className="war-room-btn-primary px-6 py-2 rounded-lg text-sm font-medium inline-flex items-center"
                  >
                    <Sparkles size={14} className="mr-2" />
                    Generate Podcast Script
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Script header */}
              <div className="p-4 mb-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                <h4 className="font-bold text-lg mb-1" style={{ color: 'var(--pulse-ink)' }}>{script.title}</h4>
                <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>{script.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  <span className="inline-flex items-center"><Clock size={11} className="mr-1" /> {script.duration}</span>
                  <span className="inline-flex items-center"><MessagesSquare size={11} className="mr-1" /> {script.lines.length} exchanges</span>
                </div>
              </div>

              {/* Voice options (progressive disclosure — after script) */}
              {voiceOptions}

              {/* Audio Generation (for ElevenLabs) */}
              {useElevenLabs && elApiKey && audioSegments.length === 0 && (
                <div className="p-4 mb-4 text-center rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                  {isGeneratingAudio ? (
                    <div>
                      <Activity size={22} className="mb-2 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                      <p className="text-sm mb-2" style={{ color: 'var(--pulse-ink-3)' }}>
                        Generating audio with ElevenLabs...
                      </p>
                      <div className="w-48 h-1.5 mx-auto rounded-full overflow-hidden" style={{ background: 'var(--pulse-surface)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${audioProgress}%`, background: 'var(--pulse-rose)' }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--pulse-ink-3)' }}>
                        {audioProgress}% - Processing line {Math.ceil(audioProgress / 100 * script.lines.length)} of {script.lines.length}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm mb-3" style={{ color: 'var(--pulse-ink-3)' }}>
                        Generate high-quality audio with ElevenLabs voices
                      </p>
                      <button
                        onClick={generateAudioWithElevenLabs}
                        className="war-room-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center"
                      >
                        <Activity size={14} className="mr-2" />
                        Generate Premium Audio
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Audio Player Controls */}
              <div className="p-4 mb-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={isPlaying ? handlePause : handlePlay}
                      className="war-room-btn-primary w-12 h-12 rounded-full flex items-center justify-center"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={handleStop}
                      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: 'var(--pulse-surface)', color: 'var(--pulse-ink-2)' }}
                      aria-label="Stop"
                    >
                      <Square size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>Speed:</span>
                      <select
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                        className="text-sm px-2 py-1 rounded-lg focus:outline-none"
                        style={fieldStyle}
                      >
                        <option value={0.75}>0.75x</option>
                        <option value={1}>1x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>
                    </div>

                    <div className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>
                      {currentLineIndex + 1} / {script.lines.length}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className="h-2 cursor-pointer rounded-full overflow-hidden"
                  style={{ background: 'var(--pulse-surface)' }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    const index = Math.floor(percent * script.lines.length);
                    handleSeek(Math.min(Math.max(0, index), script.lines.length - 1));
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${((currentLineIndex + 1) / script.lines.length) * 100}%`, background: 'var(--pulse-rose)' }}
                  ></div>
                </div>
              </div>

              {/* Transcript */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium" style={{ color: 'var(--pulse-ink)' }}>Transcript</h5>
                  <span className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                    Click any line to jump to it
                  </span>
                </div>

                {script.lines.map((line, i) => {
                  const isCurrent = i === currentLineIndex;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSeek(i)}
                      className="p-3 cursor-pointer transition-all rounded-lg"
                      style={isCurrent
                        ? { background: 'var(--pulse-coral-bg-08)', border: '1px solid var(--pulse-rose)' }
                        : { background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0">
                          <span className="inline-block text-xs px-2 py-0.5 rounded" style={getSpeakerStyle(line.speaker)}>
                            {line.speaker === 'host1' ? 'Sarah' : 'Marcus'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                            {line.text}
                          </p>
                          {line.emphasis !== 'normal' && (
                            <span className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: 'var(--pulse-ink-3)' }}>
                              <EmphasisIcon emphasis={line.emphasis} />
                              {line.emphasis}
                            </span>
                          )}
                        </div>
                        {isCurrent && isPlaying && (
                          <div className="shrink-0">
                            <Volume2 size={16} className="animate-pulse" style={{ color: 'var(--pulse-coral-fg)' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid var(--pulse-border)' }}>
          <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
            {script && (
              <span>
                {useElevenLabs && audioSegments.length > 0
                  ? 'Using ElevenLabs premium voices'
                  : 'Using browser text-to-speech'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {script && (
              <>
                <button
                  onClick={() => setScript(null)}
                  className="px-3 py-2 rounded-lg text-sm inline-flex items-center transition-colors"
                  style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
                >
                  <RefreshCw size={14} className="mr-2" />
                  Regenerate
                </button>
                <button
                  onClick={copyScript}
                  className="px-3 py-2 rounded-lg text-sm inline-flex items-center transition-colors"
                  style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
                >
                  <Copy size={14} className="mr-2" />
                  Copy
                </button>
                <button
                  onClick={exportScript}
                  className="war-room-btn-primary px-3 py-2 rounded-lg text-sm inline-flex items-center"
                >
                  <Download size={14} className="mr-2" />
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodcastGenerator;
