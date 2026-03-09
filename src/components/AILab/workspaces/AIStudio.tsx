import React, { useState, useRef } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import { processWithModel } from '../../../services/geminiService';
import AILabProgress from '../shared/AILabProgress';
import AILabEmptyState from '../shared/AILabEmptyState';
import './AIStudio.css';

import { AlignCenter, AlignLeft, ArrowLeft, Bold, ChevronLeft, ChevronRight, Clapperboard, Code, Columns, Download, FileText, Heading, Italic, List, Loader2, Pen, Play, Presentation, Sparkles, Trash2, Wand2 } from 'lucide-react';

interface AIStudioProps {
  onBack: () => void;
  apiKey: string;
}

interface Slide {
  id: string;
  type: 'title' | 'content' | 'chart' | 'image' | 'quote' | 'comparison';
  title: string;
  content: string;
  layout: string;
  aiGenerated?: boolean;
}

const SLIDE_TEMPLATES = [
  { type: 'title', icon: 'fa-heading', label: 'Title Slide' },
  { type: 'content', icon: 'fa-align-left', label: 'Content' },
  { type: 'chart', icon: 'fa-chart-bar', label: 'Chart' },
  { type: 'image', icon: 'fa-image', label: 'Image' },
  { type: 'quote', icon: 'fa-quote-left', label: 'Quote' },
  { type: 'comparison', icon: 'fa-columns', label: 'Comparison' },
];

const PRESENTATION_THEMES = [
  { id: 'midnight', name: 'Midnight', colors: ['#0f172a', '#1e293b', '#8b5cf6'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0c4a6e', '#0284c7', '#38bdf8'] },
  { id: 'forest', name: 'Forest', colors: ['#14532d', '#166534', '#22c55e'] },
  { id: 'sunset', name: 'Sunset', colors: ['#7c2d12', '#c2410c', '#fb923c'] },
  { id: 'minimal', name: 'Minimal', colors: ['#ffffff', '#f4f4f5', '#18181b'] },
  { id: 'neon', name: 'Neon', colors: ['#18181b', '#ec4899', '#8b5cf6'] },
];

const AIStudio: React.FC<AIStudioProps> = ({ onBack, apiKey }) => {
  const { dataSources } = useWorkspace();
  const [projectName, setProjectName] = useState('Untitled Presentation');
  const [slides, setSlides] = useState<Slide[]>([
    { id: '1', type: 'title', title: 'AI-Powered Presentation', content: 'Created with Pulse AI Studio', layout: 'center' },
  ]);
  const [selectedSlide, setSelectedSlide] = useState('1');
  const [selectedTheme, setSelectedTheme] = useState('midnight');
  const [showThemes, setShowThemes] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const addSlide = (type: string) => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      type: type as Slide['type'],
      title: 'New Slide',
      content: 'Click to edit content',
      layout: 'default',
    };
    setSlides([...slides, newSlide]);
    setSelectedSlide(newSlide.id);
  };

  const updateSlide = (id: string, updates: Partial<Slide>) => {
    setSlides(slides.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSlide = (id: string) => {
    if (slides.length > 1) {
      setSlides(slides.filter(s => s.id !== id));
      if (selectedSlide === id) {
        setSelectedSlide(slides[0].id);
      }
    }
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    const ta = bodyTextareaRef.current;
    const slide = slides.find(s => s.id === selectedSlide);
    if (!ta || !slide) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const newText = ta.value.substring(0, start) + prefix + selected + suffix + ta.value.substring(end);
    updateSlide(slide.id, { content: newText });
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setGeneratingProgress(10);

    const prompt = `Generate a presentation about: "${aiPrompt}".
Return a JSON array of 5-8 slide objects. Each object must have these exact fields:
- type: one of "title", "content", "quote", "comparison"
- title: string (the slide heading)
- content: string (the slide body text, use \\n for line breaks, use • for bullet points)

Return ONLY a valid JSON array with no markdown code blocks, no explanation, just the raw JSON array starting with [ and ending with ].`;

    try {
      setGeneratingProgress(35);
      const result = await processWithModel(apiKey, prompt);
      if (!result) throw new Error('No response from AI');

      setGeneratingProgress(75);
      const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as Array<{ type: string; title: string; content: string }>;

      setGeneratingProgress(90);
      const newSlides: Slide[] = parsed.map((s, i) => ({
        id: `ai-${Date.now()}-${i}`,
        type: (s.type as Slide['type']) || 'content',
        title: s.title || 'Slide',
        content: s.content || '',
        layout: s.type === 'title' ? 'center' : 'default',
        aiGenerated: true,
      }));

      setSlides([...slides, ...newSlides]);
      setAiPrompt('');
      setGeneratingProgress(100);
    } catch (err) {
      // If JSON parse fails, try to extract slides from plain text response
      console.error('Slide generation error:', err);
      const fallback: Slide[] = [
        { id: `ai-${Date.now()}-1`, type: 'title', title: aiPrompt, content: 'AI-Generated Presentation', layout: 'center', aiGenerated: true },
        { id: `ai-${Date.now()}-2`, type: 'content', title: 'Key Points', content: `Content for: ${aiPrompt}`, layout: 'default', aiGenerated: true },
      ];
      setSlides([...slides, ...fallback]);
    } finally {
      setGenerating(false);
      setTimeout(() => setGeneratingProgress(0), 600);
    }
  };

  const exportPresentation = (format: 'html' | 'pdf' | 'pptx') => {
    console.log(`Exporting as ${format}...`);
    // Generate interactive HTML
    if (format === 'html') {
      const html = generateInteractiveHTML();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.html`;
      a.click();
    }
  };

  const generateInteractiveHTML = () => {
    const theme = PRESENTATION_THEMES.find(t => t.id === selectedTheme);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: ${theme?.colors[0]}; color: white; }
    .slide { min-height: 100vh; padding: 4rem; display: flex; flex-direction: column; justify-content: center; }
    .slide-title { font-size: 4rem; margin-bottom: 1rem; }
    .slide-content { font-size: 1.5rem; line-height: 1.8; }
    .nav { position: fixed; bottom: 2rem; right: 2rem; display: flex; gap: 1rem; }
    .nav button { padding: 1rem 2rem; background: ${theme?.colors[2]}; border: none; color: white; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  ${slides.map((slide, i) => `
  <div class="slide" id="slide-${i}">
    <h1 class="slide-title">${slide.title}</h1>
    <div class="slide-content">${slide.content.replace(/\n/g, '<br>')}</div>
  </div>
  `).join('')}
  <div class="nav">
    <button onclick="prev()">← Prev</button>
    <button onclick="next()">Next →</button>
  </div>
  <script>
    let current = 0;
    const slides = document.querySelectorAll('.slide');
    function show(i) { slides.forEach((s,idx) => s.style.display = idx === i ? 'flex' : 'none'); }
    function next() { current = Math.min(current + 1, slides.length - 1); show(current); }
    function prev() { current = Math.max(current - 1, 0); show(current); }
    show(0);
  </script>
</body>
</html>`;
  };

  const currentSlide = slides.find(s => s.id === selectedSlide);
  const currentTheme = PRESENTATION_THEMES.find(t => t.id === selectedTheme);

  return (
    <div className="ai-studio">
      {/* Header */}
      <div className="studio-header">
        <div className="studio-header-left">
          <button onClick={onBack} className="studio-back-btn">
            <ArrowLeft />
          </button>
          <div className="studio-branding">
            <Clapperboard />
            <span>AI Studio</span>
          </div>
          <input
            type="text"
            className="studio-project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>
        <div className="studio-header-center">
          <div className="studio-view-toggle">
            <button 
              className={view === 'edit' ? 'active' : ''} 
              onClick={() => setView('edit')}
            >
              <Pen /> Edit
            </button>
            <button 
              className={view === 'preview' ? 'active' : ''} 
              onClick={() => setView('preview')}
            >
              <Play /> Preview
            </button>
          </div>
        </div>
        <div className="studio-header-right">
          <button 
            className="studio-btn studio-btn-theme"
            onClick={() => setShowThemes(!showThemes)}
          >
            <div className="theme-preview">
              {currentTheme?.colors.map((c, i) => (
                <div key={i} style={{ background: c }}></div>
              ))}
            </div>
            Theme
          </button>
          <div className="export-dropdown">
            <button className="studio-btn studio-btn-primary">
              <Download />
              Export
            </button>
            <div className="export-menu">
              <button onClick={() => exportPresentation('html')}>
                <Code /> Interactive HTML
              </button>
              <button onClick={() => exportPresentation('pdf')}>
                <FileText /> PDF
              </button>
              <button onClick={() => exportPresentation('pptx')}>
                <Presentation /> PowerPoint
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="studio-body">
        {/* Slide Thumbnails */}
        <div className="studio-sidebar">
          <div className="sidebar-header">
            <span>Slides</span>
            <span className="slide-count">{slides.length}</span>
          </div>
          <div className="slide-thumbnails">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`slide-thumbnail ${selectedSlide === slide.id ? 'active' : ''}`}
                onClick={() => setSelectedSlide(slide.id)}
              >
                <div className="thumbnail-number">{index + 1}</div>
                <div className="thumbnail-preview" style={{ background: currentTheme?.colors[0] }}>
                  <div className="thumbnail-title">{slide.title}</div>
                  {slide.content && (
                    <div className="thumbnail-content-preview">{slide.content}</div>
                  )}
                </div>
                {slide.aiGenerated && (
                  <div className="thumbnail-badge">
                    <Sparkles />
                  </div>
                )}
                {slides.length > 1 && (
                  <button 
                    className="thumbnail-delete"
                    onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {/* Add Slide */}
          <div className="add-slide-section">
            <span className="add-slide-label">Add Slide</span>
            <div className="slide-templates">
              {SLIDE_TEMPLATES.map(template => (
                <button
                  key={template.type}
                  className="template-btn"
                  onClick={() => addSlide(template.type)}
                  title={template.label}
                >
                  <i className={`fa-solid ${template.icon}`}></i>
                </button>
              ))}
            </div>
          </div>

          {/* AI Generate */}
          <div className="ai-generate-section">
            <span className="ai-label">
              <Sparkles />
              AI Generate
            </span>
            <textarea
              placeholder="Describe your presentation topic..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <button
              className="ai-generate-btn"
              onClick={generateWithAI}
              disabled={generating || !aiPrompt.trim()}
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 />
                  Generate Slides
                </>
              )}
            </button>
            {generating && generatingProgress > 0 && (
              <AILabProgress
                percent={generatingProgress}
                label="Building slides..."
                accentColor="#f43f5e"
                accentRgb="244, 63, 94"
                size="sm"
              />
            )}
          </div>
        </div>

        {/* Main Editor */}
        <div className="studio-main">
          {view === 'edit' && currentSlide && (
            <div 
              className="slide-editor"
              style={{ background: currentTheme?.colors[0] }}
            >
              <div className="slide-content-editor">
                <input
                  type="text"
                  className="slide-title-input"
                  value={currentSlide.title}
                  onChange={(e) => updateSlide(currentSlide.id, { title: e.target.value })}
                  placeholder="Slide Title"
                />
                <div className="studio-formatting-bar">
                  <button type="button" className="fmt-btn" onClick={() => insertFormat('**', '**')} title="Bold">
                    <Bold />
                  </button>
                  <button type="button" className="fmt-btn" onClick={() => insertFormat('*', '*')} title="Italic">
                    <Italic />
                  </button>
                  <button type="button" className="fmt-btn" onClick={() => insertFormat('• ')} title="Bullet point">
                    <List />
                  </button>
                  <button type="button" className="fmt-btn" onClick={() => insertFormat('# ')} title="Heading">
                    <Heading />
                  </button>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  className="slide-body-input"
                  value={currentSlide.content}
                  onChange={(e) => updateSlide(currentSlide.id, { content: e.target.value })}
                  placeholder="Slide content..."
                />
              </div>
            </div>
          )}

          {view === 'preview' && (
            <div className="slide-preview" style={{ background: currentTheme?.colors[0] }}>
              {currentSlide && (
                <>
                  <h1 className="preview-title">{currentSlide.title}</h1>
                  <div className="preview-content">
                    {currentSlide.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </>
              )}
              <div className="preview-nav">
                <button 
                  disabled={slides.findIndex(s => s.id === selectedSlide) === 0}
                  onClick={() => {
                    const idx = slides.findIndex(s => s.id === selectedSlide);
                    if (idx > 0) setSelectedSlide(slides[idx - 1].id);
                  }}
                >
                  <ChevronLeft />
                </button>
                <span>{slides.findIndex(s => s.id === selectedSlide) + 1} / {slides.length}</span>
                <button
                  disabled={slides.findIndex(s => s.id === selectedSlide) === slides.length - 1}
                  onClick={() => {
                    const idx = slides.findIndex(s => s.id === selectedSlide);
                    if (idx < slides.length - 1) setSelectedSlide(slides[idx + 1].id);
                  }}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Properties Panel */}
        <div className="studio-properties">
          <h4>Slide Properties</h4>
          {currentSlide && (
            <>
              <div className="property-group">
                <label>Type</label>
                <select 
                  value={currentSlide.type}
                  onChange={(e) => updateSlide(currentSlide.id, { type: e.target.value as Slide['type'] })}
                >
                  {SLIDE_TEMPLATES.map(t => (
                    <option key={t.type} value={t.type}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="property-group">
                <label>Layout</label>
                <div className="layout-options">
                  <button className={currentSlide.layout === 'center' ? 'active' : ''} onClick={() => updateSlide(currentSlide.id, { layout: 'center' })}>
                    <AlignCenter />
                  </button>
                  <button className={currentSlide.layout === 'left' ? 'active' : ''} onClick={() => updateSlide(currentSlide.id, { layout: 'left' })}>
                    <AlignLeft />
                  </button>
                  <button className={currentSlide.layout === 'split' ? 'active' : ''} onClick={() => updateSlide(currentSlide.id, { layout: 'split' })}>
                    <Columns />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Theme Selection */}
          <h4 className="mt-4">Theme</h4>
          <div className="theme-grid">
            {PRESENTATION_THEMES.map(theme => (
              <button
                key={theme.id}
                className={`theme-option ${selectedTheme === theme.id ? 'active' : ''}`}
                onClick={() => setSelectedTheme(theme.id)}
              >
                <div className="theme-colors">
                  {theme.colors.map((c, i) => (
                    <div key={i} style={{ background: c }}></div>
                  ))}
                </div>
                <span>{theme.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIStudio;
