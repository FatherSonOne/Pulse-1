// Application Configuration
// Controls feature flags and environment settings

export type AppMode = 'production' | 'development';

const getAppMode = (): AppMode => {
  const mode = (import.meta.env.VITE_APP_MODE || import.meta.env.VITE_APP_ENV) as string;
  if (mode === 'production') {
    return 'production';
  }
  return 'development';
};

export const appConfig = {
  // Current app mode
  mode: getAppMode(),

  // Feature flags based on mode
  get isProduction() {
    return this.mode === 'production';
  },

  get isDevelopment() {
    return this.mode === 'development';
  },

  // Logging level for debugging
  get shouldLogDebug() {
    return this.mode !== 'production';
  },

  // Log data operations (for debugging)
  logDataOperation(service: string, operation: string) {
    if (this.shouldLogDebug) {
      console.log(`[${service}] ${operation}`);
    }
  }
};

export default appConfig;
