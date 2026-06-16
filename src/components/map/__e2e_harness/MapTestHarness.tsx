// ─────────────────────────────────────────────────────────────────────────────
// MapTestHarness — DEV-ONLY E2E mount point for the Map section's dialogs and
// reorder strip. Bypasses auth, Supabase, and the Google Maps JS API loader by
// mounting each component in isolation with deterministic seed data.
//
// Activation: navigate to `/?e2eHarness=map&mode=<surface>` while running the
// dev server. Guarded by `import.meta.env.DEV` in main.tsx — never reachable
// in production builds.
//
// Surfaces:
//   - picker   → BroadcastRecipientPicker standalone
//   - imat     → ImAtFAB with seeded userPosition
//   - live     → LiveBroadcastSheet standalone
//   - reorder  → AiStrip pre-seeded into `aiState.status = 'reordering'`
//
// This file lives under `src/` (not `e2e/`) so Vite's module graph resolves
// the cross-package imports without extra config. Removing the harness leaves
// no production trace because `main.tsx` only mounts it under DEV.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Contact } from '../../../types';
import BroadcastRecipientPicker from '../sub/BroadcastRecipientPicker';
import ImAtFAB from '../sub/ImAtFAB';
import { AiStrip, LiveBroadcastSheet, type AiState } from '../PulseMapView';

const SEED_CONTACTS: Contact[] = [
  {
    id: 'c1', name: 'Ada Lovelace', role: 'Engineer', avatarColor: '#f43f5e',
    status: 'online', email: 'ada@example.com', source: 'local',
    pulseUserId: 'u-ada', homeLat: 37.7749, homeLng: -122.4194,
  },
  {
    id: 'c2', name: 'Grace Hopper', role: 'Architect', avatarColor: '#10b981',
    status: 'online', email: 'grace@example.com', source: 'local',
    pulseUserId: 'u-grace', workLat: 37.7858, workLng: -122.4064,
  },
  {
    id: 'c3', name: 'Linus Torvalds', role: 'Maintainer', avatarColor: '#3b82f6',
    status: 'busy', email: 'linus@example.com', source: 'local',
    pulseUserId: 'u-linus', homeLat: 37.7849, homeLng: -122.4094,
  },
  {
    // Non-Pulse contact — should be filtered out by the picker.
    id: 'c4', name: 'Anonymous Coward', role: '', avatarColor: '#6b7280',
    status: 'offline', email: 'anon@example.com', source: 'local',
    homeLat: 37.7649, homeLng: -122.4294,
  },
];

const SEED_STOPS = [
  { id: 'c1-home', label: 'Ada Lovelace · Home' },
  { id: 'c2-work', label: 'Grace Hopper · Work' },
  { id: 'c3-home', label: 'Linus Torvalds · Home' },
];

const SEED_USER_POSITION = { lat: 37.7749, lng: -122.4194 };

type HarnessMode = 'picker' | 'imat' | 'live' | 'reorder' | 'ai';

function getMode(): HarnessMode {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('mode');
  if (raw === 'picker' || raw === 'imat' || raw === 'live' || raw === 'reorder' || raw === 'ai') return raw;
  return 'picker';
}

// Direction D (P4) deterministic AI proposals — seeds the three strip kinds with
// the previously-dead focusDate / focusId fields populated + horizon='now' so the
// affordances + NEXT-STOP framing render without a live model or pinned contacts.
const AI_ROUTE_NOW: AiState = {
  status: 'ready',
  data: { kind: 'route', proposal: { orderedIds: ['c1-home', 'c2-work'], summary: 'Ada now, then Grace, 12 min.', rationale: 'Tighter loop from your position.' } },
};
const AI_PLAN_FOCUSDATE: AiState = {
  status: 'ready',
  data: { kind: 'plan', proposal: { summary: 'Wednesday has 3 in Berkeley, batch them.', focusDate: '2026-06-17' } },
};
const AI_INSIGHT_FOCUSID: AiState = {
  status: 'ready',
  data: { kind: 'insight', proposal: { summary: '3 in Oakland you have not talked to in 30+ days.', focusId: 'c3' } },
};

const MapTestHarness: React.FC = () => {
  const mode = getMode();
  // Dialogs ALWAYS start closed — the test opens them via the trigger button
  // so focus restoration can be verified against the trigger that owned focus
  // before mount. Auto-opening would skip that path.
  const [showPicker, setShowPicker] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [pickerResult, setPickerResult] = useState<string[] | null>(null);
  const [aiState, setAiState] = useState<AiState>(
    mode === 'reorder'
      ? { status: 'reordering', orderedIds: SEED_STOPS.map(s => s.id), baseProposal: { orderedIds: SEED_STOPS.map(s => s.id), summary: 'Seeded order.' } }
      : { status: 'idle' },
  );
  const [accepted, setAccepted] = useState(false);
  // P4 affordance result — proves the focus/jump handlers actually fire.
  const [aiResult, setAiResult] = useState<string | null>(null);

  return (
    <div className="pulse-map-section" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Toaster position="bottom-center" />

      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 14, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Map test harness — mode: {mode}
        </h1>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          DEV-ONLY. Not reachable in production builds.
        </p>

        {/* Trigger row — provides the "previous focus owner" so useDialogA11y
            can restore focus correctly after Esc / Cancel / Confirm. */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {mode === 'picker' && (
            <button
              type="button"
              data-testid="open-broadcast-picker"
              onClick={() => setShowPicker(true)}
              style={triggerBtnStyle}
            >
              Open broadcast picker
            </button>
          )}
          {mode === 'live' && (
            <button
              type="button"
              data-testid="open-live-sheet"
              onClick={() => setShowLive(true)}
              style={triggerBtnStyle}
            >
              Open live broadcast sheet
            </button>
          )}
        </div>

        {pickerResult && (
          <pre data-testid="picker-result" style={{ marginTop: 16, fontSize: 12 }}>
            {JSON.stringify(pickerResult)}
          </pre>
        )}
        {accepted && (
          <pre data-testid="reorder-accept-result" style={{ marginTop: 16, fontSize: 12 }}>
            accepted
          </pre>
        )}
      </div>

      {/* Reorder strip — pre-seeded `reordering` state so the keyboard nav can
          be exercised without needing a real AI proposal. */}
      {mode === 'reorder' && (
        <div data-testid="ai-strip-container" style={{ position: 'absolute', top: 80, left: 0, right: 0 }}>
          <AiStrip
            lens="today"
            markerCount={SEED_STOPS.length}
            aiState={aiState}
            acceptedRoute={null}
            acceptingRoute={false}
            isDarkMode={false}
            stops={SEED_STOPS}
            onAccept={() => setAccepted(true)}
            onDismissRoute={() => {}}
            onOpenInSystemMaps={() => {}}
            onReorderStart={() => {}}
            onReorderChange={(orderedIds) => {
              setAiState(prev => prev.status === 'reordering' ? { ...prev, orderedIds } : prev);
            }}
            onReorderCancel={() => setAiState({ status: 'idle' })}
          />
        </div>
      )}

      {/* Direction D (P4) AI affordances — three seeded strips proving the
          NEXT-STOP framing (horizon='now') + the focusDate / focusId affordances
          render and their handlers fire. Deterministic; no live model. */}
      {mode === 'ai' && (
        <div data-testid="ai-affordances" style={{ position: 'absolute', top: 80, left: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div data-testid="ai-route-now">
            <AiStrip
              lens="today" horizon="now" markerCount={2}
              aiState={AI_ROUTE_NOW} acceptedRoute={null} acceptingRoute={false}
              isDarkMode={false} stops={SEED_STOPS}
              onAccept={() => {}} onDismissRoute={() => {}} onOpenInSystemMaps={() => {}}
              onReorderStart={() => {}} onReorderChange={() => {}} onReorderCancel={() => {}}
            />
          </div>
          <div data-testid="ai-plan-focusdate">
            <AiStrip
              lens="week" markerCount={3}
              aiState={AI_PLAN_FOCUSDATE} acceptedRoute={null} acceptingRoute={false}
              isDarkMode={false} stops={SEED_STOPS}
              onAccept={() => {}} onDismissRoute={() => {}} onOpenInSystemMaps={() => {}}
              onReorderStart={() => {}} onReorderChange={() => {}} onReorderCancel={() => {}}
              onJumpToDate={(d) => setAiResult('jump:' + d)}
            />
          </div>
          <div data-testid="ai-insight-focusid">
            <AiStrip
              lens="atlas" markerCount={3}
              aiState={AI_INSIGHT_FOCUSID} acceptedRoute={null} acceptingRoute={false}
              isDarkMode={false} stops={SEED_STOPS}
              onAccept={() => {}} onDismissRoute={() => {}} onOpenInSystemMaps={() => {}}
              onReorderStart={() => {}} onReorderChange={() => {}} onReorderCancel={() => {}}
              onFocusEntity={(id) => setAiResult('focus:' + id)}
            />
          </div>
          {aiResult && <pre data-testid="ai-affordance-result" style={{ fontSize: 12, padding: 8 }}>{aiResult}</pre>}
        </div>
      )}

      {/* ImAtFAB — needs userPosition to render at all. The component itself
          hides if userPosition is null, so the test never sees a dead FAB. */}
      {mode === 'imat' && (
        <ImAtFAB
          userPosition={SEED_USER_POSITION}
          contacts={SEED_CONTACTS}
          isDarkMode={false}
          onSend={() => { /* test asserts on the FAB DOM, not the send. */ }}
        />
      )}

      {showPicker && (
        <BroadcastRecipientPicker
          contacts={SEED_CONTACTS}
          isDarkMode={false}
          onCancel={() => setShowPicker(false)}
          onConfirm={(ids) => { setPickerResult(ids); setShowPicker(false); }}
        />
      )}

      {showLive && (
        <LiveBroadcastSheet
          contacts={SEED_CONTACTS}
          liveLocations={new Map()}
          isDarkMode={false}
          onClose={() => setShowLive(false)}
          onContactAction={() => {}}
        />
      )}
    </div>
  );
};

const triggerBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  background: '#f43f5e',
  color: 'white',
  border: 'none',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export default MapTestHarness;
