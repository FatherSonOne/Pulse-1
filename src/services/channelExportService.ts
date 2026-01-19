import { ChannelArtifact, ChannelSpec, UnifiedMessage } from '../types';

/**
 * Channel Export Service
 * Converts channels into living specs (Google Docs, Markdown, HTML)
 */

export class ChannelExportService {
  private artifacts: Map<string, ChannelArtifact> = new Map();

  /**
   * Export channel to Google Docs
   * Creates a living document that auto-updates
   */
  async exportToGoogleDocs(
    channelId: string,
    channelName: string,
    messages: UnifiedMessage[],
    spec: ChannelSpec
  ): Promise<ChannelArtifact> {
    try {
      // TODO: Integrate with Google Docs API
      // 1. Create new Google Doc
      // 2. Set up structure
      // 3. Add content from spec
      // 4. Set up webhook for auto-updates

      const artifact: ChannelArtifact = {
        id: `artifact-${Date.now()}`,
        channelId,
        channelName,
        title: `${channelName} - Project Spec`,
        overview: `Project specification for ${channelName}`,
        spec: '', // Markdown content to be generated
        decisions: [],
        milestones: [],
        exportFormat: 'google_docs',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        googleDocId: 'placeholder-doc-id', // From Google Docs API
        externalLink: 'https://docs.google.com/document/d/...',
      };

      this.artifacts.set(artifact.id, artifact);
      return artifact;
    } catch (error) {
      throw new Error(
        `Google Docs export failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Export channel to Markdown
   * Creates standalone markdown file
   */
  exportToMarkdown(
    channelName: string,
    spec: ChannelSpec
  ): string {
    let markdown = `# ${spec.title}\n\n`;
    markdown += `**Last Updated:** ${new Date().toISOString()}\n\n`;

    // Overview
    markdown += `## Overview\n${spec.overview}\n\n`;

    // Participants
    if (spec.participants.length > 0) {
      markdown += `## Team\n`;
      for (const p of spec.participants) {
        markdown += `- **${p.name}** (${p.role}) - ${p.email}\n`;
      }
      markdown += '\n';
    }

    // Decisions
    if (spec.decisions.length > 0) {
      markdown += `## Key Decisions\n`;
      for (const d of spec.decisions) {
        markdown += `### ${d.title}\n`;
        markdown += `**Decided by:** ${d.decidedBy} on ${d.decidedAt.toDateString()}\n\n`;
        markdown += `${d.description}\n\n`;
      }
    }

    // Milestones
    if (spec.milestones.length > 0) {
      markdown += `## Milestones\n`;
      for (const m of spec.milestones) {
        const progress = `[${m.completionStatus}%]`;
        markdown += `- **${m.title}** ${progress} (Target: ${m.targetDate.toDateString()})\n`;
        markdown += `  ${m.description}\n\n`;
      }
    }

    // Tasks
    if (spec.tasks.length > 0) {
      markdown += `## Tasks\n`;
      for (const t of spec.tasks) {
        const status = `[${t.status.toUpperCase()}]`;
        markdown += `- ${status} **${t.title}** (${t.priority.toUpperCase()}) \n`;
        markdown += `  Assigned to: ${t.assignee} | Due: ${t.dueDate.toDateString()}\n`;
        markdown += `  ${t.description}\n\n`;
      }
    }

    // Timeline
    if (spec.timeline.length > 0) {
      markdown += `## Timeline\n`;
      for (const entry of spec.timeline) {
        markdown += `- **${entry.date.toDateString()}**: ${entry.event} (${entry.type})\n`;
      }
      markdown += '\n';
    }

    // Resources
    if (spec.resources.length > 0) {
      markdown += `## Resources\n`;
      for (const r of spec.resources) {
        markdown += `- [${r.title}](${r.url}) - ${r.type.toUpperCase()}\n`;
      }
    }

    return markdown;
  }

  /**
   * Export channel to HTML
   */
  exportToHtml(channelName: string, spec: ChannelSpec): string {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${spec.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
        h1 { color: #1a1a1a; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        .decision { background: #e7f3ff; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0; }
        .task { background: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 10px 0; }
        .milestone { background: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 10px 0; }
        .participant { display: inline-block; margin: 5px 10px 5px 0; padding: 8px 12px; background: #f5f5f5; border-radius: 4px; }
        .updated { color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <h1>${spec.title}</h1>
      <p class="updated">Last Updated: ${new Date().toISOString()}</p>

      <h2>Overview</h2>
      <p>${spec.overview}</p>

      ${
        spec.participants.length > 0
          ? `<h2>Team</h2>${spec.participants
              .map(
                (p) =>
                  `<div class="participant"><strong>${p.name}</strong> (${p.role})</div>`
              )
              .join('')}`
          : ''
      }

      ${
        spec.decisions.length > 0
          ? `<h2>Key Decisions</h2>${spec.decisions
              .map(
                (d) =>
                  `<div class="decision"><h3>${d.title}</h3><p><strong>By:</strong> ${d.decidedBy} on ${d.decidedAt.toDateString()}</p><p>${d.description}</p></div>`
              )
              .join('')}`
          : ''
      }

      ${
        spec.milestones.length > 0
          ? `<h2>Milestones</h2>${spec.milestones
              .map(
                (m) =>
                  `<div class="milestone"><h3>${m.title} [${m.completionStatus}%]</h3><p>${m.description}</p></div>`
              )
              .join('')}`
          : ''
      }

      ${
        spec.tasks.length > 0
          ? `<h2>Tasks</h2>${spec.tasks
              .map(
                (t) =>
                  `<div class="task"><h3>${t.title}</h3><p><strong>Status:</strong> ${t.status} | <strong>Assigned:</strong> ${t.assignee} | <strong>Due:</strong> ${t.dueDate.toDateString()}</p><p>${t.description}</p></div>`
              )
              .join('')}`
          : ''
      }
    </body>
    </html>
    `;

    return html;
  }

  /**
   * Build channel spec from messages and extracted data
   */
  buildChannelSpec(
    channelName: string,
    messages: UnifiedMessage[]
  ): ChannelSpec {
    // This is a placeholder - in production, use LLM to intelligently extract
    const spec: ChannelSpec = {
      title: `${channelName} - Project Specification`,
      overview:
        'Channel overview generated from message analysis', // Extract from messages
      decisions: [],
      tasks: [],
      milestones: [],
      participants: [],
      timeline: [],
      resources: [],
    };

    return spec;
  }

  /**
   * Auto-update artifact when new messages arrive
   */
  async updateArtifact(
    artifactId: string,
    newMessages: UnifiedMessage[]
  ): Promise<void> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    artifact.updatedAt = new Date();

    if (artifact.exportFormat === 'google_docs' && artifact.googleDocId) {
      // TODO: Update Google Doc with new content
      console.log(`Updating Google Doc: ${artifact.googleDocId}`);
    }
  }

  /**
   * Publish artifact (make it live)
   */
  publishArtifact(artifactId: string): void {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    artifact.status = 'published';
  }

  getArtifact(artifactId: string): ChannelArtifact | undefined {
    return this.artifacts.get(artifactId);
  }

  getAllArtifacts(): ChannelArtifact[] {
    return Array.from(this.artifacts.values());
  }
}

export const channelExportService = new ChannelExportService();
