import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import { processWithModel } from '../../../services/geminiService';
import ShareToChannelModal from '../shared/ShareToChannelModal';
import AILabProgress from '../shared/AILabProgress';
import AILabEmptyState from '../shared/AILabEmptyState';
import { useToast } from '../shared/AILabToast';
import './ProposalBuilder.css';

import { ArrowLeft, ArrowRight, Check, Circle, CloudCheck, Code, FileText, Loader2, Pen, Share2, Wand2 } from 'lucide-react';

interface ProposalBuilderProps {
  onBack: () => void;
  apiKey: string;
}

interface ProposalSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  aiSuggestions?: string[];
  status: 'empty' | 'draft' | 'complete';
}

interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  sections: string[];
}

const TEMPLATES: Template[] = [
  { id: 'sales', name: 'Sales Proposal', icon: 'fa-handshake', description: 'Close deals with compelling proposals', sections: ['intro', 'problem', 'solution', 'pricing', 'timeline', 'team'] },
  { id: 'project', name: 'Project Proposal', icon: 'fa-diagram-project', description: 'Pitch your project effectively', sections: ['overview', 'objectives', 'approach', 'deliverables', 'budget', 'timeline'] },
  { id: 'partnership', name: 'Partnership Proposal', icon: 'fa-people-arrows', description: 'Build strategic alliances', sections: ['intro', 'opportunity', 'benefits', 'structure', 'terms', 'next-steps'] },
  { id: 'grant', name: 'Grant Proposal', icon: 'fa-file-invoice-dollar', description: 'Secure funding for your initiative', sections: ['summary', 'need', 'approach', 'evaluation', 'budget', 'org-info'] },
  { id: 'rfp', name: 'RFP Response', icon: 'fa-file-signature', description: 'Win contracts and bids', sections: ['cover', 'understanding', 'approach', 'qualifications', 'pricing', 'appendix'] },
  { id: 'blank', name: 'Custom Proposal', icon: 'fa-plus', description: 'Start from scratch', sections: ['intro', 'body', 'conclusion'] },
];

const SECTION_DEFAULTS: Record<string, { title: string; icon: string }> = {
  intro: { title: 'Introduction', icon: 'fa-quote-left' },
  problem: { title: 'Problem Statement', icon: 'fa-triangle-exclamation' },
  solution: { title: 'Proposed Solution', icon: 'fa-lightbulb' },
  pricing: { title: 'Pricing', icon: 'fa-tag' },
  timeline: { title: 'Timeline', icon: 'fa-calendar' },
  team: { title: 'Our Team', icon: 'fa-users' },
  overview: { title: 'Project Overview', icon: 'fa-eye' },
  objectives: { title: 'Objectives', icon: 'fa-bullseye' },
  approach: { title: 'Approach', icon: 'fa-route' },
  deliverables: { title: 'Deliverables', icon: 'fa-box' },
  budget: { title: 'Budget', icon: 'fa-coins' },
  opportunity: { title: 'Opportunity', icon: 'fa-door-open' },
  benefits: { title: 'Mutual Benefits', icon: 'fa-scale-balanced' },
  structure: { title: 'Partnership Structure', icon: 'fa-sitemap' },
  terms: { title: 'Terms & Conditions', icon: 'fa-gavel' },
  'next-steps': { title: 'Next Steps', icon: 'fa-arrow-right' },
  summary: { title: 'Executive Summary', icon: 'fa-file-lines' },
  need: { title: 'Statement of Need', icon: 'fa-hand-holding-heart' },
  evaluation: { title: 'Evaluation Plan', icon: 'fa-chart-line' },
  'org-info': { title: 'Organization Info', icon: 'fa-building' },
  cover: { title: 'Cover Letter', icon: 'fa-envelope-open-text' },
  understanding: { title: 'Understanding of Needs', icon: 'fa-brain' },
  qualifications: { title: 'Qualifications', icon: 'fa-award' },
  appendix: { title: 'Appendix', icon: 'fa-paperclip' },
  body: { title: 'Main Content', icon: 'fa-align-left' },
  conclusion: { title: 'Conclusion', icon: 'fa-flag-checkered' },
};

const ProposalBuilder: React.FC<ProposalBuilderProps> = ({ onBack, apiKey }) => {
  const { teamChannels, currentUser } = useWorkspace();
  const { showToast, ToastComponent } = useToast();
  const [step, setStep] = useState<'template' | 'info' | 'build' | 'preview'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [proposalInfo, setProposalInfo] = useState({
    title: '',
    client: '',
    preparedBy: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave to localStorage with 1.5s debounce
  useEffect(() => {
    if (sections.length === 0) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      localStorage.setItem('pulse_proposal_draft', JSON.stringify({ proposalInfo, sections }));
      setLastSaved(new Date());
    }, 1500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [sections, proposalInfo]);

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setSections(template.sections.map(sectionId => ({
      id: sectionId,
      title: SECTION_DEFAULTS[sectionId]?.title || sectionId,
      icon: SECTION_DEFAULTS[sectionId]?.icon || 'fa-file',
      content: '',
      status: 'empty',
    })));
    setStep('info');
  };

  const generateWithAI = async (sectionId: string) => {
    setIsGenerating(true);
    const section = sections.find(s => s.id === sectionId);
    if (!section) { setIsGenerating(false); return; }

    const client = proposalInfo.client || '[Client Name]';
    const title = proposalInfo.title || 'this proposal';
    const preparedBy = proposalInfo.preparedBy || 'our team';
    const templateName = selectedTemplate?.name || 'Proposal';

    const sectionPrompts: Record<string, string> = {
      intro: `Write a compelling introduction section for a ${templateName} titled "${title}" prepared for ${client} by ${preparedBy}. Make it warm, professional, and client-focused. 2-3 paragraphs. No markdown headers.`,
      problem: `Write a Problem Statement section for a ${templateName} for ${client}. Identify 3-4 key business challenges this proposal addresses. Be specific and empathetic. Use bullet points.`,
      solution: `Write a Proposed Solution section for the ${templateName} titled "${title}" for ${client}. Describe the approach in 3 clear phases with specific deliverables per phase. Use headers and bullet points.`,
      pricing: `Write a Pricing/Investment section for a ${templateName} for ${client}. Use a professional markdown table with phases and placeholder dollar amounts (use $X,XXX format). Include payment terms and what's included.`,
      timeline: `Write a Project Timeline section for "${title}". Create a phased schedule with clear milestones and time estimates. Use a week-by-week format with emoji indicators.`,
      team: `Write an Our Team section for "${title}" by ${preparedBy}. Highlight key team roles and their relevant expertise. Make it credible and confidence-inspiring.`,
      overview: `Write a Project Overview section for a ${templateName} titled "${title}" for ${client}. Summarize what the project is, why it matters, and what success looks like.`,
      objectives: `Write an Objectives section for "${title}". List 4-6 SMART objectives. Use numbered list format with clear, measurable outcomes.`,
      approach: `Write an Approach section for "${title}" for ${client}. Describe the methodology, tools, and processes. Use headers for each approach phase.`,
      deliverables: `Write a Deliverables section for "${title}". List all tangible outputs organized by phase or category. Use a markdown table with columns: Deliverable, Description, Timeline.`,
      budget: `Write a Budget section for "${title}" for ${client}. Create a professional budget breakdown table. Use placeholder amounts ($X,XXX format). Include contingency.`,
      opportunity: `Write an Opportunity section for a Partnership Proposal for ${client}. Describe the market opportunity and why now is the right time. 2-3 paragraphs.`,
      benefits: `Write a Mutual Benefits section for a partnership with ${client}. List benefits for both parties side by side. Use a comparison format.`,
      structure: `Write a Partnership Structure section. Define roles, responsibilities, governance model, and decision-making process. Use clear headers and bullet points.`,
      terms: `Write a Terms & Conditions section for the partnership proposal. Cover duration, exclusivity, IP rights, confidentiality, and exit conditions. Keep it professional and clear.`,
      'next-steps': `Write a Next Steps section. Provide a clear call-to-action with 3-5 specific steps and a proposed timeline for moving forward.`,
      summary: `Write an Executive Summary for a ${templateName} titled "${title}". Summarize the need, proposed approach, expected impact, and budget at a high level. 1-2 paragraphs.`,
      need: `Write a Statement of Need section. Clearly articulate the problem or gap being addressed with supporting rationale. Use data-driven language.`,
      approach: `Write an Approach/Methodology section. Describe the program design, activities, and evidence-based practices being employed.`,
      evaluation: `Write an Evaluation Plan section. Describe how success will be measured, what metrics will be tracked, and how results will be reported.`,
      'org-info': `Write an Organization Information section for ${preparedBy}. Highlight mission, track record, leadership, and relevant qualifications.`,
      cover: `Write a professional Cover Letter for an RFP Response for ${client}. Express interest, summarize key qualifications, and request consideration.`,
      understanding: `Write an Understanding of Needs section for an RFP Response. Demonstrate deep understanding of ${client}'s requirements and challenges.`,
      qualifications: `Write a Qualifications section. Highlight relevant experience, past performance, certifications, and team expertise.`,
      appendix: `Write an Appendix outline listing what supporting documents would be included (case studies, references, certifications, sample work).`,
      body: `Write the Main Content section for "${title}". Provide the core arguments, evidence, and supporting details for the proposal's central thesis.`,
      conclusion: `Write a Conclusion section for "${title}". Summarize the key points, reinforce the value proposition, and end with a strong call-to-action.`,
    };

    try {
      const prompt = sectionPrompts[sectionId] || `Write the "${section.title}" section for a ${templateName} titled "${title}" for ${client}. Be professional and specific. 2-4 paragraphs.`;
      const result = await processWithModel(apiKey, prompt);
      setSections(prev => prev.map(s =>
        s.id === sectionId
          ? { ...s, content: result || `Content for ${s.title}`, status: 'draft' }
          : s
      ));
    } catch (err) {
      setSections(prev => prev.map(s =>
        s.id === sectionId
          ? { ...s, content: `Error generating content: ${err instanceof Error ? err.message : 'Check your API key in Settings.'}` }
          : s
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAllSections = async () => {
    const emptySections = sections.filter(s => s.status === 'empty');
    for (const section of emptySections) {
      await generateWithAI(section.id);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const updateSection = (sectionId: string, content: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId 
        ? { ...s, content, status: content.trim() ? 'draft' : 'empty' }
        : s
    ));
  };

  const markComplete = (sectionId: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, status: 'complete' } : s
    ));
  };

  const getProgress = () => {
    const complete = sections.filter(s => s.status === 'complete').length;
    return Math.round((complete / sections.length) * 100);
  };

  const getProposalShareContent = () => {
    const lines = [
      `**${proposalInfo.title || 'Proposal'}**`,
      `Prepared for: ${proposalInfo.client} | By: ${proposalInfo.preparedBy} | ${proposalInfo.date}`,
      '',
      ...sections.filter(s => s.content.trim()).map(s => `**${s.title}**\n${s.content}`),
    ];
    return lines.join('\n\n');
  };

  const exportProposal = (format: 'html' | 'pdf' | 'docx') => {
    if (format === 'pdf') {
      window.print();
      return;
    }
    if (format === 'html') {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${proposalInfo.title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.8; }
    h1 { color: #1a1a2e; border-bottom: 3px solid #8b5cf6; padding-bottom: 10px; }
    h2 { color: #2d2d44; margin-top: 40px; }
    .header { text-align: center; margin-bottom: 60px; }
    .meta { color: #666; font-size: 0.9rem; }
    .section { margin-bottom: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${proposalInfo.title || 'Proposal'}</h1>
    <div class="meta">
      <p>Prepared for: ${proposalInfo.client || '[Client]'}</p>
      <p>Prepared by: ${proposalInfo.preparedBy || '[Your Name]'}</p>
      <p>Date: ${proposalInfo.date}</p>
    </div>
  </div>
  ${sections.map(s => `
  <div class="section">
    <h2>${s.title}</h2>
    <div>${s.content.replace(/\n/g, '<br>')}</div>
  </div>
  `).join('')}
</body>
</html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proposalInfo.title || 'proposal'}.html`;
      a.click();
    }
  };

  return (
    <div className="proposal-builder">
      {/* Header */}
      <div className="pb-header">
        <div className="pb-header-left">
          <button onClick={onBack} className="pb-back-btn">
            <ArrowLeft />
          </button>
          <div className="pb-branding">
            <FileText />
            <span>Proposal Builder</span>
          </div>
        </div>
        
        {/* Steps Indicator */}
        <div className="pb-steps">
          <div className={`pb-step ${step === 'template' ? 'active' : ''} ${['info', 'build', 'preview'].includes(step) ? 'complete' : ''}`}>
            <span className="step-num">1</span>
            <span className="step-label">Template</span>
          </div>
          <div className="step-connector"></div>
          <div className={`pb-step ${step === 'info' ? 'active' : ''} ${['build', 'preview'].includes(step) ? 'complete' : ''}`}>
            <span className="step-num">2</span>
            <span className="step-label">Details</span>
          </div>
          <div className="step-connector"></div>
          <div className={`pb-step ${step === 'build' ? 'active' : ''} ${step === 'preview' ? 'complete' : ''}`}>
            <span className="step-num">3</span>
            <span className="step-label">Build</span>
          </div>
          <div className="step-connector"></div>
          <div className={`pb-step ${step === 'preview' ? 'active' : ''}`}>
            <span className="step-num">4</span>
            <span className="step-label">Export</span>
          </div>
        </div>

        <div className="pb-header-right">
          {lastSaved && step === 'build' && (
            <span className="pb-autosave">
              <CloudCheck />
              Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {step === 'preview' && (
            <div className="export-buttons">
              <button type="button" onClick={() => exportProposal('html')} className="pb-btn pb-btn-secondary">
                <Code /> HTML
              </button>
              <button type="button" onClick={() => exportProposal('pdf')} className="pb-btn pb-btn-secondary">
                <FileText /> PDF
              </button>
              {teamChannels.length > 0 && currentUser && (
                <button type="button" onClick={() => setShowShare(true)} className="pb-btn pb-btn-secondary">
                  <Share2 /> Share
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Template Selection */}
      {step === 'template' && (
        <div className="pb-template-step">
          <div className="step-intro">
            <h2>Choose a Template</h2>
            <p>Select the type of proposal you want to create</p>
          </div>
          <div className="template-grid">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                className="template-card"
                onClick={() => selectTemplate(template)}
              >
                <div className="template-icon">
                  <i className={`fa-solid ${template.icon}`}></i>
                </div>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <span className="template-sections">
                  {template.sections.length} sections
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Step */}
      {step === 'info' && (
        <div className="pb-info-step">
          <div className="step-intro">
            <h2>Proposal Details</h2>
            <p>Enter basic information about your proposal</p>
          </div>
          <div className="info-form">
            <div className="form-group">
              <label>Proposal Title</label>
              <input
                type="text"
                placeholder="e.g., Digital Transformation Proposal"
                value={proposalInfo.title}
                onChange={(e) => setProposalInfo({ ...proposalInfo, title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Client / Recipient</label>
              <input
                type="text"
                placeholder="e.g., Acme Corporation"
                value={proposalInfo.client}
                onChange={(e) => setProposalInfo({ ...proposalInfo, client: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Prepared By</label>
              <input
                type="text"
                placeholder="Your name or company"
                value={proposalInfo.preparedBy}
                onChange={(e) => setProposalInfo({ ...proposalInfo, preparedBy: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={proposalInfo.date}
                onChange={(e) => setProposalInfo({ ...proposalInfo, date: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button className="pb-btn pb-btn-secondary" onClick={() => setStep('template')}>
                Back
              </button>
              <button 
                className="pb-btn pb-btn-primary" 
                onClick={() => setStep('build')}
                disabled={!proposalInfo.title}
              >
                Continue to Build
                <ArrowRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build Step */}
      {step === 'build' && (
        <div className="pb-build-step">
          {/* Sidebar */}
          <div className="pb-build-sidebar">
            <div className="build-progress">
              <div className="progress-circle">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" className="progress-bg" />
                  <circle 
                    cx="50" cy="50" r="45" 
                    className="progress-fill"
                    style={{ strokeDashoffset: 283 - (283 * getProgress()) / 100 }}
                  />
                </svg>
                <span>{getProgress()}%</span>
              </div>
              <div className="progress-label">Complete</div>
            </div>
            
            <div className="section-list">
              {sections.map((section, i) => (
                <button
                  key={section.id}
                  className={`section-item ${activeSection === section.id ? 'active' : ''} section-${section.status}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="section-num">{i + 1}</span>
                  <span className="section-title">{section.title}</span>
                  <span className={`section-status status-${section.status}`}>
                    {section.status === 'complete' && <Check />}
                    {section.status === 'draft' && <Pen />}
                    {section.status === 'empty' && <Circle />}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="pb-btn pb-btn-secondary pb-btn-generate-all"
              onClick={generateAllSections}
              disabled={isGenerating || sections.every(s => s.status !== 'empty')}
            >
              <Wand2 />
              Generate All Sections
            </button>
            <button className="pb-btn pb-btn-primary" onClick={() => setStep('preview')}>
              Preview & Export
              <ArrowRight />
            </button>
          </div>

          {/* Editor */}
          <div className="pb-build-editor">
            {activeSection ? (
              <>
                <div className="editor-header">
                  <div className="editor-title">
                    <i className={`fa-solid ${sections.find(s => s.id === activeSection)?.icon}`}></i>
                    <h3>{sections.find(s => s.id === activeSection)?.title}</h3>
                  </div>
                  <div className="editor-actions">
                    <button 
                      className="ai-btn"
                      onClick={() => generateWithAI(activeSection)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <><Loader2 className="animate-spin" /> Generating...</>
                      ) : (
                        <><Wand2 /> Generate with AI</>
                      )}
                    </button>
                    <button 
                      className="complete-btn"
                      onClick={() => markComplete(activeSection)}
                    >
                      <Check />
                      Mark Complete
                    </button>
                  </div>
                </div>
                {isGenerating ? (
                  <AILabProgress
                    label={`Generating ${sections.find(s => s.id === activeSection)?.title}...`}
                    accentColor="#818cf8"
                    accentRgb="129, 140, 248"
                  />
                ) : (
                  <textarea
                    className="editor-content"
                    value={sections.find(s => s.id === activeSection)?.content || ''}
                    onChange={(e) => updateSection(activeSection, e.target.value)}
                    placeholder={`Write your ${sections.find(s => s.id === activeSection)?.title.toLowerCase()} here, or click "Generate with AI" to get started...`}
                  />
                )}
              </>
            ) : (
              <AILabEmptyState
                icon="fa-file-contract"
                title="Select a section"
                description="Choose a section from the left panel to start editing"
                accentColor="#818cf8"
                accentRgb="129, 140, 248"
              />
            )}
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="pb-preview-step">
          <div className="preview-nav">
            <button type="button" onClick={() => setStep('build')}>
              <ArrowLeft />
              Back to Edit
            </button>
          </div>
          <div className="preview-document">
            <div className="doc-header">
              <h1>{proposalInfo.title || 'Untitled Proposal'}</h1>
              <div className="doc-meta">
                <p><strong>Prepared for:</strong> {proposalInfo.client}</p>
                <p><strong>Prepared by:</strong> {proposalInfo.preparedBy}</p>
                <p><strong>Date:</strong> {proposalInfo.date}</p>
              </div>
            </div>
            {sections.map(section => (
              <div key={section.id} className="doc-section">
                <h2>
                  <i className={`fa-solid ${section.icon}`}></i>
                  {section.title}
                </h2>
                <div className="doc-content">
                  {section.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showShare && step === 'preview' && (
        <ShareToChannelModal
          title={proposalInfo.title || 'Proposal'}
          content={getProposalShareContent()}
          onClose={() => setShowShare(false)}
        />
      )}
      {ToastComponent}
    </div>
  );
};

export default ProposalBuilder;
