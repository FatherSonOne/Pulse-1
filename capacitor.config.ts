import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.qntmpulse.app',
  appName: 'Pulse',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Uncomment below for local development testing
    // url: 'http://localhost:5173',
    // cleartext: true
    clearCache: false, // Vite uses content-hash filenames — cache is safe; no need to wipe on every update
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'AAB' // Use AAB for Google Play, APK for direct install
    },
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false // Set to true for debugging
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#09090b',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Camera: {
      // No special config needed; plugin uses system camera and photo picker
    },
    Geolocation: {
      // No special config needed; uses ACCESS_FINE/COARSE_LOCATION from manifest
    }
  }
};

export default config;
