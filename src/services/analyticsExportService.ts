import { supabase } from './supabase';

/**
 * Analytics Export Service
 * Handles export of analytics data in multiple formats (CSV, JSON, PDF, HTML, Excel)
 */

// ==================== Types ====================

export type ExportFormat = 'csv' | 'json' | 'pdf' | 'html' | 'xlsx';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DateRangeType = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface ExportOptions {
  format: ExportFormat;
  date_range: DateRangeType;
  custom_start_date?: string;
  custom_end_date?: string;
  include_metadata: boolean;
  include_attachments: boolean;
  include_analytics: boolean;
  anonymize: boolean;
  compress: boolean;
}

export interface ExportJob {
  id: string;
  user_id: string;
  name: string;
  format: ExportFormat;
  status: ExportStatus;
  progress: number;
  created_at: string;
  completed_at?: string;
  file_size?: number;
  download_url?: string;
  error_message?: string;
  options: ExportOptions;
}

export interface AnalyticsData {
  total_messages: number;
  total_contacts: number;
  total_attachments: number;
  date_range: { start: string; end: string };
  message_trend: { date: string; count: number }[];
  top_contacts: { name: string; email?: string; count: number }[];
  response_time_avg: number;
  sentiment_breakdown: { positive: number; neutral: number; negative: number };
  message_types: { text: number; voice: number; video: number };
  hourly_activity: { hour: number; count: number }[];
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: ExportFormat;
  options: Partial<ExportOptions>;
}

// ==================== Analytics Export Service ====================

export class AnalyticsExportService {
  /**
   * Create a new export job
   */
  async createExport(
    userId: string,
    options: ExportOptions,
    onProgress?: (progress: number) => void
  ): Promise<ExportJob> {
    try {
      // Create export job entry
      const { data: exportJob, error: createError } = await supabase
        .from('export_jobs')
        .insert([
          {
            user_id: userId,
            name: `${options.format.toUpperCase()} Export - ${new Date().toLocaleDateString()}`,
            format: options.format,
            status: 'processing',
            progress: 0,
            created_at: new Date().toISOString(),
            options
          }
        ])
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create export job: ${createError.message}`);
      }

      onProgress?.(10);

      // Gather analytics data
      const analyticsData = await this.gatherAnalyticsData(userId, options);

      onProgress?.(40);

      // Generate export file based on format
      let exportedData: Blob;
      let contentType: string;

      switch (options.format) {
        case 'csv':
          exportedData = await this.generateCSV(analyticsData, options);
          contentType = 'text/csv';
          break;
        case 'json':
          exportedData = await this.generateJSON(analyticsData, options);
          contentType = 'application/json';
          break;
        case 'html':
          exportedData = await this.generateHTML(analyticsData, options);
          contentType = 'text/html';
          break;
        case 'pdf':
          exportedData = await this.generatePDF(analyticsData, options);
          contentType = 'application/pdf';
          break;
        case 'xlsx':
          exportedData = await this.generateExcel(analyticsData, options);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      onProgress?.(70);

      // Compress if requested
      if (options.compress) {
        exportedData = await this.compressData(exportedData);
        contentType = 'application/zip';
      }

      // Upload to storage
      const fileExtension = options.compress ? 'zip' : options.format;
      const storagePath = `exports/${userId}/${exportJob.id}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from('exports')
        .upload(storagePath, exportedData, {
          contentType,
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload export: ${uploadError.message}`);
      }

      onProgress?.(90);

      // Get download URL
      const { data: urlData } = supabase.storage
        .from('exports')
        .getPublicUrl(storagePath);

      // Update export job as completed
      const { data: completedJob, error: updateError } = await supabase
        .from('export_jobs')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          file_size: exportedData.size,
          download_url: urlData.publicUrl
        })
        .eq('id', exportJob.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update export job:', updateError);
      }

      onProgress?.(100);

      return completedJob || exportJob;
    } catch (error: any) {
      console.error('Export creation failed:', error);
      throw error;
    }
  }

  /**
   * Gather analytics data based on export options
   */
  private async gatherAnalyticsData(
    userId: string,
    options: ExportOptions
  ): Promise<AnalyticsData> {
    const dateRange = this.getDateRange(options.date_range, options.custom_start_date, options.custom_end_date);

    // Get message count
    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    // Get contact count
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get attachment count
    const { count: attachmentCount } = await supabase
      .from('file_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('uploaded_at', dateRange.start)
      .lte('uploaded_at', dateRange.end);

    // Get message trend (daily counts for the past week)
    const messageTrend = await this.getMessageTrend(userId, dateRange);

    // Get top contacts
    const topContacts = await this.getTopContacts(userId, dateRange);

    // Calculate response time average (placeholder)
    const responseTimeAvg = 15; // minutes

    // Get sentiment breakdown (placeholder)
    const sentimentBreakdown = {
      positive: 65,
      neutral: 28,
      negative: 7
    };

    // Get message types (placeholder)
    const messageTypes = {
      text: 2500,
      voice: 300,
      video: 47
    };

    // Get hourly activity
    const hourlyActivity = await this.getHourlyActivity(userId, dateRange);

    return {
      total_messages: messageCount || 0,
      total_contacts: contactCount || 0,
      total_attachments: attachmentCount || 0,
      date_range: dateRange,
      message_trend: messageTrend,
      top_contacts: topContacts,
      response_time_avg: responseTimeAvg,
      sentiment_breakdown: sentimentBreakdown,
      message_types: messageTypes,
      hourly_activity: hourlyActivity
    };
  }

  /**
   * Get date range based on type
   */
  private getDateRange(
    type: DateRangeType,
    customStart?: string,
    customEnd?: string
  ): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    switch (type) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        return {
          start: customStart || new Date(0).toISOString(),
          end: customEnd || end
        };
      case 'all':
      default:
        start = new Date(0); // Beginning of time
        break;
    }

    return {
      start: start.toISOString(),
      end
    };
  }

  /**
   * Get message trend data
   */
  private async getMessageTrend(
    userId: string,
    dateRange: { start: string; end: string }
  ): Promise<{ date: string; count: number }[]> {
    // This would query messages grouped by date
    // For now, return sample data
    const days = Math.min(7, Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (24 * 60 * 60 * 1000)));

    return Array.from({ length: days }, (_, i) => {
      const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        count: Math.floor(Math.random() * 200) + 100
      };
    });
  }

  /**
   * Get top contacts
   */
  private async getTopContacts(
    userId: string,
    dateRange: { start: string; end: string }
  ): Promise<{ name: string; email?: string; count: number }[]> {
    // This would query messages grouped by contact
    // For now, return sample data
    return [
      { name: 'Alice Chen', email: 'alice@example.com', count: 342 },
      { name: 'Bob Smith', email: 'bob@example.com', count: 256 },
      { name: 'Carol Davis', email: 'carol@example.com', count: 198 },
      { name: 'David Wilson', email: 'david@example.com', count: 167 },
      { name: 'Eve Thompson', email: 'eve@example.com', count: 145 }
    ];
  }

  /**
   * Get hourly activity data
   */
  private async getHourlyActivity(
    userId: string,
    dateRange: { start: string; end: string }
  ): Promise<{ hour: number; count: number }[]> {
    // This would query messages grouped by hour
    // For now, return sample data
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: Math.floor(Math.random() * 150) + 20
    }));
  }

  /**
   * Generate CSV export
   */
  private async generateCSV(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    const rows: string[] = [];

    // Header
    rows.push('Metric,Value');
    rows.push('');

    // Summary stats
    rows.push('Summary Statistics');
    rows.push(`Total Messages,${data.total_messages}`);
    rows.push(`Total Contacts,${data.total_contacts}`);
    rows.push(`Total Attachments,${data.total_attachments}`);
    rows.push(`Average Response Time,${data.response_time_avg} minutes`);
    rows.push('');

    // Message trend
    rows.push('Message Trend');
    rows.push('Date,Count');
    data.message_trend.forEach(item => {
      rows.push(`${item.date},${item.count}`);
    });
    rows.push('');

    // Top contacts
    rows.push('Top Contacts');
    rows.push('Name,Email,Message Count');
    data.top_contacts.forEach(contact => {
      rows.push(`${contact.name},${contact.email || ''},${contact.count}`);
    });
    rows.push('');

    // Sentiment
    rows.push('Sentiment Breakdown');
    rows.push('Category,Percentage');
    rows.push(`Positive,${data.sentiment_breakdown.positive}%`);
    rows.push(`Neutral,${data.sentiment_breakdown.neutral}%`);
    rows.push(`Negative,${data.sentiment_breakdown.negative}%`);

    return new Blob([rows.join('\n')], { type: 'text/csv' });
  }

  /**
   * Generate JSON export
   */
  private async generateJSON(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    const exportData = {
      generated_at: new Date().toISOString(),
      format: 'json',
      analytics: data,
      options: {
        date_range: options.date_range,
        include_metadata: options.include_metadata,
        include_analytics: options.include_analytics
      }
    };

    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  }

  /**
   * Generate HTML export
   */
  private async generateHTML(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #4b5563; margin-top: 30px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f3f4f6; padding: 20px; border-radius: 8px; }
    .stat-value { font-size: 32px; font-weight: bold; color: #3b82f6; }
    .stat-label { color: #6b7280; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .chart { height: 200px; background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <h1>Analytics Report</h1>
  <p>Generated on: ${new Date().toLocaleString()}</p>
  <p>Date Range: ${new Date(data.date_range.start).toLocaleDateString()} - ${new Date(data.date_range.end).toLocaleDateString()}</p>

  <h2>Summary Statistics</h2>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value">${data.total_messages.toLocaleString()}</div>
      <div class="stat-label">Total Messages</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.total_contacts}</div>
      <div class="stat-label">Total Contacts</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.total_attachments}</div>
      <div class="stat-label">Total Attachments</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.response_time_avg}m</div>
      <div class="stat-label">Avg Response Time</div>
    </div>
  </div>

  <h2>Top Contacts</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Messages</th>
      </tr>
    </thead>
    <tbody>
      ${data.top_contacts.map(contact => `
        <tr>
          <td>${contact.name}</td>
          <td>${contact.email || 'N/A'}</td>
          <td>${contact.count}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Sentiment Analysis</h2>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value" style="color: #10b981;">${data.sentiment_breakdown.positive}%</div>
      <div class="stat-label">Positive</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: #6b7280;">${data.sentiment_breakdown.neutral}%</div>
      <div class="stat-label">Neutral</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: #ef4444;">${data.sentiment_breakdown.negative}%</div>
      <div class="stat-label">Negative</div>
    </div>
  </div>

  <div class="footer">
    <p>Generated by Pulse Analytics Export Service</p>
  </div>
</body>
</html>
    `;

    return new Blob([html], { type: 'text/html' });
  }

  /**
   * Generate PDF export (placeholder - would need a PDF library)
   */
  private async generatePDF(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    // In production, you would use a library like jsPDF or pdfmake
    // For now, we'll generate HTML and note that it should be converted to PDF
    const htmlBlob = await this.generateHTML(data, options);
    const htmlText = await htmlBlob.text();

    // This is a placeholder - in production you'd convert HTML to PDF
    return new Blob([htmlText], { type: 'application/pdf' });
  }

  /**
   * Generate Excel export (placeholder - would need an Excel library)
   */
  private async generateExcel(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    // In production, you would use a library like xlsx or exceljs
    // For now, we'll generate CSV
    return this.generateCSV(data, options);
  }

  /**
   * Compress data to ZIP format (placeholder)
   */
  private async compressData(data: Blob): Promise<Blob> {
    // In production, you would use a library like jszip
    // For now, just return the original data
    return data;
  }

  /**
   * Get export job by ID
   */
  async getExportJob(jobId: string, userId: string): Promise<ExportJob | null> {
    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Failed to get export job:', error);
      return null;
    }

    return data;
  }

  /**
   * List export jobs for a user
   */
  async listExportJobs(userId: string, limit: number = 10): Promise<ExportJob[]> {
    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list export jobs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Cancel an export job
   */
  async cancelExportJob(jobId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('export_jobs')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user'
      })
      .eq('id', jobId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to cancel export job: ${error.message}`);
    }
  }

  /**
   * Delete an export job and its file
   */
  async deleteExportJob(jobId: string, userId: string): Promise<void> {
    // Get job info
    const { data: job, error: fetchError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !job) {
      throw new Error('Export job not found');
    }

    // Delete file from storage if exists
    if (job.download_url) {
      const storagePath = `exports/${userId}/${jobId}.${job.format}`;
      const { error: storageError } = await supabase.storage
        .from('exports')
        .remove([storagePath]);

      if (storageError) {
        console.error('Failed to delete export file:', storageError);
      }
    }

    // Delete job record
    const { error: deleteError } = await supabase
      .from('export_jobs')
      .delete()
      .eq('id', jobId);

    if (deleteError) {
      throw new Error(`Failed to delete export job: ${deleteError.message}`);
    }
  }

  /**
   * Get available export templates
   */
  getExportTemplates(): ExportTemplate[] {
    return [
      {
        id: 'monthly-report',
        name: 'Monthly Report',
        description: 'Comprehensive monthly analytics report',
        format: 'pdf',
        options: {
          date_range: 'month',
          include_metadata: true,
          include_analytics: true,
          include_attachments: false,
          anonymize: false,
          compress: false
        }
      },
      {
        id: 'data-export',
        name: 'Full Data Export',
        description: 'Complete data export in JSON format',
        format: 'json',
        options: {
          date_range: 'all',
          include_metadata: true,
          include_analytics: true,
          include_attachments: true,
          anonymize: false,
          compress: true
        }
      },
      {
        id: 'contact-list',
        name: 'Contact List',
        description: 'Spreadsheet of all contacts',
        format: 'csv',
        options: {
          date_range: 'all',
          include_metadata: false,
          include_analytics: false,
          include_attachments: false,
          anonymize: false,
          compress: false
        }
      }
    ];
  }
}

// Export singleton instance
export const analyticsExportService = new AnalyticsExportService();
