/**
 * Native Share Service
 * Handles native sharing capabilities using Web Share API and Capacitor
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  files?: string[];
  dialogTitle?: string;
}

interface ShareResult {
  success: boolean;
  activityType?: string;
  error?: string;
}

class NativeShareService {
  private isNative: boolean;
  private isWebShareSupported: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isWebShareSupported = this.checkWebShareSupport();
  }

  /**
   * Check if Web Share API is supported
   */
  private checkWebShareSupport(): boolean {
    return 'share' in navigator;
  }

  /**
   * Check if sharing is supported
   */
  isShareSupported(): boolean {
    return this.isNative || this.isWebShareSupported;
  }

  /**
   * Check if files can be shared
   */
  canShareFiles(): boolean {
    if (this.isNative) {
      return true;
    }

    // Check if Web Share API supports files
    return 'canShare' in navigator && navigator.canShare?.({ files: [] as any }) === true;
  }

  /**
   * Share content
   */
  async share(options: ShareOptions): Promise<ShareResult> {
    if (!this.isShareSupported()) {
      return {
        success: false,
        error: 'Share not supported on this device'
      };
    }

    try {
      if (this.isNative) {
        return await this.shareNative(options);
      } else {
        return await this.shareWeb(options);
      }
    } catch (error: any) {
      console.error('[Share] Error sharing:', error);
      return {
        success: false,
        error: error.message || 'Share failed'
      };
    }
  }

  /**
   * Share using Capacitor (native)
   */
  private async shareNative(options: ShareOptions): Promise<ShareResult> {
    try {
      const shareOptions: any = {
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle || 'Share via'
      };

      // Note: Capacitor Share doesn't support files directly
      // For file sharing, use Capacitor Filesystem + Share
      if (options.files && options.files.length > 0) {
        // Files need to be converted to base64 or URLs
        shareOptions.url = options.files[0]; // Share first file URL
      }

      await Share.share(shareOptions);

      return {
        success: true
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Share using Web Share API
   */
  private async shareWeb(options: ShareOptions): Promise<ShareResult> {
    try {
      const shareData: ShareData = {
        title: options.title,
        text: options.text,
        url: options.url
      };

      // Add files if supported
      if (options.files && options.files.length > 0 && this.canShareFiles()) {
        // Convert file URLs to File objects
        const files = await this.urlsToFiles(options.files);
        if (files.length > 0) {
          shareData.files = files;
        }
      }

      await navigator.share(shareData);

      return {
        success: true
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Share cancelled'
        };
      }
      throw error;
    }
  }

  /**
   * Convert URLs to File objects
   */
  private async urlsToFiles(urls: string[]): Promise<File[]> {
    const files: File[] = [];

    for (const url of urls) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const filename = this.getFilenameFromUrl(url);
        const file = new File([blob], filename, { type: blob.type });
        files.push(file);
      } catch (error) {
        console.error('[Share] Error converting URL to file:', error);
      }
    }

    return files;
  }

  /**
   * Extract filename from URL
   */
  private getFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      return filename || 'shared-file';
    } catch {
      return 'shared-file';
    }
  }

  /**
   * Share text message
   */
  async shareText(text: string, title?: string): Promise<ShareResult> {
    return this.share({
      title: title || 'Share',
      text
    });
  }

  /**
   * Share URL
   */
  async shareUrl(url: string, title?: string, text?: string): Promise<ShareResult> {
    return this.share({
      title: title || 'Share Link',
      text,
      url
    });
  }

  /**
   * Share file
   */
  async shareFile(fileUrl: string, title?: string): Promise<ShareResult> {
    return this.share({
      title: title || 'Share File',
      files: [fileUrl]
    });
  }

  /**
   * Share multiple files
   */
  async shareFiles(fileUrls: string[], title?: string): Promise<ShareResult> {
    return this.share({
      title: title || 'Share Files',
      files: fileUrls
    });
  }

  /**
   * Share message with attachments
   */
  async shareMessage(message: {
    text: string;
    attachments?: string[];
    title?: string;
  }): Promise<ShareResult> {
    return this.share({
      title: message.title || 'Share Message',
      text: message.text,
      files: message.attachments
    });
  }
}

// Export singleton instance
export const nativeShareService = new NativeShareService();

/**
 * React hook for native sharing
 */
export function useNativeShare() {
  const share = async (options: ShareOptions) => {
    return await nativeShareService.share(options);
  };

  return {
    share,
    shareText: (text: string, title?: string) => nativeShareService.shareText(text, title),
    shareUrl: (url: string, title?: string, text?: string) => nativeShareService.shareUrl(url, title, text),
    shareFile: (fileUrl: string, title?: string) => nativeShareService.shareFile(fileUrl, title),
    shareFiles: (fileUrls: string[], title?: string) => nativeShareService.shareFiles(fileUrls, title),
    shareMessage: (message: Parameters<typeof nativeShareService.shareMessage>[0]) => nativeShareService.shareMessage(message),
    isSupported: nativeShareService.isShareSupported(),
    canShareFiles: nativeShareService.canShareFiles()
  };
}
