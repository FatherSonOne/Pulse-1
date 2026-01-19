import React, { useState } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import './ProposalBuilder.css';

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
  const [step, setStep] = useState<'template' | 'info' | 'build' | 'preview'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [proposalInfo, setProposalInfo] = useState({
    title: '',
    client: '',
    preparedBy: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
    
    // Simulate AI generation
    await new Promise(r => setTimeout(r, 2000));
    
    const aiContent: Record<string, string> = {
      intro: `Dear ${proposalInfo.client || '[Client Name]'},\n\nThank you for the opportunity to present this proposal. We are excited about the possibility of working together to achieve your goals.\n\nThis document outlines our understanding of your needs and presents a comprehensive solution designed to deliver exceptional results.`,
      problem: `Based on our analysis, we have identified the following key challenges:\n\n• Challenge 1: Current processes may be inefficient\n• Challenge 2: Opportunities for growth remain untapped\n• Challenge 3: Need for innovative solutions to stay competitive\n\nAddressing these challenges will be crucial for achieving your objectives.`,
      solution: `We propose a comprehensive solution that addresses your specific needs:\n\n**Phase 1: Discovery & Planning**\nIn-depth analysis and strategy development\n\n**Phase 2: Implementation**\nExecuting the plan with precision and expertise\n\n**Phase 3: Optimization**\nContinuous improvement and refinement`,
      pricing: `**Investment Overview**\n\n| Component | Investment |\n|-----------|------------|\n| Phase 1 | $X,XXX |\n| Phase 2 | $XX,XXX |\n| Phase 3 | $X,XXX |\n| **Total** | **$XX,XXX** |\n\n*Payment terms: 50% upfront, 50% upon completion*`,
      timeline: `**Project Timeline**\n\n📅 Week 1-2: Kickoff & Discovery\n📅 Week 3-6: Development & Implementation\n📅 Week 7-8: Testing & Refinement\n📅 Week 9: Launch & Training\n📅 Ongoing: Support & Optimization`,
    };
    
    setSections(prev => prev.map(s => 
      s.id === sectionId 
        ? { ...s, content: aiContent[sectionId] || `AI-generated content for ${s.title}. This section provides detailed information about ${s.title.toLowerCase()} tailored to your specific needs.`, status: 'draft' }
        : s
    ));
    
    setIsGenerating(false);
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

  const exportProposal = (format: 'html' | 'pdf' | 'docx') => {
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
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="pb-branding">
            <i className="fa-solid fa-file-contract"></i>
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
          {step === 'preview' && (
            <div className="export-buttons">
              <button onClick={() => exportProposal('html')} className="pb-btn pb-btn-secondary">
                <i className="fa-solid fa-code"></i> HTML
              </button>
              <button onClick={() => exportProposal('pdf')} className="pb-btn pb-btn-secondary">
                <i className="fa-solid fa-file-pdf"></i> PDF
              </button>
              <button onClick={() => exportProposal('docx')} className="pb-btn pb-btn-primary">
                <i className="fa-solid fa-file-word"></i> Word
              </button>
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
                <i className="fa-solid fa-arrow-right"></i>
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
                    {section.status === 'complete' && <i className="fa-solid fa-check"></i>}
                    {section.status === 'draft' && <i className="fa-solid fa-pen"></i>}
                    {section.status === 'empty' && <i className="fa-solid fa-circle"></i>}
                  </span>
                </button>
              ))}
            </div>

            <button className="pb-btn pb-btn-primary" onClick={() => setStep('preview')}>
              Preview & Export
              <i className="fa-solid fa-arrow-right"></i>
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
                        <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
                      ) : (
                        <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate with AI</>
                      )}
                    </button>
                    <button 
                      className="complete-btn"
                      onClick={() => markComplete(activeSection)}
                    >
                      <i className="fa-solid fa-check"></i>
                      Mark Complete
                    </button>
                  </div>
                </div>
                <textarea
                  className="editor-content"
                  value={sections.find(s => s.id === activeSection)?.content || ''}
                  onChange={(e) => updateSection(activeSection, e.target.value)}
                  placeholder={`Write your ${sections.find(s => s.id === activeSection)?.title.toLowerCase()} here, or click "Generate with AI" to get started...`}
                />
              </>
            ) : (
              <div className="editor-empty">
                <i className="fa-solid fa-arrow-left"></i>
                <p>Select a section to start editing</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="pb-preview-step">
          <div className="preview-nav">
            <button onClick={() => setStep('build')}>
              <i className="fa-solid fa-arrow-left"></i>
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
    </div>
  );
};

export default ProposalBuilder;
