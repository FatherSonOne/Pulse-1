/**
 * Native Camera Service
 * Handles camera access for photo capture and QR code scanning
 */

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: 'uri' | 'base64' | 'dataUrl';
  source?: 'camera' | 'photos' | 'prompt';
  width?: number;
  height?: number;
  saveToGallery?: boolean;
}

interface CapturedPhoto {
  dataUrl?: string;
  base64String?: string;
  path?: string;
  webPath?: string;
  format?: string;
}

class NativeCameraService {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Check if camera is available
   */
  async isCameraAvailable(): Promise<boolean> {
    if (!this.isNative) {
      // Check for getUserMedia API
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    // Native: Camera is usually available, but check permissions
    try {
      const permissions = await Camera.checkPermissions();
      return permissions.camera !== 'denied';
    } catch {
      return false;
    }
  }

  /**
   * Request camera permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const permissions = await Camera.requestPermissions();
      return permissions.camera === 'granted';
    } catch (error) {
      console.error('[Camera] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Check camera permissions
   */
  async checkPermissions(): Promise<{
    camera: 'granted' | 'denied' | 'prompt';
    photos: 'granted' | 'denied' | 'prompt';
  }> {
    try {
      const permissions = await Camera.checkPermissions();
      return {
        camera: permissions.camera || 'prompt',
        photos: permissions.photos || 'prompt'
      };
    } catch (error) {
      console.error('[Camera] Error checking permissions:', error);
      return {
        camera: 'denied',
        photos: 'denied'
      };
    }
  }

  /**
   * Take a photo
   */
  async takePhoto(options: CameraOptions = {}): Promise<CapturedPhoto | null> {
    try {
      // Map options to Capacitor format
      const resultType = this.mapResultType(options.resultType || 'dataUrl');
      const source = this.mapSource(options.source || 'camera');

      const photo: Photo = await Camera.getPhoto({
        quality: options.quality || 90,
        allowEditing: options.allowEditing !== false,
        resultType,
        source,
        width: options.width,
        height: options.height,
        saveToGallery: options.saveToGallery || false
      });

      return this.formatPhoto(photo, options.resultType || 'dataUrl');
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        console.error('[Camera] Error taking photo:', error);
      }
      return null;
    }
  }

  /**
   * Pick photo from gallery
   */
  async pickPhoto(options: CameraOptions = {}): Promise<CapturedPhoto | null> {
    return this.takePhoto({
      ...options,
      source: 'photos'
    });
  }

  /**
   * Show source prompt (camera or gallery)
   */
  async showSourcePrompt(options: CameraOptions = {}): Promise<CapturedPhoto | null> {
    return this.takePhoto({
      ...options,
      source: 'prompt'
    });
  }

  /**
   * Take multiple photos
   */
  async takeMultiplePhotos(count: number, options: CameraOptions = {}): Promise<CapturedPhoto[]> {
    const photos: CapturedPhoto[] = [];

    for (let i = 0; i < count; i++) {
      const photo = await this.takePhoto(options);
      if (photo) {
        photos.push(photo);
      } else {
        break; // User cancelled
      }
    }

    return photos;
  }

  /**
   * Scan QR code (requires BarcodeScanner plugin)
   */
  async scanQRCode(): Promise<string | null> {
    try {
      // Note: Requires @capacitor-community/barcode-scanner
      // This is a placeholder for the implementation
      console.log('[Camera] QR scanning requires @capacitor-community/barcode-scanner plugin');
      return null;
    } catch (error) {
      console.error('[Camera] Error scanning QR code:', error);
      return null;
    }
  }

  /**
   * Map result type to Capacitor format
   */
  private mapResultType(type: string): CameraResultType {
    switch (type) {
      case 'uri':
        return CameraResultType.Uri;
      case 'base64':
        return CameraResultType.Base64;
      case 'dataUrl':
      default:
        return CameraResultType.DataUrl;
    }
  }

  /**
   * Map source to Capacitor format
   */
  private mapSource(source: string): CameraSource {
    switch (source) {
      case 'camera':
        return CameraSource.Camera;
      case 'photos':
        return CameraSource.Photos;
      case 'prompt':
      default:
        return CameraSource.Prompt;
    }
  }

  /**
   * Format photo result
   */
  private formatPhoto(photo: Photo, resultType: string): CapturedPhoto {
    const formatted: CapturedPhoto = {
      format: photo.format,
      webPath: photo.webPath
    };

    if (resultType === 'base64') {
      formatted.base64String = photo.base64String;
    } else if (resultType === 'uri') {
      formatted.path = photo.path;
    } else {
      // dataUrl
      formatted.dataUrl = photo.dataUrl || photo.webPath;
    }

    return formatted;
  }

  /**
   * Convert photo to blob
   */
  async photoToBlob(photo: CapturedPhoto): Promise<Blob | null> {
    try {
      if (photo.dataUrl) {
        const response = await fetch(photo.dataUrl);
        return await response.blob();
      }

      if (photo.base64String) {
        const binary = atob(photo.base64String);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: 'image/jpeg' });
      }

      return null;
    } catch (error) {
      console.error('[Camera] Error converting photo to blob:', error);
      return null;
    }
  }

  /**
   * Convert photo to File object
   */
  async photoToFile(photo: CapturedPhoto, filename: string = 'photo.jpg'): Promise<File | null> {
    const blob = await this.photoToBlob(photo);
    if (!blob) return null;

    return new File([blob], filename, { type: 'image/jpeg' });
  }
}

// Export singleton instance
export const nativeCameraService = new NativeCameraService();

/**
 * React hook for camera access
 */
export function useNativeCamera() {
  const takePhoto = async (options?: CameraOptions) => {
    return await nativeCameraService.takePhoto(options);
  };

  const pickPhoto = async (options?: CameraOptions) => {
    return await nativeCameraService.pickPhoto(options);
  };

  const showSourcePrompt = async (options?: CameraOptions) => {
    return await nativeCameraService.showSourcePrompt(options);
  };

  return {
    takePhoto,
    pickPhoto,
    showSourcePrompt,
    takeMultiplePhotos: (count: number, options?: CameraOptions) =>
      nativeCameraService.takeMultiplePhotos(count, options),
    scanQRCode: () => nativeCameraService.scanQRCode(),
    isCameraAvailable: () => nativeCameraService.isCameraAvailable(),
    requestPermissions: () => nativeCameraService.requestPermissions(),
    checkPermissions: () => nativeCameraService.checkPermissions(),
    photoToBlob: (photo: CapturedPhoto) => nativeCameraService.photoToBlob(photo),
    photoToFile: (photo: CapturedPhoto, filename?: string) =>
      nativeCameraService.photoToFile(photo, filename)
  };
}
