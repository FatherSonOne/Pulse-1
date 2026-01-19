// ============================================
// CHANNEL EXPORT SERVICE TESTS
// ============================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelExportService } from './channelExportService';
import { ChannelSpec, UnifiedMessage } from '../types';

describe('ChannelExportService', () => {
  let service: ChannelExportService;

  beforeEach(() => {
    service = new ChannelExportService();
  });

  describe('exportToMarkdown', () => {
    it('should generate valid markdown from channel spec', () => {
      const spec = createMockChannelSpec();
      const markdown = service.exportToMarkdown('Test Channel', spec);

      expect(markdown).toContain('# Test Project Specification');
      expect(markdown).toContain('## Overview');
      expect(markdown).toContain('This is a test project');
      expect(markdown).toContain('**Last Updated:**');
    });

    it('should include participants section when present', () => {
      const spec = createMockChannelSpec();
      spec.participants = [
        { id: '1', name: 'John Doe', role: 'Developer', email: 'john@example.com', contributionCount: 10 },
        { id: '2', name: 'Jane Smith', role: 'Designer', email: 'jane@example.com', contributionCount: 5 },
      ];

      const markdown = service.exportToMarkdown('Test Channel', spec);

      expect(markdown).toContain('## Team');
      expect(markdown).toContain('**John Doe** (Developer)');
      expect(markdown).toContain('**Jane Smith** (Designer)');
    });

    it('should include decisions section when present', () => {
      const spec = createMockChannelSpec();
      spec.decisions = [
        {
          id: 'd1',
          title: 'Use React',
          description: 'We decided to use React for the frontend',
          decidedBy: 'Team Lead',
          decidedAt: new Date('2024-01-15'),
          relatedMessages: [],
          impactArea: 'Frontend',
        },
      ];

      const markdown = service.exportToMarkdown('Test Channel', spec);

      expect(markdown).toContain('## Key Decisions');
      expect(markdown).toContain('### Use React');
      expect(markdown).toContain('**Decided by:** Team Lead');
    });

    it('should include milestones section when present', () => {
      const spec = createMockChannelSpec();
      spec.milestones = [
        {
          id: 'm1',
          title: 'MVP Launch',
          targetDate: new Date('2024-06-01'),
          description: 'Launch minimum viable product',
          completionStatus: 75,
          dependencies: [],
        },
      ];

      const markdown = service.exportToMarkdown('Test Channel', spec);

      expect(markdown).toContain('## Milestones');
      expect(markdown).toContain('**MVP Launch** [75%]');
    });

    it('should include tasks section when present', () => {
      const spec = createMockChannelSpec();
      spec.tasks = [
        {
          id: 't1',
          title: 'Implement login',
          description: 'Add user authentication',
          assignee: 'John',
          dueDate: new Date('2024-03-01'),
          status: 'in_progress',
          priority: 'high',
          sourceMessages: [],
        },
      ];

      const markdown = service.exportToMarkdown('Test Channel', spec);

      expect(markdown).toContain('## Tasks');
      expect(markdown).toContain('[IN_PROGRESS] **Implement login** (HIGH)');
      expect(markdown).toContain('Assigned to: John');
    });

    it('should include timeline when present', () => {
      const spec = createMockChannelSpec();
      spec.timeline = [
        { date: new Date('2024-01-01'), event: 'Project kickoff', type: 'milestone' },
        { date: new Date('2024-02-01'), event: 'Design approved', type: 'decision' },
      ];

      const markdown = service.exportToMarkdown('Test Channel', spec);

      expect(markdown).toContain('## Timeline');
      expect(markdown).toContain('Project kickoff (milestone)');
      expect(markdown).toContain('Design approved (decision)');
    });

    it('should include resources when present', () => {
      const spec = createMockChannelSpec();
      spec.resources = [
        { title: 'Design Doc', url: 'https://docs.example.com', type: 'document', description: 'Main design' },
        { title: 'GitHub Repo', url: 'https://github.com/example', type: 'code', description: 'Source code' },
      ];

      const markdown = service.exportToMarkdown('Test Channel', spec);

      expect(markdown).toContain('## Resources');
      expect(markdown).toContain('[Design Doc](https://docs.example.com)');
      expect(markdown).toContain('[GitHub Repo](https://github.com/example)');
    });
  });

  describe('exportToHtml', () => {
    it('should generate valid HTML from channel spec', () => {
      const spec = createMockChannelSpec();
      const html = service.exportToHtml('Test Channel', spec);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<title>Test Project Specification</title>');
      expect(html).toContain('<h1>Test Project Specification</h1>');
      expect(html).toContain('This is a test project');
    });

    it('should include CSS styles', () => {
      const spec = createMockChannelSpec();
      const html = service.exportToHtml('Test Channel', spec);

      expect(html).toContain('<style>');
      expect(html).toContain('font-family');
      expect(html).toContain('.decision');
      expect(html).toContain('.task');
    });

    it('should include participants when present', () => {
      const spec = createMockChannelSpec();
      spec.participants = [
        { id: '1', name: 'John', role: 'Dev', email: 'john@test.com', contributionCount: 5 },
      ];

      const html = service.exportToHtml('Test Channel', spec);

      expect(html).toContain('<h2>Team</h2>');
      expect(html).toContain('<strong>John</strong>');
    });
  });

  describe('buildChannelSpec', () => {
    it('should build a basic spec from messages', () => {
      const messages: UnifiedMessage[] = [
        createMockMessage('1', 'Hello'),
        createMockMessage('2', 'World'),
      ];

      const spec = service.buildChannelSpec('Test Channel', messages);

      expect(spec.title).toContain('Test Channel');
      expect(spec.overview).toBeTruthy();
      expect(Array.isArray(spec.decisions)).toBe(true);
      expect(Array.isArray(spec.tasks)).toBe(true);
    });
  });

  describe('exportToGoogleDocs', () => {
    it('should create an artifact for Google Docs export', async () => {
      const spec = createMockChannelSpec();
      const messages: UnifiedMessage[] = [];

      const artifact = await service.exportToGoogleDocs(
        'channel-1',
        'Test Channel',
        messages,
        spec
      );

      expect(artifact).toBeDefined();
      expect(artifact.id).toMatch(/^artifact-/);
      expect(artifact.channelId).toBe('channel-1');
      expect(artifact.channelName).toBe('Test Channel');
      expect(artifact.exportFormat).toBe('google_docs');
      expect(artifact.status).toBe('draft');
    });

    it('should store artifact for retrieval', async () => {
      const spec = createMockChannelSpec();
      const artifact = await service.exportToGoogleDocs('ch-1', 'Ch', [], spec);

      const retrieved = service.getArtifact(artifact.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(artifact.id);
    });
  });

  describe('publishArtifact', () => {
    it('should change artifact status to published', async () => {
      const spec = createMockChannelSpec();
      const artifact = await service.exportToGoogleDocs('ch-1', 'Ch', [], spec);

      expect(artifact.status).toBe('draft');

      service.publishArtifact(artifact.id);

      const updated = service.getArtifact(artifact.id);
      expect(updated?.status).toBe('published');
    });

    it('should throw error for non-existent artifact', () => {
      expect(() => service.publishArtifact('non-existent')).toThrow(
        'Artifact not found: non-existent'
      );
    });
  });

  describe('updateArtifact', () => {
    it('should update artifact timestamp', async () => {
      const spec = createMockChannelSpec();
      const artifact = await service.exportToGoogleDocs('ch-1', 'Ch', [], spec);
      const originalUpdate = artifact.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await service.updateArtifact(artifact.id, []);

      const updated = service.getArtifact(artifact.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdate.getTime());
    });

    it('should throw error for non-existent artifact', async () => {
      await expect(service.updateArtifact('non-existent', [])).rejects.toThrow(
        'Artifact not found: non-existent'
      );
    });
  });

  describe('getAllArtifacts', () => {
    it('should return all stored artifacts', async () => {
      const spec = createMockChannelSpec();

      await service.exportToGoogleDocs('ch-1', 'Channel 1', [], spec);
      // Add a small delay to ensure different timestamps for unique IDs
      await new Promise((r) => setTimeout(r, 2));
      await service.exportToGoogleDocs('ch-2', 'Channel 2', [], spec);

      const allArtifacts = service.getAllArtifacts();
      expect(allArtifacts.length).toBe(2);
    });
  });
});

// Helper functions
function createMockChannelSpec(): ChannelSpec {
  return {
    title: 'Test Project Specification',
    overview: 'This is a test project',
    decisions: [],
    tasks: [],
    milestones: [],
    participants: [],
    timeline: [],
    resources: [],
  };
}

function createMockMessage(id: string, content: string): UnifiedMessage {
  return {
    id,
    source: 'slack',
    type: 'text',
    content,
    senderName: 'Test User',
    senderId: 'user-123',
    channelId: 'channel-1',
    channelName: 'Test Channel',
    timestamp: new Date(),
    conversationGraphId: '',
    metadata: {},
    isRead: false,
    starred: false,
    tags: [],
  };
}
