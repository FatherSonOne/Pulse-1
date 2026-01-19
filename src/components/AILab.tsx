// src/components/AILab.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { transcribeMedia, summarizeText, analyzeImage, processWithModel } from '../services/geminiService';
import { blobToBase64 } from '../services/audioService';
import { aiLabService } from '../services/aiLabService';
import { MarkdownRenderer } from './shared';
import './shared/PulseTypography.css';
import toast from 'react-hot-toast';

interface AILabProps {
  apiKey: string;
}

interface AgentCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: 'content' | 'analysis' | 'creative' | 'utility';
}

// Enhanced Types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  agentId: string;
  createdAt: Date;
}

interface ProcessingHistory {
  id: string;
  input: string;
  output: string;
  agentId: string;
  timestamp: Date;
  starred?: boolean;
}

interface WorkflowStep {
  agentId: string;
  prompt?: string;
  useOutputFromPrevious?: boolean;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

type OutputFormat = 'plain' | 'markdown' | 'json' | 'bullet';
type ViewMode = 'agents' | 'chat' | 'history' | 'workflows' | 'templates';

const AI_AGENTS: AgentCard[] = [
  {
    id: 'transcribe',
    name: 'Transcriber',
    description: 'Convert audio/video to text with high accuracy',
    icon: 'fa-microphone-lines',
    color: 'from-purple-500 to-indigo-600',
    category: 'content'
  },
  {
    id: 'summarize',
    name: 'Summarizer',
    description: 'Condense long content into key points',
    icon: 'fa-compress',
    color: 'from-blue-500 to-cyan-600',
    category: 'content'
  },
  {
    id: 'analyze',
    name: 'Analyzer',
    description: 'Extract insights from images and documents',
    icon: 'fa-magnifying-glass-chart',
    color: 'from-emerald-500 to-teal-600',
    category: 'analysis'
  },
  {
    id: 'writer',
    name: 'Writer',
    description: 'Generate professional content and copy',
    icon: 'fa-pen-fancy',
    color: 'from-orange-500 to-red-600',
    category: 'creative'
  },
  {
    id: 'coder',
    name: 'Code Assistant',
    description: 'Help with code review and generation',
    icon: 'fa-code',
    color: 'from-zinc-600 to-zinc-800',
    category: 'utility'
  },
  {
    id: 'translator',
    name: 'Translator',
    description: 'Translate text between languages',
    icon: 'fa-language',
    color: 'from-pink-500 to-rose-600',
    category: 'utility'
  },
  {
    id: 'brainstorm',
    name: 'Brainstormer',
    description: 'Generate ideas and creative solutions',
    icon: 'fa-lightbulb',
    color: 'from-yellow-500 to-amber-600',
    category: 'creative'
  },
  {
    id: 'email',
    name: 'Email Composer',
    description: 'Draft professional emails quickly',
    icon: 'fa-envelope',
    color: 'from-red-500 to-pink-600',
    category: 'content'
  },
  {
    id: 'research',
    name: 'Researcher',
    description: 'Deep dive into topics with structured analysis',
    icon: 'fa-book-open-reader',
    color: 'from-teal-500 to-cyan-600',
    category: 'analysis'
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Proofread and improve text quality',
    icon: 'fa-spell-check',
    color: 'from-violet-500 to-purple-600',
    category: 'content'
  },
  {
    id: 'data',
    name: 'Data Analyzer',
    description: 'Analyze data patterns and generate insights',
    icon: 'fa-chart-pie',
    color: 'from-sky-500 to-blue-600',
    category: 'analysis'
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Structure meeting notes and extract action items',
    icon: 'fa-clipboard-list',
    color: 'from-lime-500 to-green-600',
    category: 'utility'
  }
];

// Mock workflows
const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf1',
    name: 'Content Pipeline',
    description: 'Brainstorm → Write → Edit',
    steps: [
      { agentId: 'brainstorm', prompt: 'Generate ideas for: ' },
      { agentId: 'writer', useOutputFromPrevious: true },
      { agentId: 'editor', useOutputFromPrevious: true }
    ]
  },
  {
    id: 'wf2',
    name: 'Research & Summarize',
    description: 'Research a topic and create summary',
    steps: [
      { agentId: 'research', prompt: 'Research: ' },
      { agentId: 'summarize', useOutputFromPrevious: true }
    ]
  },
  {
    id: 'wf3',
    name: 'Code Review Pipeline',
    description: 'Review code and suggest improvements',
    steps: [
      { agentId: 'coder', prompt: 'Review this code: ' },
      { agentId: 'editor', prompt: 'Format the code review as a professional report: ', useOutputFromPrevious: true }
    ]
  }
];

// Mock templates
const MOCK_TEMPLATES: PromptTemplate[] = [
  { id: 't1', name: 'Blog Post Outline', prompt: 'Create a detailed blog post outline about:', agentId: 'writer', createdAt: new Date() },
  { id: 't2', name: 'Meeting Summary', prompt: 'Summarize these meeting notes with action items:', agentId: 'meeting', createdAt: new Date() },
  { id: 't3', name: 'Code Documentation', prompt: 'Generate documentation for this code:', agentId: 'coder', createdAt: new Date() },
  { id: 't4', name: 'Professional Email', prompt: 'Write a professional email to decline a meeting politely:', agentId: 'email', createdAt: new Date() },
];

const AILab: React.FC<AILabProps> = ({ apiKey }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentCard | null>(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Enhanced state
  const [viewMode, setViewMode] = useState<ViewMode>('agents');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ProcessingHistory[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('plain');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<number>(0);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Get agent by ID
  const getAgentById = useCallback((id: string) => {
    return AI_AGENTS.find(a => a.id === id);
  }, []);

  // Format output based on selected format
  const formatOutput = useCallback((text: string): string => {
    switch (outputFormat) {
      case 'bullet':
        return text.split('\n').filter(l => l.trim()).map(l => `• ${l}`).join('\n');
      case 'json':
        try {
          return JSON.stringify({ content: text, timestamp: new Date().toISOString() }, null, 2);
        } catch {
          return text;
        }
      case 'markdown':
        return `## AI Output\n\n${text}\n\n---\n*Generated at ${new Date().toLocaleString()}*`;
      default:
        return text;
    }
  }, [outputFormat]);

  // Save to history
  const saveToHistory = useCallback((inputText: string, outputText: string, agentId: string) => {
    const historyItem: ProcessingHistory = {
      id: Date.now().toString(),
      input: inputText,
      output: outputText,
      agentId,
      timestamp: new Date(),
    };
    setHistory(prev => [historyItem, ...prev.slice(0, 49)]); // Keep last 50 items
  }, []);

  // Toggle star on history item
  const toggleStarHistory = useCallback((id: string) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, starred: !h.starred } : h));
  }, []);

  // Delete history item
  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
    toast.success('History item deleted');
  }, []);

  // Save as template
  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || !input.trim() || !selectedAgent) return;
    const saved = await aiLabService.createTemplate({
      name: templateName,
      prompt: input,
      agentId: selectedAgent.id,
    });
    if (saved) {
      setTemplates(prev => [saved, ...prev]);
      setShowSaveTemplate(false);
      setTemplateName('');
      toast.success('Template saved!');
    } else {
      toast.error('Failed to save template');
    }
  }, [templateName, input, selectedAgent]);

  // Load template
  const loadTemplate = useCallback((template: PromptTemplate) => {
    const agent = getAgentById(template.agentId);
    if (agent) {
      setSelectedAgent(agent);
      setInput(template.prompt);
      setViewMode('agents');
      toast.success(`Loaded template: ${template.name}`);
    }
  }, [getAgentById]);

  // Delete template
  const deleteTemplate = useCallback(async (id: string) => {
    const success = await aiLabService.deleteTemplate(id);
    if (success) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template deleted');
    } else {
      toast.error('Failed to delete template');
    }
  }, []);

  // Run workflow
  const runWorkflow = useCallback(async (workflow: Workflow, initialInput: string) => {
    if (!apiKey || isRunningWorkflow) return;
    setIsRunningWorkflow(true);
    setSelectedWorkflow(workflow);
    setWorkflowProgress(0);

    let currentInput = initialInput;
    let currentOutput = '';

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      setWorkflowProgress(((i + 0.5) / workflow.steps.length) * 100);

      const stepInput = step.useOutputFromPrevious && currentOutput
        ? currentOutput
        : (step.prompt || '') + currentInput;

      try {
        currentOutput = await processWithModel(
          apiKey,
          `You are ${getAgentById(step.agentId)?.name || 'an AI assistant'}. ${stepInput}`,
          'gemini-2.0-flash-exp'
        ) || '';

        setWorkflowProgress(((i + 1) / workflow.steps.length) * 100);
      } catch (error) {
        toast.error(`Workflow step ${i + 1} failed`);
        setIsRunningWorkflow(false);
        return;
      }
    }

    setOutput(formatOutput(currentOutput));
    saveToHistory(initialInput, currentOutput, workflow.steps[workflow.steps.length - 1].agentId);
    setIsRunningWorkflow(false);
    setSelectedWorkflow(null);
    toast.success('Workflow completed!');
  }, [apiKey, isRunningWorkflow, getAgentById, formatOutput, saveToHistory]);

  // Chat mode send message
  const sendChatMessage = useCallback(async () => {
    if (!input.trim() || !selectedAgent || !apiKey || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      agentId: selectedAgent.id,
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const context = chatMessages
        .slice(-10)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const response = await processWithModel(
        apiKey,
        `You are ${selectedAgent.name}. ${selectedAgent.description}.

Previous conversation:
${context}

User: ${userMessage.content}

Respond helpfully and naturally.`,
        'gemini-2.0-flash-exp'
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || 'I apologize, I could not generate a response.',
        timestamp: new Date(),
        agentId: selectedAgent.id,
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Failed to send message');
    }

    setIsProcessing(false);
  }, [input, selectedAgent, apiKey, isProcessing, chatMessages]);

  // Clear chat
  const clearChat = useCallback(() => {
    setChatMessages([]);
    toast.success('Chat cleared');
  }, []);

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (!searchHistory.trim()) return history;
    const query = searchHistory.toLowerCase();
    return history.filter(h =>
      h.input.toLowerCase().includes(query) ||
      h.output.toLowerCase().includes(query)
    );
  }, [history, searchHistory]);

  const handleAgentSelect = (agent: AgentCard) => {
    setSelectedAgent(agent);
    setInput('');
    setOutput('');
    setSelectedFile(null);
  };

  const handleProcess = async () => {
    if (!apiKey) {
      toast.error('Please configure your Gemini API key in Settings');
      return;
    }

    if (!selectedAgent) return;

    setIsProcessing(true);
    setOutput('');

    try {
      let result = '';

      switch (selectedAgent.id) {
        case 'transcribe':
          if (selectedFile) {
            const base64 = await blobToBase64(selectedFile);
            result = await transcribeMedia(apiKey, base64, selectedFile.type) || 'Transcription failed';
          } else {
            toast.error('Please upload an audio or video file');
            setIsProcessing(false);
            return;
          }
          break;

        case 'summarize':
          if (!input.trim()) {
            toast.error('Please enter text to summarize');
            setIsProcessing(false);
            return;
          }
          result = await summarizeText(apiKey, input) || 'Summarization failed';
          break;

        case 'analyze':
          if (selectedFile) {
            const base64 = await blobToBase64(selectedFile);
            result = await analyzeImage(apiKey, base64, input || 'Analyze this image in detail') || 'Analysis failed';
          } else {
            toast.error('Please upload an image to analyze');
            setIsProcessing(false);
            return;
          }
          break;

        case 'writer':
          if (!input.trim()) {
            toast.error('Please describe what you want to write');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are a professional content writer. Write the following: ${input}`, 'gemini-2.0-flash-exp') || 'Writing failed';
          break;

        case 'coder':
          if (!input.trim()) {
            toast.error('Please describe your coding task');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are an expert programmer. Help with the following: ${input}. Provide clean, well-commented code.`, 'gemini-2.0-flash-exp') || 'Code generation failed';
          break;

        case 'translator':
          if (!input.trim()) {
            toast.error('Please enter text to translate');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `Translate the following text to English (if not English) or to the language specified. If no target language is specified, translate to English. Text: ${input}`, 'gemini-2.0-flash-exp') || 'Translation failed';
          break;

        case 'brainstorm':
          if (!input.trim()) {
            toast.error('Please describe your topic or challenge');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are a creative brainstorming assistant. Generate 5-10 innovative ideas for the following topic or challenge: ${input}. Format as a numbered list with brief explanations.`, 'gemini-2.0-flash-exp') || 'Brainstorming failed';
          break;

        case 'email':
          if (!input.trim()) {
            toast.error('Please describe the email you want to write');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are a professional email writer. Write a professional email based on the following request: ${input}. Include subject line, greeting, body, and sign-off.`, 'gemini-2.0-flash-exp') || 'Email generation failed';
          break;

        case 'research':
          if (!input.trim()) {
            toast.error('Please enter a topic to research');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are an expert researcher. Provide a comprehensive, structured analysis of the following topic: ${input}. Include key findings, relevant data points, and conclusions. Format with clear sections.`, 'gemini-2.0-flash-exp') || 'Research failed';
          break;

        case 'editor':
          if (!input.trim()) {
            toast.error('Please enter text to edit');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are a professional editor. Review and improve the following text for clarity, grammar, style, and flow. Provide the improved version followed by a brief summary of changes: ${input}`, 'gemini-2.0-flash-exp') || 'Editing failed';
          break;

        case 'data':
          if (!input.trim()) {
            toast.error('Please enter data to analyze');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are a data analyst. Analyze the following data and provide insights, patterns, and actionable recommendations: ${input}`, 'gemini-2.0-flash-exp') || 'Data analysis failed';
          break;

        case 'meeting':
          if (!input.trim()) {
            toast.error('Please enter meeting notes');
            setIsProcessing(false);
            return;
          }
          result = await processWithModel(apiKey, `You are a meeting notes assistant. Structure the following meeting notes with: Summary, Key Decisions, Action Items (with owners if mentioned), and Follow-ups: ${input}`, 'gemini-2.0-flash-exp') || 'Meeting notes processing failed';
          break;

        default:
          result = 'Unknown agent';
      }

      const formattedResult = formatOutput(result);
      setOutput(formattedResult);
      saveToHistory(input, result, selectedAgent.id);
      toast.success('Processing complete!');
    } catch (error) {
      console.error('AI processing error:', error);
      toast.error('Processing failed. Please try again.');
      setOutput('Error: Processing failed. Please check your API key and try again.');
    }

    setIsProcessing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.success(`File selected: ${file.name}`);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    toast.success('Copied to clipboard!');
  };

  const filteredAgents = filterCategory === 'all'
    ? AI_AGENTS
    : AI_AGENTS.filter(a => a.category === filterCategory);

  if (!apiKey) {
    return (
      <div className="h-full bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-6">
          <i className="fa-solid fa-flask text-3xl text-white"></i>
        </div>
        <h2 className="text-xl font-bold dark:text-white text-zinc-900 mb-2">AI Lab</h2>
        <p className="text-zinc-500 text-center mb-6 max-w-md">
          Configure your Gemini API key in Settings to access AI-powered tools and agents.
        </p>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:opacity-90 transition flex items-center gap-2"
        >
          <i className="fa-solid fa-key"></i> Get API Key
        </a>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col animate-fadeIn shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <i className="fa-solid fa-flask text-white"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Lab</h2>
              <p className="text-purple-100 text-xs">Powered by Gemini</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedAgent && (
              <button
                onClick={() => { setSelectedAgent(null); setViewMode('agents'); }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition"
              >
                <i className="fa-solid fa-grid-2 mr-2"></i>
                All Agents
              </button>
            )}
            {selectedAgent && viewMode === 'agents' && (
              <button
                onClick={() => setViewMode('chat')}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition"
              >
                <i className="fa-solid fa-comments mr-2"></i>
                Chat Mode
              </button>
            )}
          </div>
        </div>

        {/* View Mode Navigation */}
        <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
          {[
            { id: 'agents', icon: 'fa-robot', label: 'Agents' },
            { id: 'chat', icon: 'fa-comments', label: 'Chat' },
            { id: 'history', icon: 'fa-clock-rotate-left', label: 'History' },
            { id: 'workflows', icon: 'fa-diagram-project', label: 'Workflows' },
            { id: 'templates', icon: 'fa-bookmark', label: 'Templates' },
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as ViewMode)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                viewMode === mode.id
                  ? 'bg-white text-purple-700'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className={`fa-solid ${mode.icon}`}></i>
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Workflow Progress Bar */}
      {isRunningWorkflow && selectedWorkflow && (
        <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Running: {selectedWorkflow.name}
            </span>
            <span className="text-xs text-purple-600">{Math.round(workflowProgress)}%</span>
          </div>
          <div className="h-1.5 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 rounded-full transition-all duration-300"
              style={{ width: `${workflowProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* View: Agents */}
      {viewMode === 'agents' && !selectedAgent && (
        <>
          {/* Category Filter */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['all', 'content', 'analysis', 'creative', 'utility'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition whitespace-nowrap ${
                    filterCategory === cat
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat === 'all' ? 'All Agents' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Agent Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAgents.map((agent, index) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 text-left hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg transition-all group animate-slideInUp"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <i className={`fa-solid ${agent.icon} text-white text-lg`}></i>
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-white mb-1">{agent.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{agent.description}</p>
                  <span className="inline-block mt-3 text-[10px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                    {agent.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* View: Agent Workspace (when agent selected in agents view) */}
      {viewMode === 'agents' && selectedAgent && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Agent Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedAgent.color} flex items-center justify-center`}>
                <i className={`fa-solid ${selectedAgent.icon} text-white text-lg`}></i>
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">{selectedAgent.name}</h3>
                <p className="text-sm text-zinc-500">{selectedAgent.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg text-xs font-medium"
              >
                <option value="plain">Plain Text</option>
                <option value="markdown">Markdown</option>
                <option value="bullet">Bullet Points</option>
                <option value="json">JSON</option>
              </select>
              {input.trim() && (
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <i className="fa-solid fa-bookmark mr-1"></i> Save Template
                </button>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
            {(selectedAgent.id === 'transcribe' || selectedAgent.id === 'analyze') && (
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                  Upload {selectedAgent.id === 'transcribe' ? 'Audio/Video' : 'Image'}
                </label>
                <input
                  type="file"
                  accept={selectedAgent.id === 'transcribe' ? 'audio/*,video/*' : 'image/*'}
                  onChange={handleFileChange}
                  className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-purple-50 dark:file:bg-purple-900/30 file:text-purple-700 dark:file:text-purple-300 hover:file:bg-purple-100 dark:hover:file:bg-purple-900/50 cursor-pointer"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-zinc-500">
                    <i className="fa-solid fa-check-circle text-green-500 mr-1"></i>
                    {selectedFile.name}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                {selectedAgent.id === 'analyze' ? 'Custom Prompt (optional)' : 'Input'}
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedAgent.id === 'summarize' ? 'Paste text to summarize...' :
                  selectedAgent.id === 'writer' ? 'Describe what you want to write...' :
                  selectedAgent.id === 'coder' ? 'Describe your coding task or paste code for review...' :
                  selectedAgent.id === 'translator' ? 'Enter text to translate...' :
                  selectedAgent.id === 'brainstorm' ? 'Describe your topic or challenge...' :
                  selectedAgent.id === 'email' ? 'Describe the email you want to compose...' :
                  selectedAgent.id === 'analyze' ? 'What would you like to know about this image?' :
                  selectedAgent.id === 'research' ? 'Enter topic to research...' :
                  selectedAgent.id === 'editor' ? 'Paste text to proofread and improve...' :
                  selectedAgent.id === 'data' ? 'Paste data to analyze...' :
                  selectedAgent.id === 'meeting' ? 'Paste meeting notes to structure...' :
                  'Enter your input...'
                }
                className="w-full h-32 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm dark:text-white focus:border-purple-500 outline-none resize-none"
              />
            </div>

            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-400 disabled:to-zinc-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  Process with AI
                </>
              )}
            </button>
          </div>

          {/* Output Area - Archives-style formatting */}
          <div className="flex-1 overflow-y-auto p-4">
            {output ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-purple-500 rounded-full"></div>
                    <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">AI Response</h4>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-mono"
                  >
                    <i className="fa-regular fa-copy mr-1"></i> Copy
                  </button>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-transparent"></div>
                  <MarkdownRenderer content={output} className="text-zinc-700 dark:text-zinc-300" />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div className="text-zinc-400">
                  <i className="fa-solid fa-wand-magic-sparkles text-4xl mb-4 block opacity-50"></i>
                  <p className="font-light">Output will appear here after processing</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View: Chat Mode */}
      {viewMode === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Agent Selector for Chat */}
          {!selectedAgent ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <i className="fa-solid fa-robot text-4xl text-zinc-300 mb-4"></i>
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 mb-2">Select an Agent</h3>
                <p className="text-sm text-zinc-500 mb-4">Choose an agent to start chatting</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {AI_AGENTS.slice(0, 6).map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"
                    >
                      <i className={`fa-solid ${agent.icon} mr-1`}></i> {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selectedAgent.color} flex items-center justify-center`}>
                    <i className={`fa-solid ${selectedAgent.icon} text-white text-sm`}></i>
                  </div>
                  <span className="font-semibold dark:text-white">{selectedAgent.name}</span>
                </div>
                <button onClick={clearChat} className="text-xs text-zinc-500 hover:text-red-500">
                  <i className="fa-solid fa-trash mr-1"></i> Clear
                </button>
              </div>

              {/* Chat Messages - Archives-style formatting */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center text-zinc-400 py-8">
                    <p>Start a conversation with {selectedAgent.name}</p>
                  </div>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-md px-4 py-3'
                        : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-md px-5 py-4'
                    }`}>
                      {/* Label - Archives mono style */}
                      <div className="font-mono text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                        {msg.role === 'user' ? (
                          <span className="text-purple-200">You</span>
                        ) : (
                          <>
                            <span className="text-purple-600 dark:text-purple-400">{selectedAgent?.name || 'AI'}</span>
                            <span className="text-zinc-400">•</span>
                            <span className="text-zinc-500">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        )}
                      </div>
                      {/* Content - Markdown for AI, plain for user */}
                      {msg.role === 'assistant' ? (
                        <MarkdownRenderer content={msg.content} className="text-zinc-700 dark:text-zinc-200" />
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                      {msg.role === 'user' && (
                        <span className="text-[10px] opacity-60 mt-2 block">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest mb-2 text-purple-600 dark:text-purple-400 flex items-center gap-2">
                        <span>{selectedAgent?.name || 'AI'}</span>
                        <span className="animate-pulse">•••</span>
                      </div>
                      <i className="fa-solid fa-circle-notch fa-spin text-purple-500"></i>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder={`Message ${selectedAgent.name}...`}
                    className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm dark:text-white focus:border-purple-500 outline-none"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={isProcessing || !input.trim()}
                    className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-400 text-white rounded-xl font-semibold transition"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* View: History */}
      {viewMode === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Search history..."
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredHistory.length === 0 ? (
              <div className="text-center text-zinc-400 py-8">
                <i className="fa-solid fa-clock-rotate-left text-4xl mb-4 opacity-50"></i>
                <p>No history yet</p>
              </div>
            ) : (
              filteredHistory.map(item => {
                const agent = getAgentById(item.agentId);
                return (
                  <div key={item.id} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {agent && (
                          <div className={`w-6 h-6 rounded bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                            <i className={`fa-solid ${agent.icon} text-white text-xs`}></i>
                          </div>
                        )}
                        <span className="text-sm font-semibold dark:text-white">{agent?.name}</span>
                        <span className="text-xs text-zinc-400">{item.timestamp.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleStarHistory(item.id)} className={item.starred ? 'text-yellow-500' : 'text-zinc-400 hover:text-yellow-500'}>
                          <i className={`fa-${item.starred ? 'solid' : 'regular'} fa-star`}></i>
                        </button>
                        <button onClick={() => deleteHistoryItem(item.id)} className="text-zinc-400 hover:text-red-500">
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-1 mb-1"><strong>Input:</strong> {item.input}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2"><strong>Output:</strong> {item.output}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* View: Workflows */}
      {viewMode === 'workflows' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map(workflow => (
              <div key={workflow.id} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <i className="fa-solid fa-diagram-project text-purple-600"></i>
                  </div>
                  <div>
                    <h3 className="font-bold dark:text-white">{workflow.name}</h3>
                    <p className="text-xs text-zinc-500">{workflow.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {workflow.steps.map((step, idx) => {
                    const agent = getAgentById(step.agentId);
                    return (
                      <React.Fragment key={idx}>
                        <div className={`w-6 h-6 rounded bg-gradient-to-br ${agent?.color || 'from-zinc-400 to-zinc-500'} flex items-center justify-center`}>
                          <i className={`fa-solid ${agent?.icon || 'fa-robot'} text-white text-xs`}></i>
                        </div>
                        {idx < workflow.steps.length - 1 && (
                          <i className="fa-solid fa-arrow-right text-xs text-zinc-400"></i>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    const initialInput = prompt('Enter input for workflow:');
                    if (initialInput) runWorkflow(workflow, initialInput);
                  }}
                  disabled={isRunningWorkflow}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  <i className="fa-solid fa-play mr-2"></i> Run Workflow
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View: Templates */}
      {viewMode === 'templates' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => {
              const agent = getAgentById(template.agentId);
              return (
                <div key={template.id} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {agent && (
                        <div className={`w-6 h-6 rounded bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                          <i className={`fa-solid ${agent.icon} text-white text-xs`}></i>
                        </div>
                      )}
                      <h3 className="font-semibold text-sm dark:text-white">{template.name}</h3>
                    </div>
                    <button onClick={() => deleteTemplate(template.id)} className="text-zinc-400 hover:text-red-500">
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{template.prompt}</p>
                  <button
                    onClick={() => loadTemplate(template)}
                    className="w-full py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold transition"
                  >
                    <i className="fa-solid fa-arrow-right mr-1"></i> Use Template
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSaveTemplate(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold dark:text-white mb-4">Save as Template</h3>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveTemplate(false)} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg font-semibold">
                Cancel
              </button>
              <button onClick={handleSaveTemplate} className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-semibold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AILab;
