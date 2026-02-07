# Session Management & MFA Usage Examples

## Quick Start Guide

### 1. Session Management

#### Get All Active Sessions
```typescript
import { sessionService } from './services/sessionService';

// Load all active sessions for the current user
const sessions = await sessionService.getAllSessions();

sessions.forEach(session => {
  console.log('Device:', session.device);          // "Windows PC", "iPhone", etc.
  console.log('Browser:', session.browser);        // "Chrome 131", "Safari", etc.
  console.log('Location:', session.location);      // "New York, US"
  console.log('Last Active:', session.lastActive); // Date object
  console.log('Current:', session.current);        // true if current session
});
```

#### Revoke a Specific Session
```typescript
// Sign out from a specific device
const success = await sessionService.revokeSession(sessionId);

if (success) {
  console.log('Session revoked successfully');
  toast.success('Signed out from that device');
}
```

#### Sign Out All Other Devices
```typescript
// Keep current device logged in, sign out all others
const success = await sessionService.signOutAllOtherDevices();

if (success) {
  console.log('Signed out of all other devices');
  toast.success('You remain logged in on this device');
}
```

#### Get Session Statistics
```typescript
const stats = await sessionService.getSessionStats();

console.log('Total sessions:', stats.totalSessions);
console.log('Active sessions:', stats.activeSessions);
console.log('Last login:', stats.lastLogin);
```

---

### 2. Multi-Factor Authentication

#### Check MFA Status
```typescript
import { mfaService } from './services/mfaService';

const status = await mfaService.getMFAStatus();

console.log('MFA Enabled:', status.enabled);
console.log('Number of factors:', status.factors.length);

if (status.enabled) {
  status.factors.forEach(factor => {
    console.log('Factor ID:', factor.id);
    console.log('Type:', factor.type);              // "totp"
    console.log('Name:', factor.friendlyName);      // "Authenticator App"
    console.log('Status:', factor.status);          // "verified"
    console.log('Created:', factor.createdAt);
  });
}
```

#### Enable MFA (Enrollment Flow)
```typescript
// Step 1: Start enrollment
const enrollment = await mfaService.enrollMFA();

if (enrollment) {
  // Display QR code to user
  console.log('QR Code:', enrollment.qrCode);     // Data URI for QR code image
  console.log('Secret:', enrollment.secret);       // Manual entry code
  console.log('URI:', enrollment.uri);             // otpauth:// URI

  // Step 2: User scans QR code with authenticator app
  // Step 3: User enters 6-digit code from app
  const code = '123456'; // From user input

  // Step 4: Verify the code
  const verified = await mfaService.verifyMFAEnrollment(enrollment.id, code);

  if (verified) {
    console.log('MFA enabled successfully!');
    toast.success('Two-factor authentication enabled');
  }
}
```

#### Disable MFA
```typescript
// Get current factors
const status = await mfaService.getMFAStatus();

if (status.enabled && status.factors.length > 0) {
  // Unenroll the first factor
  const success = await mfaService.unenrollMFA(status.factors[0].id);

  if (success) {
    console.log('MFA disabled');
    toast.success('Two-factor authentication disabled');
  }
}

// Or disable all factors at once
const success = await mfaService.disableAllMFA();
```

#### Verify MFA During Login
```typescript
// During login flow, if user has MFA enabled
const factors = await mfaService.getMFAStatus();

if (factors.enabled) {
  // Prompt user for 6-digit code
  const code = prompt('Enter your 2FA code:');

  // Verify the code
  const verified = await mfaService.verifyMFALogin(
    factors.factors[0].id,
    code
  );

  if (verified) {
    console.log('Login successful!');
    // Proceed with login
  } else {
    console.log('Invalid code');
    // Show error, ask to retry
  }
}
```

---

### 3. Privacy Dashboard Integration

#### Load Security Data
```typescript
import { sessionService } from './services/sessionService';
import { mfaService } from './services/mfaService';

const loadSecurityData = async () => {
  // Load sessions
  const sessions = await sessionService.getAllSessions();
  setSessions(sessions);

  // Load MFA status
  const mfaStatus = await mfaService.getMFAStatus();
  setMfaStatus(mfaStatus);

  console.log('Security data loaded');
};
```

#### Handle Session Revocation
```typescript
const handleRevokeSession = async (sessionId: string) => {
  const session = sessions.find(s => s.id === sessionId);

  // Confirm action
  const confirmed = confirm(`Sign out from ${session.device}?`);
  if (!confirmed) return;

  // Revoke session
  const success = await sessionService.revokeSession(sessionId);

  if (success) {
    // Refresh session list
    await loadSecurityData();
    toast.success('Session revoked');
  }
};
```

#### Handle MFA Setup
```typescript
const [mfaEnrollment, setMfaEnrollment] = useState<MFAEnrollment | null>(null);
const [mfaCode, setMfaCode] = useState('');

// Step 1: Start enrollment
const handleEnableMFA = async () => {
  const enrollment = await mfaService.enrollMFA();

  if (enrollment) {
    setMfaEnrollment(enrollment);
    setShowMfaSetupModal(true);
  }
};

// Step 2: Verify code
const handleVerifyMFA = async () => {
  if (!mfaEnrollment || !mfaCode) return;

  const success = await mfaService.verifyMFAEnrollment(
    mfaEnrollment.id,
    mfaCode
  );

  if (success) {
    setShowMfaSetupModal(false);
    setMfaEnrollment(null);
    setMfaCode('');
    await loadSecurityData();
  }
};
```

---

### 4. React Component Examples

#### Session List Component
```tsx
import { sessionService, UserSession } from './services/sessionService';

const SessionList = () => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const data = await sessionService.getAllSessions();
    setSessions(data);
    setLoading(false);
  };

  const handleRevoke = async (sessionId: string) => {
    if (!confirm('Revoke this session?')) return;

    const success = await sessionService.revokeSession(sessionId);
    if (success) {
      await loadSessions();
    }
  };

  return (
    <div className="space-y-4">
      <h2>Active Sessions</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        sessions.map(session => (
          <div key={session.id} className="border p-4 rounded">
            <div className="flex justify-between items-start">
              <div>
                <h3>{session.device}</h3>
                <p>{session.browser}</p>
                <p>{session.location}</p>
                <p>Last active: {session.lastActive.toLocaleString()}</p>
              </div>
              {session.current ? (
                <span className="badge">Current</span>
              ) : (
                <button onClick={() => handleRevoke(session.id)}>
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
```

#### MFA Setup Modal Component
```tsx
import { mfaService, MFAEnrollment } from './services/mfaService';

const MFASetupModal = ({ isOpen, onClose }) => {
  const [enrollment, setEnrollment] = useState<MFAEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    const data = await mfaService.enrollMFA();
    setEnrollment(data);
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!enrollment || code.length !== 6) return;

    setLoading(true);
    const success = await mfaService.verifyMFAEnrollment(enrollment.id, code);
    setLoading(false);

    if (success) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen && !enrollment) {
      handleEnroll();
    }
  }, [isOpen]);

  if (!isOpen || !enrollment) return null;

  return (
    <div className="modal">
      <h2>Set Up Two-Factor Authentication</h2>

      {/* QR Code */}
      <img src={enrollment.qrCode} alt="QR Code" />

      {/* Manual Entry */}
      <p>Or enter this code manually:</p>
      <code>{enrollment.secret}</code>

      {/* Verification */}
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.slice(0, 6))}
        placeholder="000000"
        maxLength={6}
      />

      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading ? 'Verifying...' : 'Verify & Enable'}
        </button>
      </div>
    </div>
  );
};
```

---

### 5. Error Handling Examples

#### Handling Session Errors
```typescript
try {
  const sessions = await sessionService.getAllSessions();
  console.log('Sessions loaded:', sessions.length);
} catch (error) {
  console.error('Failed to load sessions:', error);
  toast.error('Unable to load session information');
}
```

#### Handling MFA Errors
```typescript
try {
  const enrollment = await mfaService.enrollMFA();

  if (!enrollment) {
    throw new Error('MFA enrollment failed');
  }

  // Proceed with enrollment
} catch (error) {
  console.error('MFA error:', error);

  if (error.message.includes('already enabled')) {
    toast.error('2FA is already enabled on your account');
  } else {
    toast.error('Failed to set up 2FA. Please try again.');
  }
}
```

---

### 6. Advanced Usage

#### Custom Session Tracking (with custom table)
```typescript
// After creating the custom user_sessions table

import { supabase } from './services/supabase';

// Track session on login
const trackSession = async (userId: string, sessionToken: string) => {
  const userAgent = navigator.userAgent;
  const { device, browser } = parseUserAgent(userAgent);

  await supabase.from('user_sessions').insert({
    user_id: userId,
    access_token_prefix: sessionToken.substring(0, 16),
    device_name: device,
    browser_name: browser,
    user_agent: userAgent,
  });
};

// Get all user sessions
const getAllUserSessions = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_active_at', { ascending: false });

  if (error) throw error;
  return data;
};

// Revoke specific session
const revokeSessionById = async (sessionId: string) => {
  const { error } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('id', sessionId);

  if (error) throw error;
};
```

#### MFA with Recovery Codes (custom implementation)
```typescript
// Generate recovery codes
const generateRecoveryCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

// Store hashed codes in database
const storeRecoveryCodes = async (userId: string, codes: string[]) => {
  const bcrypt = await import('bcryptjs');

  const hashedCodes = await Promise.all(
    codes.map(code => bcrypt.hash(code, 10))
  );

  await supabase.from('mfa_recovery_codes').insert(
    hashedCodes.map(hash => ({
      user_id: userId,
      code_hash: hash,
      used: false,
    }))
  );
};
```

---

### 7. Testing Examples

#### Unit Testing Sessions
```typescript
import { describe, it, expect, vi } from 'vitest';
import { sessionService } from './sessionService';

describe('Session Service', () => {
  it('should load active sessions', async () => {
    const sessions = await sessionService.getAllSessions();
    expect(sessions).toBeDefined();
    expect(Array.isArray(sessions)).toBe(true);
  });

  it('should identify current session', async () => {
    const sessions = await sessionService.getAllSessions();
    const currentSession = sessions.find(s => s.current);
    expect(currentSession).toBeDefined();
  });

  it('should parse user agent correctly', async () => {
    const sessions = await sessionService.getAllSessions();
    const session = sessions[0];

    expect(session.device).toBeDefined();
    expect(session.browser).toBeDefined();
    expect(session.device).not.toBe('Unknown Device');
  });
});
```

#### Integration Testing MFA
```typescript
import { describe, it, expect } from 'vitest';
import { mfaService } from './mfaService';

describe('MFA Service', () => {
  it('should check MFA status', async () => {
    const status = await mfaService.getMFAStatus();
    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('factors');
  });

  it('should enroll in MFA', async () => {
    const enrollment = await mfaService.enrollMFA();

    if (enrollment) {
      expect(enrollment).toHaveProperty('qrCode');
      expect(enrollment).toHaveProperty('secret');
      expect(enrollment.secret).toMatch(/^[A-Z2-7]+$/);
    }
  });
});
```

---

## Common Patterns

### Pattern 1: Protected Route with MFA Check
```typescript
const ProtectedRoute = ({ children }) => {
  const [mfaVerified, setMfaVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkMFA();
  }, []);

  const checkMFA = async () => {
    const status = await mfaService.getMFAStatus();

    if (status.enabled) {
      const aal = await mfaService.getAssuranceLevel();

      if (aal.nextLevel === 'aal2') {
        // Need to verify MFA
        setMfaVerified(false);
      } else {
        setMfaVerified(true);
      }
    } else {
      setMfaVerified(true);
    }

    setLoading(false);
  };

  if (loading) return <Spinner />;

  if (!mfaVerified) {
    return <MFAVerificationModal onVerified={() => setMfaVerified(true)} />;
  }

  return children;
};
```

### Pattern 2: Session Monitoring
```typescript
const useSessionMonitoring = () => {
  useEffect(() => {
    const interval = setInterval(async () => {
      await sessionService.updateSessionActivity();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);
};
```

### Pattern 3: Security Dashboard
```typescript
const SecurityDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [mfaStatus, setMfaStatus] = useState(null);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    const [sessionData, mfaData] = await Promise.all([
      sessionService.getAllSessions(),
      mfaService.getMFAStatus(),
    ]);

    setSessions(sessionData);
    setMfaStatus(mfaData);
  };

  return (
    <div>
      <SessionList sessions={sessions} onRevoke={loadSecurityData} />
      <MFASettings status={mfaStatus} onUpdate={loadSecurityData} />
    </div>
  );
};
```

---

## Best Practices

1. **Always check authentication before session operations**
2. **Use toast notifications for user feedback**
3. **Implement confirmation dialogs for destructive actions**
4. **Handle errors gracefully with fallback UI**
5. **Test with multiple browsers and devices**
6. **Keep QR codes secure (don't log them)**
7. **Validate 6-digit codes before submission**
8. **Provide clear instructions for authenticator apps**
9. **Monitor for suspicious session activity**
10. **Implement rate limiting for MFA attempts**

---

**Last Updated**: 2026-02-06
