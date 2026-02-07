/**
 * Multi-Factor Authentication (MFA) Service
 * Integrates with Supabase MFA to provide two-factor authentication
 * Supports TOTP (Time-based One-Time Password) via authenticator apps
 */

import { supabase } from './supabase';
import toast from 'react-hot-toast';

export interface MFAStatus {
  enabled: boolean;
  factors: MFAFactor[];
  hasRecoveryCodes: boolean;
}

export interface MFAFactor {
  id: string;
  type: 'totp';
  friendlyName: string;
  status: 'verified' | 'unverified';
  createdAt: Date;
}

export interface MFAEnrollment {
  id: string;
  type: 'totp';
  qrCode: string;
  secret: string;
  uri: string;
}

/**
 * Check if MFA is enabled for the current user
 */
export const getMFAStatus = async (): Promise<MFAStatus> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[MFA] No authenticated user:', userError);
      return {
        enabled: false,
        factors: [],
        hasRecoveryCodes: false,
      };
    }

    // Get all MFA factors for the user
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

    if (factorsError) {
      console.error('[MFA] Failed to list factors:', factorsError);
      return {
        enabled: false,
        factors: [],
        hasRecoveryCodes: false,
      };
    }

    // Convert Supabase factors to our format
    const mfaFactors: MFAFactor[] = (factors?.totp || []).map((factor: any) => ({
      id: factor.id,
      type: 'totp' as const,
      friendlyName: factor.friendly_name || 'Authenticator App',
      status: factor.factor_type === 'totp' && factor.status === 'verified' ? 'verified' : 'unverified',
      createdAt: new Date(factor.created_at),
    }));

    const hasVerifiedFactor = mfaFactors.some(f => f.status === 'verified');

    return {
      enabled: hasVerifiedFactor,
      factors: mfaFactors,
      hasRecoveryCodes: false, // Supabase doesn't provide recovery code status via API
    };
  } catch (error: any) {
    console.error('[MFA] Error getting MFA status:', error);
    return {
      enabled: false,
      factors: [],
      hasRecoveryCodes: false,
    };
  }
};

/**
 * Enroll in MFA - Generate QR code and secret for authenticator app
 */
export const enrollMFA = async (): Promise<MFAEnrollment | null> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      toast.error('No authenticated user found');
      return null;
    }

    // Check if user already has MFA enabled
    const status = await getMFAStatus();
    if (status.enabled) {
      toast.error('MFA is already enabled');
      return null;
    }

    // Enroll a new TOTP factor
    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });

    if (enrollError) {
      console.error('[MFA] Enrollment failed:', enrollError);
      toast.error('Failed to enroll in MFA: ' + enrollError.message);
      return null;
    }

    if (!enrollData) {
      toast.error('No enrollment data returned');
      return null;
    }

    // Generate QR code from the TOTP URI
    const { totp } = enrollData;
    if (!totp) {
      toast.error('No TOTP data available');
      return null;
    }

    return {
      id: enrollData.id,
      type: 'totp',
      qrCode: totp.qr_code || '',
      secret: totp.secret || '',
      uri: totp.uri || '',
    };
  } catch (error: any) {
    console.error('[MFA] Error enrolling MFA:', error);
    toast.error('Failed to enroll in MFA');
    return null;
  }
};

/**
 * Verify MFA enrollment with TOTP code
 */
export const verifyMFAEnrollment = async (factorId: string, code: string): Promise<boolean> => {
  try {
    // Challenge the factor to verify it
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      console.error('[MFA] Challenge failed:', challengeError);
      toast.error('Failed to create verification challenge');
      return false;
    }

    if (!challengeData) {
      toast.error('No challenge data returned');
      return false;
    }

    // Verify the code
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      console.error('[MFA] Verification failed:', verifyError);
      toast.error('Invalid verification code. Please try again.');
      return false;
    }

    if (verifyData) {
      toast.success('Two-factor authentication enabled successfully');
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('[MFA] Error verifying MFA:', error);
    toast.error('Failed to verify MFA code');
    return false;
  }
};

/**
 * Unenroll (disable) MFA
 */
export const unenrollMFA = async (factorId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (error) {
      console.error('[MFA] Unenrollment failed:', error);
      toast.error('Failed to disable MFA: ' + error.message);
      return false;
    }

    if (data) {
      toast.success('Two-factor authentication disabled');
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('[MFA] Error unenrolling MFA:', error);
    toast.error('Failed to disable MFA');
    return false;
  }
};

/**
 * Disable all MFA factors for the user
 */
export const disableAllMFA = async (): Promise<boolean> => {
  try {
    const status = await getMFAStatus();

    if (!status.enabled || status.factors.length === 0) {
      toast.error('MFA is not enabled');
      return false;
    }

    // Unenroll all factors
    let allSuccess = true;
    for (const factor of status.factors) {
      const success = await unenrollMFA(factor.id);
      if (!success) {
        allSuccess = false;
      }
    }

    if (allSuccess) {
      toast.success('All MFA factors disabled');
      return true;
    } else {
      toast.error('Some MFA factors could not be disabled');
      return false;
    }
  } catch (error: any) {
    console.error('[MFA] Error disabling all MFA:', error);
    toast.error('Failed to disable MFA');
    return false;
  }
};

/**
 * Verify MFA code during login
 */
export const verifyMFALogin = async (factorId: string, code: string): Promise<boolean> => {
  try {
    // Create challenge
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challengeData) {
      console.error('[MFA] Login challenge failed:', challengeError);
      return false;
    }

    // Verify code
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      console.error('[MFA] Login verification failed:', verifyError);
      toast.error('Invalid authentication code');
      return false;
    }

    return !!verifyData;
  } catch (error: any) {
    console.error('[MFA] Error verifying MFA login:', error);
    toast.error('Failed to verify authentication code');
    return false;
  }
};

/**
 * Get assurance level (AAL) - indicates if MFA is required
 * AAL1 = password only, AAL2 = password + MFA
 */
export const getAssuranceLevel = async (): Promise<{ currentLevel: string; nextLevel: string | null }> => {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      console.error('[MFA] Failed to get assurance level:', error);
      return { currentLevel: 'aal1', nextLevel: null };
    }

    return {
      currentLevel: data.currentLevel || 'aal1',
      nextLevel: data.nextLevel || null,
    };
  } catch (error) {
    console.error('[MFA] Error getting assurance level:', error);
    return { currentLevel: 'aal1', nextLevel: null };
  }
};

/**
 * Generate recovery codes (if supported by your Supabase instance)
 * Note: Recovery codes are not directly supported by Supabase Auth v2
 * You would need to implement this with a custom table
 */
export const generateRecoveryCodes = async (): Promise<string[]> => {
  // This is a placeholder - implement custom recovery code generation if needed
  toast.error('Recovery codes not yet implemented');
  return [];
};

export const mfaService = {
  getMFAStatus,
  enrollMFA,
  verifyMFAEnrollment,
  unenrollMFA,
  disableAllMFA,
  verifyMFALogin,
  getAssuranceLevel,
  generateRecoveryCodes,
};
