import React, { useState } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import { processWithModel } from '../../../services/geminiService';
import ShareToChannelModal from '../shared/ShareToChannelModal';
import AILabProgress from '../shared/AILabProgress';
import AILabEmptyState from '../shared/AILabEmptyState';
import { useToast } from '../shared/AILabToast';
import './StandupBriefing.css';

function getBlockerSeverity(text: string): 'none' | 'low' | 'high' {
  const lower = text.toLowerCase();
  if (/\bnone\b|no blocker|n\/a|nothing/.test(lower)) return 'none';
  if (/blocked|critical|urgent|can't proceed|blocking/.test(lower)) return 'high';
  return 'low';
}

function computeMetrics(briefings: MemberBriefing[]) {
  const blockerCount = briefings.filter(b => getBlockerSeverity(b.blockers) !== 'none').length;
  const healthPct = briefings.length > 0
    ? Math.round(((briefings.length - briefings.filter(b => getBlockerSeverity(b.blockers) === 'high').length) / briefings.length) * 100)
    : 100;
  return { total: briefings.length, blockerCount, healthPct };
}

interface StandupBriefingProps {
  onBack: () => void;
  apiKey: string;
}

interface MemberBriefing {
  memberId: string;
  memberName: string;
  avatar?: string;
  yesterday: string;
  today: string;
  blockers: string;
}

const StandupBriefing: React.FC<StandupBriefingProps> = ({ onBack, apiKey }) => {
  const { teams, teamChannels, currentUser } = useWorkspace();
  const { showToast, ToastComponent } = useToast();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [memberBriefings, setMemberBriefings] = useState<MemberBriefing[]>([]);
  const [teamSummary, setTeamSummary] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [generatedDate, setGeneratedDate] = useState('');

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const generateStandup = async () => {
    if (!selectedTeam || !apiKey) return;
    setIsGenerating(true);
    setMemberBriefings([]);
    setTeamSummary('');

    try {
      const members = selectedTeam.members || [];
      const memberNames = members.map(m =>
        m.profile?.full_name || m.profile?.display_name || m.contact?.name || 'Team Member'
      );

      const prompt = `You are generating a daily standup briefing for a team called "${selectedTeam.name}".
Team members: ${memberNames.join(', ')}
Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Generate a realistic standup briefing for each team member based on typical software team work.
Return a valid JSON object with this exact structure:
{
  "members": [
    {
      "name": "Member Name",
      "yesterday": "What they worked on yesterday (1-2 sentences)",
      "today": "What they plan to work on today (1-2 sentences)",
      "blockers": "Any blockers, or 'None' if none"
    }
  ],
  "teamSummary": "2-3 sentence overall team health and focus summary for today"
}

Return ONLY the JSON object, no markdown, no explanation.`;

      const result = await processWithModel(apiKey, prompt);
      if (!result) throw new Error('No response');

      const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const briefings: MemberBriefing[] = (parsed.members || []).map((m: any, i: number) => ({
        memberId: members[i]?.id || `member-${i}`,
        memberName: m.name || memberNames[i] || 'Team Member',
        yesterday: m.yesterday || 'No update.',
        today: m.today || 'No update.',
        blockers: m.blockers || 'None',
      }));

      setMemberBriefings(briefings);
      setTeamSummary(parsed.teamSummary || '');
      setGeneratedDate(new Date().toLocaleString());
    } catch (err) {
      console.error('Standup generation error:', err);
      setTeamSummary('Failed to generate standup. Please check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getShareContent = () => {
    if (!selectedTeam || memberBriefings.length === 0) return '';
    const lines = [
      `**Team Standup — ${selectedTeam.name}** | ${generatedDate}`,
      '',
      ...memberBriefings.map(m => [
        `**${m.memberName}**`,
        `✅ Yesterday: ${m.yesterday}`,
        `🎯 Today: ${m.today}`,
        `🚧 Blockers: ${m.blockers}`,
      ].join('\n')),
      '',
      `**Team Summary:** ${teamSummary}`,
    ];
    return lines.join('\n\n');
  };

  return (
    <div className="standup-briefing">
      {/* Header */}
      <div className="sb-header">
        <div className="sb-header-left">
          <button type="button" onClick={onBack} className="sb-back-btn" aria-label="Go back">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="sb-branding">
            <i className="fa-solid fa-people-group"></i>
            <span>Team Standup</span>
          </div>
          <span className="sb-subtitle">AI-Powered Daily Briefing</span>
        </div>
        {memberBriefings.length > 0 && (
          <div className="sb-header-right">
            <button
              type="button"
              className="sb-btn sb-btn-secondary"
              onClick={() => navigator.clipboard.writeText(getShareContent())}
            >
              <i className="fa-solid fa-copy"></i>
              Copy
            </button>
            {teamChannels.length > 0 && currentUser && (
              <button
                type="button"
                className="sb-btn sb-btn-primary"
                onClick={() => setShowShare(true)}
              >
                <i className="fa-solid fa-paper-plane"></i>
                Share to Channel
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sb-body">
        {/* Setup Panel */}
        <div className="sb-setup">
          <div className="sb-setup-inner">
            <div className="sb-setup-icon">
              <i className="fa-solid fa-people-group"></i>
            </div>
            <h2>Daily Standup Generator</h2>
            <p>Generate a per-member standup briefing based on your team's real activity, then share it directly to a Pulse channel.</p>

            <div className="sb-team-select">
              <label htmlFor="sb-team">Select Team</label>
              {teams.length === 0 ? (
                <p className="sb-empty">No teams found. Create a team in your Pulse workspace first.</p>
              ) : (
                <select
                  id="sb-team"
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                >
                  <option value="">— Choose a team —</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.members?.length || 0} members)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              className="sb-btn sb-btn-primary sb-btn-generate"
              onClick={generateStandup}
              disabled={!selectedTeamId || isGenerating || !apiKey}
            >
              <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
              {isGenerating ? 'Generating...' : 'Generate Standup'}
            </button>
            {isGenerating && (
              <AILabProgress
                label={`Generating standup for ${selectedTeam?.name}...`}
                accentColor="#34d399"
                accentRgb="52, 211, 153"
                size="sm"
              />
            )}

            {!apiKey && (
              <p className="sb-warning">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Gemini API key required. Add it in Settings.
              </p>
            )}
          </div>
        </div>

        {/* Results Panel */}
        {(memberBriefings.length > 0 || teamSummary) && (
          <div className="sb-results">
            <div className="sb-results-header">
              <div>
                <h3>
                  <i className="fa-solid fa-calendar-check"></i>
                  {selectedTeam?.name} Standup
                </h3>
                <span className="sb-date">{generatedDate}</span>
              </div>
            </div>

            {/* Metrics strip */}
            {memberBriefings.length > 0 && (() => {
              const m = computeMetrics(memberBriefings);
              return (
                <div className="sb-metrics-strip">
                  <div className="sb-metric-tile">
                    <span className="sb-metric-value">{m.total}</span>
                    <span className="sb-metric-label">Members</span>
                  </div>
                  <div className="sb-metric-tile">
                    <span className={`sb-metric-value ${m.blockerCount > 0 ? 'sb-metric-warn' : ''}`}>{m.blockerCount}</span>
                    <span className="sb-metric-label">Blockers</span>
                  </div>
                  <div className="sb-metric-tile">
                    <span className="sb-metric-value">{m.healthPct}%</span>
                    <span className="sb-metric-label">Team Health</span>
                  </div>
                </div>
              );
            })()}

            {teamSummary && (
              <div className="sb-team-summary">
                <i className="fa-solid fa-chart-line"></i>
                <p>{teamSummary}</p>
              </div>
            )}

            <div className="sb-member-cards">
              {memberBriefings.map(member => {
                const severity = getBlockerSeverity(member.blockers);
                const memberText = `**${member.memberName}**\n✅ Yesterday: ${member.yesterday}\n🎯 Today: ${member.today}\n🚧 Blockers: ${member.blockers}`;
                return (
                  <div key={member.memberId} className="sb-member-card">
                    <div className="sb-member-header">
                      <div className="sb-member-avatar">
                        {member.memberName.charAt(0).toUpperCase()}
                      </div>
                      <h4>{member.memberName}</h4>
                      <button
                        type="button"
                        className="sb-member-copy-btn"
                        title="Copy member standup"
                        onClick={() => {
                          navigator.clipboard.writeText(memberText);
                          showToast(`${member.memberName}'s standup copied`, 'success');
                        }}
                      >
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                    <div className="sb-member-items">
                      <div className="sb-item sb-item-yesterday">
                        <span className="sb-item-label">
                          <i className="fa-solid fa-check-circle"></i>
                          Yesterday
                        </span>
                        <p>{member.yesterday}</p>
                      </div>
                      <div className="sb-item sb-item-today">
                        <span className="sb-item-label">
                          <i className="fa-solid fa-bullseye"></i>
                          Today
                        </span>
                        <p>{member.today}</p>
                      </div>
                      <div className={`sb-item sb-item-blockers sb-blocker-${severity}`}>
                        <span className="sb-item-label">
                          <i className={`fa-solid ${severity === 'none' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
                          Blockers
                        </span>
                        <p>{member.blockers}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showShare && (
        <ShareToChannelModal
          title={`Team Standup — ${selectedTeam?.name}`}
          content={getShareContent()}
          onClose={() => setShowShare(false)}
        />
      )}
      {ToastComponent}
    </div>
  );
};

export default StandupBriefing;
