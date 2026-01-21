/**
 * Environment Variable Validation
 *
 * CRITICAL SECURITY - P0 Priority
 *
 * Validates environment variables at application startup to ensure:
 * - No API keys are exposed via VITE_ prefix
 * - Required environment variables are present
 * - Security configurations are properly set
 * - Warning about missing or insecure configurations
 */

// ==================== Types ====================

export interface EnvValidationResult {
  valid: boolean;
  errors: EnvError[];
  warnings: EnvWarning[];
  criticalIssues: string[];
}

export interface EnvError {
  variable: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface EnvWarning {
  variable: string;
  message: string;
  recommendation: string;
}

// ==================== Configuration ====================

/**
 * Variables that MUST NOT have VITE_ prefix (security risk)
 */
const SENSITIVE_VARIABLES = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'SESSION_SECRET',
  'DATABASE_PASSWORD',
  'STRIPE_SECRET_KEY',
  'TWILIO_AUTH_TOKEN',
  'SENDGRID_API_KEY',
  'AWS_SECRET_ACCESS_KEY',
  'GOOGLE_CLIENT_SECRET',
  'SLACK_CLIENT_SECRET',
  'HUBSPOT_API_KEY',
  'SALESFORCE_CLIENT_SECRET',
];

/**
 * Variables that SHOULD have VITE_ prefix (client-side safe)
 */
const PUBLIC_VARIABLES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_APP_NAME',
  'VITE_APP_VERSION',
  'VITE_BACKEND_API_URL',
  'VITE_GOOGLE_MAPS_API_KEY', // Public API key with domain restrictions
  'VITE_SENTRY_DSN',
  'VITE_ANALYTICS_ID',
];

/**
 * Required environment variables for production
 */
const REQUIRED_PRODUCTION_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_BACKEND_API_URL',
];

/**
 * Required backend environment variables (documented for reference)
 */
const REQUIRED_BACKEND_VARS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
];

// ==================== Validation Functions ====================

class EnvValidator {
  private errors: EnvError[] = [];
  private warnings: EnvWarning[] = [];
  private criticalIssues: string[] = [];

  /**
   * Validate all environment variables
   */
  validate(): EnvValidationResult {
    this.errors = [];
    this.warnings = [];
    this.criticalIssues = [];

    // Check for exposed sensitive variables
    this.checkExposedSecrets();

    // Check for required variables
    this.checkRequiredVariables();

    // Check for missing security configurations
    this.checkSecurityConfig();

    // Check for development mode in production
    this.checkProductionReadiness();

    return {
      valid: this.errors.length === 0 && this.criticalIssues.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      criticalIssues: this.criticalIssues,
    };
  }

  /**
   * Check for API keys exposed with VITE_ prefix
   */
  private checkExposedSecrets(): void {
    const envVars = import.meta.env;

    for (const [key, value] of Object.entries(envVars)) {
      // Skip non-string values
      if (typeof value !== 'string') continue;

      // Check if it's a sensitive variable with VITE_ prefix
      const varNameWithoutVite = key.replace(/^VITE_/, '');

      if (SENSITIVE_VARIABLES.includes(varNameWithoutVite) && key.startsWith('VITE_')) {
        this.criticalIssues.push(
          `CRITICAL: ${key} is exposed client-side! This is a major security vulnerability.`
        );

        this.errors.push({
          variable: key,
          message: `API key ${key} is exposed in the browser bundle via VITE_ prefix`,
          severity: 'critical',
        });
      }

      // Check for patterns that look like API keys in VITE_ variables
      if (
        key.startsWith('VITE_') &&
        (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')) &&
        !PUBLIC_VARIABLES.includes(key)
      ) {
        this.warnings.push({
          variable: key,
          message: `Variable ${key} appears to contain sensitive data but is exposed client-side`,
          recommendation: `Remove VITE_ prefix and move to server-side only. Update code to use API proxy instead.`,
        });
      }

      // Check for actual secret-like values in VITE_ variables
      if (key.startsWith('VITE_') && this.looksLikeSecret(value as string)) {
        this.warnings.push({
          variable: key,
          message: `Value of ${key} appears to be a secret key or token`,
          recommendation: `Ensure this is a public key or remove the VITE_ prefix`,
        });
      }
    }
  }

  /**
   * Check if value looks like a secret
   */
  private looksLikeSecret(value: string): boolean {
    // Check for long random-looking strings
    if (value.length > 30 && /^[A-Za-z0-9_-]+$/.test(value)) {
      return true;
    }

    // Check for common secret patterns
    if (/^sk-[A-Za-z0-9]{32,}/.test(value)) return true; // OpenAI format
    if (/^AIza[A-Za-z0-9_-]{35}/.test(value)) return true; // Google API key
    if (/^xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24}/.test(value)) return true; // Slack bot token

    return false;
  }

  /**
   * Check for required variables
   */
  private checkRequiredVariables(): void {
    const envVars = import.meta.env;
    const mode = import.meta.env.MODE;

    // Check required variables based on environment
    if (mode === 'production') {
      for (const varName of REQUIRED_PRODUCTION_VARS) {
        if (!envVars[varName]) {
          this.errors.push({
            variable: varName,
            message: `Required production variable ${varName} is not set`,
            severity: 'high',
          });
        }
      }
    }

    // Check if backend API URL is configured
    if (!envVars.VITE_BACKEND_API_URL) {
      this.warnings.push({
        variable: 'VITE_BACKEND_API_URL',
        message: 'Backend API URL is not configured',
        recommendation:
          'Set VITE_BACKEND_API_URL to enable secure API proxying. Without this, API keys may be exposed client-side.',
      });
    }
  }

  /**
   * Check security configuration
   */
  private checkSecurityConfig(): void {
    const envVars = import.meta.env;

    // Check if HTTPS is enforced in production
    if (envVars.MODE === 'production' && envVars.VITE_BACKEND_API_URL) {
      const apiUrl = envVars.VITE_BACKEND_API_URL as string;
      if (apiUrl && !apiUrl.startsWith('https://')) {
        this.errors.push({
          variable: 'VITE_BACKEND_API_URL',
          message: 'Backend API URL must use HTTPS in production',
          severity: 'high',
        });
      }
    }

    // Check Supabase URL
    if (envVars.VITE_SUPABASE_URL) {
      const supabaseUrl = envVars.VITE_SUPABASE_URL as string;
      if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
        this.errors.push({
          variable: 'VITE_SUPABASE_URL',
          message: 'Supabase URL must use HTTPS',
          severity: 'high',
        });
      }
    }
  }

  /**
   * Check production readiness
   */
  private checkProductionReadiness(): void {
    const envVars = import.meta.env;

    if (envVars.MODE === 'production') {
      // Check if dev mode is enabled
      if (envVars.DEV === true || envVars.DEV === 'true') {
        this.errors.push({
          variable: 'DEV',
          message: 'Development mode is enabled in production build',
          severity: 'high',
        });
      }

      // Check for debug flags
      if (envVars.VITE_DEBUG === 'true' || envVars.VITE_DEBUG === true) {
        this.warnings.push({
          variable: 'VITE_DEBUG',
          message: 'Debug mode is enabled in production',
          recommendation: 'Disable debug mode for production deployments',
        });
      }
    }
  }

  /**
   * Get environment info summary
   */
  getEnvironmentInfo(): {
    mode: string;
    nodeEnv: string;
    hasBackendApi: boolean;
    exposedVars: string[];
  } {
    const envVars = import.meta.env;
    const exposedVars = Object.keys(envVars).filter((key) => key.startsWith('VITE_'));

    return {
      mode: envVars.MODE as string,
      nodeEnv: envVars.NODE_ENV as string,
      hasBackendApi: !!envVars.VITE_BACKEND_API_URL,
      exposedVars,
    };
  }
}

// ==================== Validation Runner ====================

/**
 * Run environment validation and log results
 */
export function validateEnvironment(options: {
  throwOnError?: boolean;
  logResults?: boolean;
} = {}): EnvValidationResult {
  const { throwOnError = false, logResults = true } = options;

  const validator = new EnvValidator();
  const result = validator.validate();

  if (logResults) {
    console.group('🔒 Environment Security Validation');

    // Log critical issues
    if (result.criticalIssues.length > 0) {
      console.error('❌ CRITICAL SECURITY ISSUES:');
      result.criticalIssues.forEach((issue) => console.error(`  - ${issue}`));
    }

    // Log errors
    if (result.errors.length > 0) {
      console.error(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach((error) => {
        console.error(`  [${error.severity.toUpperCase()}] ${error.variable}: ${error.message}`);
      });
    }

    // Log warnings
    if (result.warnings.length > 0) {
      console.warn(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.forEach((warning) => {
        console.warn(`  ${warning.variable}: ${warning.message}`);
        console.warn(`    → ${warning.recommendation}`);
      });
    }

    // Log success
    if (result.valid) {
      console.log('\n✅ Environment validation passed');
    }

    // Log environment info
    const envInfo = validator.getEnvironmentInfo();
    console.log('\nℹ️  Environment Info:');
    console.log(`  Mode: ${envInfo.mode}`);
    console.log(`  Backend API: ${envInfo.hasBackendApi ? 'Configured' : 'Not configured'}`);
    console.log(`  Exposed variables: ${envInfo.exposedVars.length}`);

    console.groupEnd();
  }

  if (throwOnError && !result.valid) {
    throw new Error(
      `Environment validation failed with ${result.errors.length} errors and ${result.criticalIssues.length} critical issues`
    );
  }

  return result;
}

/**
 * Check specific variable exposure
 */
export function checkVariableExposure(variableName: string): {
  exposed: boolean;
  safe: boolean;
  recommendation: string;
} {
  const isExposed = variableName.startsWith('VITE_');
  const isSensitive = SENSITIVE_VARIABLES.includes(variableName.replace(/^VITE_/, ''));
  const isPublic = PUBLIC_VARIABLES.includes(variableName);

  if (isExposed && isSensitive) {
    return {
      exposed: true,
      safe: false,
      recommendation: `Remove VITE_ prefix from ${variableName}. This variable contains sensitive data and should only be used server-side.`,
    };
  }

  if (isExposed && !isPublic) {
    return {
      exposed: true,
      safe: false,
      recommendation: `Variable ${variableName} is exposed client-side. Ensure it does not contain sensitive data.`,
    };
  }

  if (!isExposed && isPublic) {
    return {
      exposed: false,
      safe: true,
      recommendation: `Consider adding VITE_ prefix to ${variableName} if it's meant to be used client-side.`,
    };
  }

  return {
    exposed: isExposed,
    safe: true,
    recommendation: 'Variable configuration is correct.',
  };
}

/**
 * Get migration guide for exposed secrets
 */
export function getMigrationGuide(): string {
  return `
# API Key Exposure Migration Guide

## Critical Security Issue
Your application currently exposes API keys client-side via the VITE_ prefix.
This is a major security vulnerability that allows anyone to view your API keys
in the browser's developer tools or by inspecting the bundled JavaScript.

## Migration Steps

### 1. Update .env files
Remove VITE_ prefix from sensitive variables:

BEFORE (❌ INSECURE):
VITE_GEMINI_API_KEY=your-key-here
VITE_OPENAI_API_KEY=your-key-here

AFTER (✅ SECURE):
GEMINI_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here

### 2. Setup Backend API Proxy
Configure your backend API URL:
VITE_BACKEND_API_URL=https://your-backend.com/api

### 3. Update Code
Replace direct API calls with proxy calls:

BEFORE:
import { generateDailyBriefing } from './services/geminiService';
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const result = await generateDailyBriefing(apiKey, context);

AFTER:
import { apiProxyService } from './services/apiProxyService';
const result = await apiProxyService.geminiGenerateContent({
  model: 'gemini-2.5-flash',
  contents: context,
});

### 4. Implement Backend Endpoints
See docs/backend-api-endpoints.md for implementation guide.

### 5. Rotate Compromised Keys
If your API keys were previously exposed:
1. Generate new API keys from provider dashboards
2. Update your backend environment variables
3. Never commit API keys to version control
`;
}

// ==================== Export ====================

export const envValidator = new EnvValidator();

// Auto-validate on import in development
if (import.meta.env.DEV) {
  validateEnvironment({ throwOnError: false, logResults: true });
}
