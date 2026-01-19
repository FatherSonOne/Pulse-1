
import React, { useState, useRef } from 'react';
import {
  generateThinkingResponse,
  analyzeVideo,
  transcribeMedia,
  generateProImage,
  generateCode,
  generateVideo,
  editImage,
  generateMapsResponse
} from '../services/geminiService';
import { blobToBase64 } from '../services/audioService';
import { transcribeAudio, generateMeetingInsights } from '../services/assemblyService';
import { generateSpeech as generateElevenLabsSpeech, getVoices } from '../services/elevenLabsService';
import { searchPerplexity } from '../services/perplexityService';
import { geocodeAddress, getStaticMapUrl, getNavigationRoute } from '../services/mapboxService';
import { generateWithFallback, AIProvider } from '../services/unifiedAIService';

interface ToolsProps {
  apiKey: string;
  assemblyKey?: string;
  elevenLabsKey?: string;
  perplexityKey?: string;
  mapboxKey?: string;
  openaiKey?: string;
  claudeKey?: string;
}

type ToolId = 'reason' | 'video' | 'video_gen' | 'transcribe' | 'code' | 'vision' | 'image_edit' | 'maps' | 'meeting_intel' | 'voice_studio' | 'deep_search' | 'route_planner' | 'ai_assistant' | null;

interface ToolTileConfig {
  id: ToolId;
  icon: string;
  label: string;
  description: string;
  color: string;
  gradient: string;
  partner?: string;
}

const TOOL_TILES: ToolTileConfig[] = [
  // === GEMINI TOOLS ===
  {
    id: 'reason',
    icon: 'fa-brain',
    label: 'Deep Reasoner',
    description: 'Complex problem solving with extended thinking',
    color: 'purple',
    gradient: 'from-purple-600 to-violet-600',
    partner: 'Gemini'
  },
  {
    id: 'video',
    icon: 'fa-film',
    label: 'Video Analyst',
    description: 'Analyze and extract insights from video content',
    color: 'blue',
    gradient: 'from-blue-600 to-cyan-600',
    partner: 'Gemini'
  },
  {
    id: 'video_gen',
    icon: 'fa-clapperboard',
    label: 'Video Studio',
    description: 'Generate videos with Veo AI model',
    color: 'orange',
    gradient: 'from-orange-600 to-amber-600',
    partner: 'Veo'
  },
  {
    id: 'transcribe',
    icon: 'fa-headphones-simple',
    label: 'Voice Lab',
    description: 'Real-time speech transcription',
    color: 'emerald',
    gradient: 'from-emerald-600 to-teal-600',
    partner: 'Gemini'
  },
  {
    id: 'code',
    icon: 'fa-laptop-code',
    label: 'Code Studio',
    description: 'Generate code and algorithms',
    color: 'indigo',
    gradient: 'from-indigo-600 to-blue-600',
    partner: 'Gemini'
  },
  {
    id: 'vision',
    icon: 'fa-image',
    label: 'Vision Lab',
    description: 'Create stunning images with Imagen 3',
    color: 'pink',
    gradient: 'from-pink-600 to-rose-600',
    partner: 'Imagen'
  },
  {
    id: 'image_edit',
    icon: 'fa-wand-magic-sparkles',
    label: 'Image Editor',
    description: 'AI-powered image editing and manipulation',
    color: 'cyan',
    gradient: 'from-cyan-600 to-sky-600',
    partner: 'Gemini'
  },
  {
    id: 'maps',
    icon: 'fa-map-location-dot',
    label: 'Geo Intel',
    description: 'Location-aware queries with grounding',
    color: 'green',
    gradient: 'from-green-600 to-emerald-600',
    partner: 'Gemini'
  },
  // === NEW MULTI-API TOOLS ===
  {
    id: 'meeting_intel',
    icon: 'fa-users-rectangle',
    label: 'Meeting Intel',
    description: 'Speaker diarization & sentiment from recordings',
    color: 'violet',
    gradient: 'from-violet-600 to-purple-600',
    partner: 'AssemblyAI'
  },
  {
    id: 'voice_studio',
    icon: 'fa-podcast',
    label: 'Voice Studio',
    description: 'Ultra-realistic text-to-speech synthesis',
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
    partner: 'ElevenLabs'
  },
  {
    id: 'deep_search',
    icon: 'fa-magnifying-glass-chart',
    label: 'Deep Search',
    description: 'Real-time web research with citations',
    color: 'sky',
    gradient: 'from-sky-500 to-blue-600',
    partner: 'Perplexity'
  },
  {
    id: 'route_planner',
    icon: 'fa-route',
    label: 'Route Planner',
    description: 'Visual maps & optimized navigation',
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-600',
    partner: 'Mapbox'
  },
  {
    id: 'ai_assistant',
    icon: 'fa-robot',
    label: 'AI Assistant',
    description: 'Multi-model chat with auto-fallback',
    color: 'rose',
    gradient: 'from-rose-500 to-pink-600',
    partner: 'Multi-AI'
  },
];

const Tools: React.FC<ToolsProps> = ({ apiKey, assemblyKey, elevenLabsKey, perplexityKey, mapboxKey, openaiKey, claudeKey }) => {
  const [activeTool, setActiveTool] = useState<ToolId>(null);
  
  // Reason State
  const [reasonPrompt, setReasonPrompt] = useState('');
  const [reasonResult, setReasonResult] = useState('');
  const [isReasoning, setIsReasoning] = useState(false);

  // Video Analysis State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoResult, setVideoResult] = useState('');
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video Generation State
  const [videoGenPrompt, setVideoGenPrompt] = useState('');
  const [videoGenImage, setVideoGenImage] = useState<File | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const videoImageInputRef = useRef<HTMLInputElement>(null);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Code State
  const [codePrompt, setCodePrompt] = useState('');
  const [codeResult, setCodeResult] = useState('');
  const [isCoding, setIsCoding] = useState(false);

  // Vision State
  const [visionPrompt, setVisionPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Image Edit State
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  // Maps State
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsResult, setMapsResult] = useState('');
  const [mapsChunks, setMapsChunks] = useState<any[]>([]);
  const [isMapping, setIsMapping] = useState(false);

  // === NEW TOOL STATES ===
  
  // Meeting Intel State (AssemblyAI)
  const [meetingFile, setMeetingFile] = useState<File | null>(null);
  const [meetingTranscript, setMeetingTranscript] = useState<any>(null);
  const [meetingInsights, setMeetingInsights] = useState('');
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [meetingInsightPrompt, setMeetingInsightPrompt] = useState('Extract action items, key decisions, and assign owners');
  const meetingFileInputRef = useRef<HTMLInputElement>(null);

  // Voice Studio State (ElevenLabs)
  const [ttsText, setTtsText] = useState('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('21m00Tcm4TlvDq8ikWAM');
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);

  // Deep Search State (Perplexity)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [searchCitations, setSearchCitations] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Route Planner State (Mapbox)
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [mapImageUrl, setMapImageUrl] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);

  // AI Assistant State (Multi-AI Fallback)
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantResult, setAssistantResult] = useState('');
  const [assistantProvider, setAssistantProvider] = useState<AIProvider | ''>('');
  const [preferredProvider, setPreferredProvider] = useState<AIProvider>('gemini');
  const [isAssisting, setIsAssisting] = useState(false);

  // --- Handlers ---

  const handleReason = async () => {
    if (!reasonPrompt.trim() || !apiKey) return;
    setIsReasoning(true);
    setReasonResult('');
    try {
      const text = await generateThinkingResponse(apiKey, reasonPrompt);
      setReasonResult(text || "No response generated.");
    } catch (e) {
      setReasonResult("Error: Unable to process complex query. Please try again.");
    }
    setIsReasoning(false);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleAnalyzeVideo = async () => {
    if (!videoFile || !videoPrompt.trim() || !apiKey) return;
    setIsAnalyzingVideo(true);
    setVideoResult('');
    try {
      const blob = videoFile.slice(0, videoFile.size); // Full file
      const base64 = await blobToBase64(blob);
      const text = await analyzeVideo(apiKey, base64, videoFile.type, videoPrompt);
      setVideoResult(text || "No insights found.");
    } catch (e) {
      setVideoResult("Error analyzing video. Ensure the file is not too large.");
    }
    setIsAnalyzingVideo(false);
  };

  const handleVideoGenUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setVideoGenImage(e.target.files[0]);
      }
  };

  const handleGenerateVideo = async () => {
      if (!videoGenPrompt.trim() || !apiKey) return;
      setIsGeneratingVideo(true);
      setGeneratedVideoUrl('');
      try {
          let imageBase64;
          let imageMime;
          if (videoGenImage) {
              imageBase64 = await blobToBase64(videoGenImage);
              imageMime = videoGenImage.type;
          }
          const url = await generateVideo(apiKey, videoGenPrompt, imageBase64, imageMime);
          if (url) setGeneratedVideoUrl(url);
          else throw new Error("Video generation failed");
      } catch (e) {
          console.error(e);
          alert("Error generating video. Please try again.");
      }
      setIsGeneratingVideo(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }
        
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          setIsTranscribing(true);
          const blob = new Blob(chunksRef.current, { type: mimeType });
          
          if (blob.size < 100) {
              setTranscription("Recording too short. Please try again.");
              setIsTranscribing(false);
              stream.getTracks().forEach(t => t.stop());
              return;
          }

          const base64 = await blobToBase64(blob);
          try {
            // FIX: Pass the actual mimeType detected above, not hardcoded 'audio/webm'
            const text = await transcribeMedia(apiKey, base64, mimeType);
            setTranscription(text || "No speech detected.");
          } catch (e) {
            console.error(e);
            setTranscription("Transcription failed. Please try again.");
          }
          setIsTranscribing(false);
          stream.getTracks().forEach(t => t.stop());
        };

        recorder.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Mic error", e);
        setTranscription("Microphone access denied.");
      }
    }
  };

  const handleGenerateCode = async () => {
      if (!codePrompt.trim() || !apiKey) return;
      setIsCoding(true);
      setCodeResult('');
      try {
          const text = await generateCode(apiKey, codePrompt);
          setCodeResult(text || "No code generated.");
      } catch (e) {
          setCodeResult("Error generating code.");
      }
      setIsCoding(false);
  };

  const handleGenerateImage = async () => {
      if (!visionPrompt.trim() || !apiKey) return;
      setIsGeneratingImage(true);
      setGeneratedImage('');
      try {
          const url = await generateProImage(apiKey, visionPrompt, aspectRatio, imageSize);
          if (url) setGeneratedImage(url);
          else throw new Error("No image returned");
      } catch (e) {
          console.error(e);
          alert("Error generating image.");
      }
      setIsGeneratingImage(false);
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setEditImageFile(e.target.files[0]);
      }
  };

  const handleEditImage = async () => {
      if (!editImageFile || !editPrompt.trim() || !apiKey) return;
      setIsEditingImage(true);
      setEditedImageUrl('');
      try {
          const base64 = await blobToBase64(editImageFile);
          const url = await editImage(apiKey, base64, editPrompt, editImageFile.type);
          if (url) setEditedImageUrl(url);
          else throw new Error("Image edit failed");
      } catch (e) {
          console.error(e);
          alert("Error editing image.");
      }
      setIsEditingImage(false);
  };

  const handleMapsQuery = async () => {
      if (!mapsQuery.trim() || !apiKey) return;
      setIsMapping(true);
      setMapsResult('');
      setMapsChunks([]);
      try {
          const { text, groundingChunks } = await generateMapsResponse(apiKey, mapsQuery);
          setMapsResult(text);
          setMapsChunks(groundingChunks);
      } catch (e) {
          setMapsResult("Error querying maps.");
      }
      setIsMapping(false);
  };

  // === NEW TOOL HANDLERS ===

  // Meeting Intel Handler (AssemblyAI)
  const handleMeetingFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMeetingFile(e.target.files[0]);
      setMeetingTranscript(null);
      setMeetingInsights('');
    }
  };

  const handleProcessMeeting = async () => {
    if (!meetingFile || !assemblyKey) return;
    setIsProcessingMeeting(true);
    setMeetingTranscript(null);
    setMeetingInsights('');
    try {
      const transcript = await transcribeAudio(assemblyKey, meetingFile);
      setMeetingTranscript(transcript);
      
      // Auto-generate insights if transcript succeeded
      if (transcript?.id) {
        const insights = await generateMeetingInsights(assemblyKey, transcript.id, meetingInsightPrompt);
        setMeetingInsights(insights || '');
      }
    } catch (e) {
      console.error(e);
      setMeetingInsights("Error processing meeting. Check your API key.");
    }
    setIsProcessingMeeting(false);
  };

  // Voice Studio Handler (ElevenLabs)
  const handleGenerateTTS = async () => {
    if (!ttsText.trim() || !elevenLabsKey) return;
    setIsGeneratingSpeech(true);
    setTtsAudioUrl('');
    try {
      const url = await generateElevenLabsSpeech(elevenLabsKey, ttsText, selectedVoice);
      setTtsAudioUrl(url);
    } catch (e) {
      console.error(e);
      alert("Error generating speech. Check your API key.");
    }
    setIsGeneratingSpeech(false);
  };

  const loadElevenLabsVoices = async () => {
    if (!elevenLabsKey || availableVoices.length > 0) return;
    try {
      const voices = await getVoices(elevenLabsKey);
      setAvailableVoices(voices || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Deep Search Handler (Perplexity)
  const handleDeepSearch = async () => {
    if (!searchQuery.trim() || !perplexityKey) return;
    setIsSearching(true);
    setSearchResult('');
    setSearchCitations([]);
    try {
      const { text, citations } = await searchPerplexity(perplexityKey, searchQuery);
      setSearchResult(text);
      setSearchCitations(citations);
    } catch (e) {
      console.error(e);
      setSearchResult("Error searching. Check your API key.");
    }
    setIsSearching(false);
  };

  // Route Planner Handler (Mapbox)
  const handlePlanRoute = async () => {
    if (!startAddress.trim() || !endAddress.trim() || !mapboxKey) return;
    setIsPlanning(true);
    setRouteInfo(null);
    setMapImageUrl('');
    try {
      const startGeo = await geocodeAddress(mapboxKey, startAddress);
      const endGeo = await geocodeAddress(mapboxKey, endAddress);
      
      if (!startGeo || !endGeo) {
        throw new Error("Could not find addresses");
      }
      
      const [startLng, startLat] = startGeo.center;
      const [endLng, endLat] = endGeo.center;
      
      const route = await getNavigationRoute(mapboxKey, [startLng, startLat], [endLng, endLat]);
      setRouteInfo(route);
      
      // Generate map centered between the two points
      const midLng = (startLng + endLng) / 2;
      const midLat = (startLat + endLat) / 2;
      setMapImageUrl(getStaticMapUrl(mapboxKey, midLng, midLat, 10));
    } catch (e) {
      console.error(e);
      alert("Error planning route.");
    }
    setIsPlanning(false);
  };

  // AI Assistant Handler (Multi-AI Fallback)
  const handleAIAssist = async () => {
    if (!assistantPrompt.trim()) return;
    setIsAssisting(true);
    setAssistantResult('');
    setAssistantProvider('');
    try {
      const response = await generateWithFallback(
        {
          openaiKey,
          claudeKey,
          geminiKey: apiKey,
          preferredProvider
        },
        assistantPrompt
      );
      setAssistantResult(response.text);
      setAssistantProvider(response.provider);
    } catch (e) {
      console.error(e);
      setAssistantResult("All AI providers failed. Please check your API keys.");
    }
    setIsAssisting(false);
  };

  // Get current tool config
  const currentTool = TOOL_TILES.find(t => t.id === activeTool);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeTool && (
              <button
                onClick={() => setActiveTool(null)}
                className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                <i className="fa-solid fa-arrow-left text-zinc-600 dark:text-zinc-400"></i>
              </button>
            )}
            <div>
              <h2 className="text-2xl font-light dark:text-white text-zinc-900 mb-1 flex items-center gap-2">
                {activeTool && currentTool ? (
                  <>
                    <i className={`fa-solid ${currentTool.icon} text-${currentTool.color}-500`}></i>
                    {currentTool.label}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-flask text-purple-500"></i> AI Lab
                  </>
                )}
              </h2>
              <p className="text-zinc-500 text-sm font-light">
                {activeTool && currentTool ? currentTool.description : 'Multi-AI toolkit powered by Gemini, OpenAI, Claude & more'}
              </p>
            </div>
          </div>
          {currentTool?.partner && (
            <div className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
              Powered by {currentTool.partner}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-zinc-50 dark:bg-zinc-950/50">

        {/* Tile Grid - Show when no tool selected */}
        {!activeTool && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            {TOOL_TILES.map((tile) => (
              <button
                key={tile.id}
                onClick={() => setActiveTool(tile.id)}
                className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-black/50 hover:-translate-y-1"
              >
                {/* Gradient accent */}
                <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${tile.gradient} opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tile.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <i className={`fa-solid ${tile.icon} text-white text-xl`}></i>
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-100 transition">
                  {tile.label}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {tile.description}
                </p>

                {/* Partner badge */}
                {tile.partner && (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <i className="fa-solid fa-bolt text-amber-500"></i>
                    {tile.partner}
                  </div>
                )}

                {/* Arrow indicator */}
                <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                  <i className="fa-solid fa-arrow-right text-zinc-500 dark:text-zinc-400 text-xs"></i>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Deep Reasoner */}
        {activeTool === 'reason' && (
           <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <div className="mb-4">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Complex Query</label>
                    <textarea 
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-purple-500 transition min-h-[120px]"
                      placeholder="Ask a complex question requiring deep reasoning (e.g., 'Analyze the geopolitical implications of...' or 'Solve this advanced logic puzzle...')"
                      value={reasonPrompt}
                      onChange={(e) => setReasonPrompt(e.target.value)}
                    />
                 </div>
                 <div className="flex justify-end">
                    <button 
                      onClick={handleReason}
                      disabled={isReasoning || !reasonPrompt.trim()}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                    >
                       {isReasoning ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Thinking...</> : <><i className="fa-solid fa-bolt"></i> Analyze</>}
                    </button>
                 </div>
              </div>
              
              {reasonResult && (
                 <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                     <h3 className="text-purple-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-lightbulb"></i> Analysis Result
                     </h3>
                     <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                        {reasonResult}
                     </div>
                 </div>
              )}
           </div>
        )}

        {/* Video Analyst */}
        {activeTool === 'video' && (
           <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Upload Video</label>
                        <div 
                           onClick={() => fileInputRef.current?.click()}
                           className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition"
                        >
                           <i className="fa-solid fa-cloud-arrow-up text-2xl text-zinc-400 mb-2"></i>
                           <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                              {videoFile ? videoFile.name : "Click to select video"}
                           </span>
                           <span className="text-xs text-zinc-400 mt-1">Max 20MB for demo</span>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Prompt</label>
                        <textarea 
                           className="flex-1 w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-blue-500 transition resize-none"
                           placeholder="What should I look for in this video?"
                           value={videoPrompt}
                           onChange={(e) => setVideoPrompt(e.target.value)}
                        />
                    </div>
                 </div>
                 <div className="flex justify-end">
                    <button 
                      onClick={handleAnalyzeVideo}
                      disabled={isAnalyzingVideo || !videoFile || !videoPrompt.trim()}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                    >
                       {isAnalyzingVideo ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Analyzing...</> : <><i className="fa-solid fa-play"></i> Process Video</>}
                    </button>
                 </div>
              </div>

              {videoResult && (
                 <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                     <h3 className="text-blue-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-eye"></i> Video Insights
                     </h3>
                     <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                        {videoResult}
                     </div>
                 </div>
              )}
           </div>
        )}

        {/* Video Generation */}
        {activeTool === 'video_gen' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Source Image (Optional)</label>
                            <div 
                                onClick={() => videoImageInputRef.current?.click()}
                                className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition relative overflow-hidden"
                            >
                                {videoGenImage ? (
                                    <img src={URL.createObjectURL(videoGenImage)} className="w-full h-full object-cover opacity-50" />
                                ) : (
                                    <>
                                        <i className="fa-solid fa-image text-2xl text-zinc-400 mb-2"></i>
                                        <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Click to select image</span>
                                    </>
                                )}
                            </div>
                            <input type="file" ref={videoImageInputRef} className="hidden" accept="image/*" onChange={handleVideoGenUpload} />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Prompt</label>
                            <textarea 
                                className="flex-1 w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-orange-500 transition resize-none"
                                placeholder="Describe the video you want to generate (e.g. A neon cyberpunk city rain)"
                                value={videoGenPrompt}
                                onChange={(e) => setVideoGenPrompt(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button 
                            onClick={handleGenerateVideo}
                            disabled={isGeneratingVideo || !videoGenPrompt.trim()}
                            className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isGeneratingVideo ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Generating...</> : <><i className="fa-solid fa-film"></i> Generate Veo</>}
                        </button>
                    </div>
                </div>

                {generatedVideoUrl && (
                    <div className="bg-black rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
                        <video src={generatedVideoUrl} controls className="w-full h-auto" />
                        <div className="p-4 bg-zinc-900 flex justify-between items-center">
                            <span className="text-white text-sm font-bold">Veo Generation</span>
                            <a href={generatedVideoUrl} download="veo-gen.mp4" className="text-zinc-400 hover:text-white"><i className="fa-solid fa-download"></i></a>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Transcriber */}
        {activeTool === 'transcribe' && (
           <div className="max-w-2xl mx-auto space-y-6 animate-slide-up text-center">
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-lg flex flex-col items-center justify-center gap-6">
                 
                 <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-500/10 scale-110' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    <button 
                       onClick={toggleRecording}
                       className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl shadow-xl transition-all hover:scale-105 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-900 dark:bg-white text-white dark:text-black'}`}
                    >
                       <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                    </button>
                 </div>
                 
                 <div>
                    <h3 className="text-xl font-medium dark:text-white text-zinc-900">
                       {isRecording ? "Listening..." : "Tap to Record"}
                    </h3>
                    <p className="text-zinc-500 text-sm mt-2">
                       {isRecording ? "Speak clearly. Tap stop when finished." : "Use Gemini Flash for instant audio-to-text transcription."}
                    </p>
                 </div>

                 {isTranscribing && (
                    <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium animate-pulse">
                       <i className="fa-solid fa-circle-notch fa-spin"></i> Transcribing...
                    </div>
                 )}
              </div>

              {transcription && (
                 <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in text-left relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-emerald-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-quote-left"></i> Transcription
                        </h3>
                        <button 
                           onClick={() => {navigator.clipboard.writeText(transcription)}}
                           className="text-zinc-400 hover:text-emerald-500 transition"
                           title="Copy"
                        >
                            <i className="fa-solid fa-copy"></i>
                        </button>
                     </div>
                     <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-serif italic">
                        "{transcription}"
                     </p>
                 </div>
              )}
           </div>
        )}

        {/* Code Studio */}
        {activeTool === 'code' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Task Description</label>
                        <textarea 
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-indigo-500 transition min-h-[120px] font-mono"
                            placeholder="Describe the function, component, or algorithm you need..."
                            value={codePrompt}
                            onChange={(e) => setCodePrompt(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button 
                            onClick={handleGenerateCode}
                            disabled={isCoding || !codePrompt.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isCoding ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Coding...</> : <><i className="fa-solid fa-code"></i> Generate Code</>}
                        </button>
                    </div>
                </div>

                {codeResult && (
                    <div className="bg-[#1e1e1e] p-6 rounded-2xl border border-zinc-800 shadow-2xl animate-fade-in relative">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-800">
                             <div className="flex gap-2">
                                 <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                 <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                 <div className="w-3 h-3 rounded-full bg-green-500"></div>
                             </div>
                             <button onClick={() => navigator.clipboard.writeText(codeResult)} className="text-zinc-500 hover:text-white text-xs uppercase font-bold tracking-wider">
                                 Copy Code
                             </button>
                        </div>
                        <pre className="overflow-x-auto text-sm font-mono text-zinc-300 leading-relaxed">
                            {codeResult}
                        </pre>
                    </div>
                )}
            </div>
        )}

        {/* Vision Lab */}
        {activeTool === 'vision' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Image Prompt</label>
                        <textarea 
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-pink-500 transition min-h-[120px]"
                            placeholder="Describe the image you want to create in detail..."
                            value={visionPrompt}
                            onChange={(e) => setVisionPrompt(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Aspect Ratio</label>
                            <select 
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-pink-500"
                            >
                                <option value="1:1">Square (1:1)</option>
                                <option value="16:9">Landscape (16:9)</option>
                                <option value="4:3">Standard (4:3)</option>
                                <option value="3:4">Portrait (3:4)</option>
                                <option value="9:16">Story (9:16)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Size</label>
                            <select 
                                value={imageSize}
                                onChange={(e) => setImageSize(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-pink-500"
                            >
                                <option value="1K">1K</option>
                                <option value="2K">2K</option>
                                <option value="4K">4K</option>
                            </select>
                        </div>
                        <button 
                            onClick={handleGenerateImage}
                            disabled={isGeneratingImage || !visionPrompt.trim()}
                            className="mt-auto bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-pink-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGeneratingImage ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Generating...</> : <><i className="fa-solid fa-wand-magic-sparkles"></i> Create</>}
                        </button>
                    </div>
                </div>

                {generatedImage && (
                    <div className="flex justify-center animate-scale-in">
                        <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-black">
                            <img src={generatedImage} alt="Generated" className="max-w-full max-h-[600px] object-contain" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                                <a href={generatedImage} download="pulse-vision.png" className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-xl">
                                    <i className="fa-solid fa-download"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Image Editor */}
        {activeTool === 'image_edit' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Original Image</label>
                            <div 
                                onClick={() => editImageInputRef.current?.click()}
                                className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 dark:hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition relative overflow-hidden"
                            >
                                {editImageFile ? (
                                    <img src={URL.createObjectURL(editImageFile)} className="w-full h-full object-contain" />
                                ) : (
                                    <>
                                        <i className="fa-solid fa-image text-2xl text-zinc-400 mb-2"></i>
                                        <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Click to select image</span>
                                    </>
                                )}
                            </div>
                            <input type="file" ref={editImageInputRef} className="hidden" accept="image/*" onChange={handleEditImageUpload} />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Edit Instruction</label>
                            <textarea 
                                className="flex-1 w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-cyan-500 transition resize-none"
                                placeholder="e.g., 'Add a retro filter', 'Make the background snowy'..."
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button 
                            onClick={handleEditImage}
                            disabled={isEditingImage || !editImageFile || !editPrompt.trim()}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isEditingImage ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Editing...</> : <><i className="fa-solid fa-wand-sparkles"></i> Apply Edit</>}
                        </button>
                    </div>
                </div>

                {editedImageUrl && (
                    <div className="flex justify-center animate-scale-in">
                         <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-black">
                            <img src={editedImageUrl} alt="Edited" className="max-w-full max-h-[600px] object-contain" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                                <a href={editedImageUrl} download="pulse-edit.png" className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-xl">
                                    <i className="fa-solid fa-download"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Maps / Geo Intel */}
        {activeTool === 'maps' && (
             <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
                 <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-green-500 transition"
                            placeholder="Ask about places (e.g., 'Coffee shops near Time Square')..."
                            value={mapsQuery}
                            onChange={(e) => setMapsQuery(e.target.value)}
                        />
                        <button 
                            onClick={handleMapsQuery}
                            disabled={isMapping || !mapsQuery.trim()}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-green-500/20 disabled:opacity-50"
                        >
                            {isMapping ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-map-location-dot"></i>}
                        </button>
                    </div>
                 </div>

                 {mapsResult && (
                     <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                         <h3 className="text-green-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                             <i className="fa-solid fa-map-location-dot"></i> Geo Intel Result
                         </h3>
                         <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                             {mapsResult}
                         </div>

                         {mapsChunks && mapsChunks.length > 0 && (
                             <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                 <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Sources</h4>
                                 <div className="grid grid-cols-1 gap-2">
                                     {mapsChunks.map((chunk, i) => (
                                         <a 
                                           key={i} 
                                           href={chunk.maps?.uri} 
                                           target="_blank" 
                                           rel="noreferrer"
                                           className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition border border-zinc-100 dark:border-zinc-800"
                                         >
                                             <i className="fa-solid fa-location-dot text-red-500"></i>
                                             <span className="text-sm font-medium dark:text-zinc-300 text-zinc-700">{chunk.maps?.title || "Map Location"}</span>
                                         </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* === NEW TOOLS === */}

        {/* Meeting Intel (AssemblyAI) */}
        {activeTool === 'meeting_intel' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Upload Meeting Recording</label>
                  <div 
                    onClick={() => meetingFileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer hover:border-violet-500 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition"
                  >
                    <i className="fa-solid fa-file-audio text-2xl text-zinc-400 mb-2"></i>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                      {meetingFile ? meetingFile.name : "Click to select audio/video"}
                    </span>
                    <span className="text-xs text-zinc-400 mt-1">MP3, WAV, MP4, WebM</span>
                  </div>
                  <input type="file" ref={meetingFileInputRef} className="hidden" accept="audio/*,video/*" onChange={handleMeetingFileUpload} />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Insight Prompt</label>
                  <textarea 
                    className="flex-1 w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-violet-500 transition resize-none"
                    placeholder="What insights do you want from this meeting?"
                    value={meetingInsightPrompt}
                    onChange={(e) => setMeetingInsightPrompt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={handleProcessMeeting}
                  disabled={isProcessingMeeting || !meetingFile || !assemblyKey}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingMeeting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Processing...</> : <><i className="fa-solid fa-users-rectangle"></i> Analyze Meeting</>}
                </button>
              </div>
              {!assemblyKey && (
                <p className="text-xs text-amber-500 mt-2">⚠️ AssemblyAI API key required</p>
              )}
            </div>

            {meetingTranscript && (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500"></div>
                <h3 className="text-violet-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-microphone-lines"></i> Transcript
                </h3>
                
                {/* Speaker segments */}
                <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
                  {meetingTranscript.utterances?.map((u: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-xs font-bold text-violet-500 w-20 shrink-0">Speaker {u.speaker}</span>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{u.text}</p>
                    </div>
                  )) || (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{meetingTranscript.text}</p>
                  )}
                </div>

                {/* Sentiment */}
                {meetingTranscript.sentiment_analysis_results && (
                  <div className="mb-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Sentiment Overview</h4>
                    <div className="flex gap-4">
                      {['POSITIVE', 'NEUTRAL', 'NEGATIVE'].map(sentiment => {
                        const count = meetingTranscript.sentiment_analysis_results.filter((s: any) => s.sentiment === sentiment).length;
                        const total = meetingTranscript.sentiment_analysis_results.length;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={sentiment} className="text-center">
                            <div className={`text-2xl font-bold ${sentiment === 'POSITIVE' ? 'text-green-500' : sentiment === 'NEGATIVE' ? 'text-red-500' : 'text-zinc-400'}`}>
                              {pct}%
                            </div>
                            <div className="text-xs text-zinc-400 capitalize">{sentiment.toLowerCase()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {meetingInsights && (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                <h3 className="text-purple-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-lightbulb"></i> Meeting Insights
                </h3>
                <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {meetingInsights}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Voice Studio (ElevenLabs) */}
        {activeTool === 'voice_studio' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="mb-4">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Text to Speak</label>
                <textarea 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-amber-500 transition min-h-[120px]"
                  placeholder="Enter the text you want to convert to speech..."
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                />
              </div>
              
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Voice</label>
                  <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    onFocus={loadElevenLabsVoices}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-amber-500"
                  >
                    <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Female)</option>
                    <option value="AZnzlk1XvdvUeBnXmlld">Domi (Female)</option>
                    <option value="EXAVITQu4vr4xnSDxMaL">Bella (Female)</option>
                    <option value="ErXwobaYiN019PkySvjV">Antoni (Male)</option>
                    <option value="VR6AewLTigWG4xSOukaG">Arnold (Male)</option>
                    <option value="pNInz6obpgDQGcFmaJgB">Adam (Male)</option>
                    {availableVoices.map((v: any) => (
                      <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={handleGenerateTTS}
                  disabled={isGeneratingSpeech || !ttsText.trim() || !elevenLabsKey}
                  className="bg-amber-500 hover:bg-amber-400 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingSpeech ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Generating...</> : <><i className="fa-solid fa-volume-high"></i> Generate Speech</>}
                </button>
              </div>
              {!elevenLabsKey && (
                <p className="text-xs text-amber-500 mt-2">⚠️ ElevenLabs API key required</p>
              )}
            </div>

            {ttsAudioUrl && (
              <div className="bg-zinc-900 p-6 rounded-2xl shadow-2xl animate-fade-in">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center">
                    <i className="fa-solid fa-podcast text-white text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Generated Audio</h3>
                    <p className="text-zinc-400 text-sm">ElevenLabs TTS</p>
                  </div>
                </div>
                <audio src={ttsAudioUrl} controls className="w-full" />
                <div className="flex justify-end mt-4">
                  <a href={ttsAudioUrl} download="pulse-tts.mp3" className="text-amber-500 hover:text-amber-400 text-sm font-medium flex items-center gap-2">
                    <i className="fa-solid fa-download"></i> Download
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deep Search (Perplexity) */}
        {activeTool === 'deep_search' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-sky-500 transition"
                  placeholder="Research any topic with real-time web data..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeepSearch()}
                />
                <button 
                  onClick={handleDeepSearch}
                  disabled={isSearching || !searchQuery.trim() || !perplexityKey}
                  className="bg-sky-500 hover:bg-sky-400 text-white px-6 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  {isSearching ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass-chart"></i>}
                </button>
              </div>
              {!perplexityKey && (
                <p className="text-xs text-amber-500 mt-2">⚠️ Perplexity API key required</p>
              )}
            </div>

            {searchResult && (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
                <h3 className="text-sky-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-magnifying-glass-chart"></i> Research Result
                </h3>
                <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {searchResult}
                </div>

                {searchCitations.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Sources</h4>
                    <div className="flex flex-wrap gap-2">
                      {searchCitations.map((url, i) => (
                        <a 
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 text-xs hover:bg-sky-100 dark:hover:bg-sky-900/40 transition"
                        >
                          <i className="fa-solid fa-link"></i>
                          {new URL(url).hostname}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Route Planner (Mapbox) */}
        {activeTool === 'route_planner' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Start Location</label>
                  <input 
                    type="text"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-teal-500 transition"
                    placeholder="e.g., 123 Main St, New York"
                    value={startAddress}
                    onChange={(e) => setStartAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Destination</label>
                  <input 
                    type="text"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-teal-500 transition"
                    placeholder="e.g., JFK Airport"
                    value={endAddress}
                    onChange={(e) => setEndAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={handlePlanRoute}
                  disabled={isPlanning || !startAddress.trim() || !endAddress.trim() || !mapboxKey}
                  className="bg-teal-500 hover:bg-teal-400 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-teal-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPlanning ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Planning...</> : <><i className="fa-solid fa-route"></i> Plan Route</>}
                </button>
              </div>
              {!mapboxKey && (
                <p className="text-xs text-amber-500 mt-2">⚠️ Mapbox API key required</p>
              )}
            </div>

            {routeInfo && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in overflow-hidden">
                {mapImageUrl && (
                  <img src={mapImageUrl} alt="Route Map" className="w-full h-48 object-cover" />
                )}
                <div className="p-6">
                  <div className="flex items-center gap-6 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-teal-500">
                        {Math.round(routeInfo.distance / 1609.34)} mi
                      </div>
                      <div className="text-xs text-zinc-400 uppercase">Distance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-teal-500">
                        {Math.round(routeInfo.duration / 60)} min
                      </div>
                      <div className="text-xs text-zinc-400 uppercase">Duration</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <i className="fa-solid fa-location-dot text-green-500"></i>
                    <span>{startAddress}</span>
                    <i className="fa-solid fa-arrow-right text-zinc-300"></i>
                    <i className="fa-solid fa-flag-checkered text-red-500"></i>
                    <span>{endAddress}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Assistant (Multi-AI Fallback) */}
        {activeTool === 'ai_assistant' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="mb-4">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Your Question</label>
                <textarea 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm dark:text-white text-zinc-900 focus:outline-none focus:border-rose-500 transition min-h-[120px]"
                  placeholder="Ask anything. The best available AI will respond..."
                  value={assistantPrompt}
                  onChange={(e) => setAssistantPrompt(e.target.value)}
                />
              </div>
              
              <div className="flex flex-wrap gap-4 items-end justify-between">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Preferred AI</label>
                  <div className="flex gap-2">
                    {(['gemini', 'openai', 'claude'] as AIProvider[]).map((provider) => (
                      <button
                        key={provider}
                        onClick={() => setPreferredProvider(provider)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                          preferredProvider === provider 
                            ? 'bg-rose-500 text-white' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleAIAssist}
                  disabled={isAssisting || !assistantPrompt.trim()}
                  className="bg-rose-500 hover:bg-rose-400 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isAssisting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Thinking...</> : <><i className="fa-solid fa-robot"></i> Ask AI</>}
                </button>
              </div>
            </div>

            {assistantResult && (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-rose-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-robot"></i> AI Response
                  </h3>
                  {assistantProvider && (
                    <span className="px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                      via {assistantProvider}
                    </span>
                  )}
                </div>
                <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {assistantResult}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Tools;