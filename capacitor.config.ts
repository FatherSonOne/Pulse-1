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
    clearCache: true, // Clear WebView cache on app start
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
    }
  }
};

export default config;
