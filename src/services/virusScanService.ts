/**
 * Virus Scan Service
 * Provides file scanning capabilities for uploaded files
 *
 * Supports multiple scanning backends:
 * - VirusTotal API (cloud-based, requires API key)
 * - ClamAV (self-hosted, for privacy-conscious deployments)
 * - Basic heuristic scanning (fallback, no external dependencies)
 */

import { supabase } from './supabase';

// ==================== Types ====================

export interface VirusScanResult {
  safe: boolean;
  threats: string[];
  scanDate: Date;
  scanEngine: 'virustotal' | 'clamav' | 'heuristic';
  confidence: number; // 0-1
  details?: {
    positives?: number;
    total?: number;
    scanId?: string;
  };
}

export interface ScanProgress {
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  progress: number;
  message?: string;
}

// ==================== Constants ====================

// Known dangerous file signatures (magic bytes)
const DANGEROUS_SIGNATURES: { pattern: number[]; name: string }[] = [
  { pattern: [0x4D, 0x5A], name: 'Windows Executable (PE)' }, // .exe, .dll
  { pattern: [0x7F, 0x45, 0x4C, 0x46], name: 'Linux Executable (ELF)' },
  { pattern: [0xCA, 0xFE, 0xBA, 0xBE], name: 'Java Class File' },
  { pattern: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP Archive (may contain executables)' },
];

// Suspicious file extensions
const SUSPICIOUS_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jse',
  '.wsf', '.scr', '.pif', '.msi', '.jar', '.com', '.hta', '.cpl'
];

// Maximum file size for scanning (50MB)
const MAX_SCAN_SIZE = 50 * 1024 * 1024;

// ==================== Virus Scan Service ====================

class VirusScanService {
  private virusTotalApiKey: string | null = null;

  /**
   * Initialize with VirusTotal API key (optional)
   */
  initialize(apiKey?: string) {
    this.virusTotalApiKey = apiKey || null;
  }

  /**
   * Scan a file for viruses/malware
   */
  async scanFile(
    file: File | ArrayBuffer,
    fileName?: string,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<VirusScanResult> {
    const buffer = file instanceof File ? await file.arrayBuffer() : file;
    const name = fileName || (file instanceof File ? file.name : 'unknown');

    // Report initial progress
    onProgress?.({ status: 'scanning', progress: 0, message: 'Starting scan...' });

    // Check file size
    if (buffer.byteLength > MAX_SCAN_SIZE) {
      return {
        safe: false,
        threats: ['File too large for scanning'],
        scanDate: new Date(),
        scanEngine: 'heuristic',
        confidence: 0.5
      };
    }

    // Try VirusTotal first if API key available
    if (this.virusTotalApiKey) {
      try {
        onProgress?.({ status: 'scanning', progress: 20, message: 'Uploading to VirusTotal...' });
        return await this.scanWithVirusTotal(buffer, name, onProgress);
      } catch (error) {
        console.warn('VirusTotal scan failed, falling back to heuristic:', error);
      }
    }

    // Fall back to heuristic scanning
    onProgress?.({ status: 'scanning', progress: 50, message: 'Performing heuristic analysis...' });
    return this.heuristicScan(buffer, name);
  }

  /**
   * Scan using VirusTotal API
   */
  private async scanWithVirusTotal(
    buffer: ArrayBuffer,
    fileName: string,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<VirusScanResult> {
    if (!this.virusTotalApiKey) {
      throw new Error('VirusTotal API key not configured');
    }

    // Upload file
    const formData = new FormData();
    formData.append('file', new Blob([buffer]), fileName);

    const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
      method: 'POST',
      headers: {
        'x-apikey': this.virusTotalApiKey
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`VirusTotal upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const analysisId = uploadResult.data?.id;

    if (!analysisId) {
      throw new Error('No analysis ID returned from VirusTotal');
    }

    onProgress?.({ status: 'scanning', progress: 40, message: 'Waiting for analysis...' });

    // Poll for results
    let attempts = 0;
    const maxAttempts = 30;
    const pollInterval = 2000;

    while (attempts < maxAttempts) {
      const analysisResponse = await fetch(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        {
          headers: {
            'x-apikey': this.virusTotalApiKey
          }
        }
      );

      if (!analysisResponse.ok) {
        throw new Error(`VirusTotal analysis check failed: ${analysisResponse.status}`);
      }

      const analysisResult = await analysisResponse.json();
      const status = analysisResult.data?.attributes?.status;

      if (status === 'completed') {
        const stats = analysisResult.data.attributes.stats;
        const results = analysisResult.data.attributes.results;

        const threats = Object.entries(results)
          .filter(([_, result]: [string, any]) => result.category === 'malicious')
          .map(([engine, result]: [string, any]) => `${engine}: ${result.result}`);

        onProgress?.({ status: 'completed', progress: 100, message: 'Scan complete' });

        return {
          safe: stats.malicious === 0 && stats.suspicious === 0,
          threats,
          scanDate: new Date(),
          scanEngine: 'virustotal',
          confidence: 0.95,
          details: {
            positives: stats.malicious + stats.suspicious,
            total: stats.malicious + stats.suspicious + stats.undetected + stats.harmless,
            scanId: analysisId
          }
        };
      }

      attempts++;
      const progress = 40 + Math.min(50, attempts * (50 / maxAttempts));
      onProgress?.({ status: 'scanning', progress, message: `Analysis in progress... (${attempts}/${maxAttempts})` });

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('VirusTotal analysis timed out');
  }

  /**
   * Basic heuristic scanning (no external dependencies)
   */
  private heuristicScan(buffer: ArrayBuffer, fileName: string): VirusScanResult {
    const threats: string[] = [];
    const bytes = new Uint8Array(buffer);

    // Check for dangerous file signatures
    for (const sig of DANGEROUS_SIGNATURES) {
      if (this.matchesSignature(bytes, sig.pattern)) {
        threats.push(`Potentially dangerous file type: ${sig.name}`);
      }
    }

    // Check file extension
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
      threats.push(`Suspicious file extension: ${ext}`);
    }

    // Check for embedded scripts in documents
    const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 10000));

    if (content.includes('<script') || content.includes('javascript:')) {
      threats.push('Potentially contains embedded JavaScript');
    }

    if (content.includes('powershell') || content.includes('cmd.exe')) {
      threats.push('Potentially contains shell commands');
    }

    // Check for macro indicators in Office files
    if (content.includes('vbaProject') || content.includes('macros')) {
      threats.push('Contains macros (potential security risk)');
    }

    return {
      safe: threats.length === 0,
      threats,
      scanDate: new Date(),
      scanEngine: 'heuristic',
      confidence: 0.6 // Lower confidence for heuristic scanning
    };
  }

  /**
   * Check if bytes match a signature pattern
   */
  private matchesSignature(bytes: Uint8Array, pattern: number[]): boolean {
    if (bytes.length < pattern.length) return false;

    for (let i = 0; i < pattern.length; i++) {
      if (bytes[i] !== pattern[i]) return false;
    }

    return true;
  }

  /**
   * Update file upload record with scan results
   */
  async updateScanStatus(
    fileId: string,
    result: VirusScanResult
  ): Promise<void> {
    const { error } = await supabase
      .from('file_uploads')
      .update({
        virus_scan_status: result.safe ? 'clean' : 'infected',
        virus_scan_result: {
          safe: result.safe,
          threats: result.threats,
          scanDate: result.scanDate.toISOString(),
          scanEngine: result.scanEngine,
          confidence: result.confidence,
          details: result.details
        }
      })
      .eq('id', fileId);

    if (error) {
      console.error('Failed to update scan status:', error);
    }
  }

  /**
   * Get scan status for a file
   */
  async getScanStatus(fileId: string): Promise<VirusScanResult | null> {
    const { data, error } = await supabase
      .from('file_uploads')
      .select('virus_scan_status, virus_scan_result')
      .eq('id', fileId)
      .single();

    if (error || !data?.virus_scan_result) {
      return null;
    }

    return {
      safe: data.virus_scan_result.safe,
      threats: data.virus_scan_result.threats,
      scanDate: new Date(data.virus_scan_result.scanDate),
      scanEngine: data.virus_scan_result.scanEngine,
      confidence: data.virus_scan_result.confidence,
      details: data.virus_scan_result.details
    };
  }

  /**
   * Check if file type is allowed for upload
   */
  isFileTypeAllowed(file: File): { allowed: boolean; reason?: string } {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
      return {
        allowed: false,
        reason: `File type ${ext} is not allowed for security reasons`
      };
    }

    return { allowed: true };
  }
}

export const virusScanService = new VirusScanService();
