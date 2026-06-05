/**
 * AudioDeviceSettings — mic + speaker picker with a LIVE input meter for the
 * realtime voice agent (War Room Live + Summit).
 *
 * Why this exists: the session acquires the *system default* mic with no
 * deviceId, and the in-session level meter only lights up AFTER the server
 * detects speech — so a working mic on the wrong default device looks dead and
 * the user has no way to choose another. This panel:
 *   - enumerates audioinput / audiooutput devices (labels need mic permission,
 *     which the test meter grants),
 *   - lets the user pick mic + speaker (persisted via audioDevicePrefs),
 *   - runs a LOCAL analyser meter on the chosen mic so the user can SEE input
 *     before connecting (suppressed once a live session owns the mic),
 *   - reports the choice up via onSelect so a live session can switch on the fly.
 *
 * Fully additive: renders nothing destructive, owns its own getUserMedia which
 * it tears down on collapse / unmount / connect.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Mic } from 'lucide-react';
import {
  getPreferredInputDevice,
  getPreferredOutputDevice,
  setPreferredInputDevice,
  setPreferredOutputDevice,
} from '../../services/audioDevicePrefs';
import './AudioDeviceSettings.css';

// setSinkId (output routing) is Chromium-only; hide the speaker picker elsewhere.
const SUPPORTS_SINK_ID =
  typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

interface AudioDeviceSettingsProps {
  /** True while a live voice session owns the mic. Suppresses the local test
   *  meter (avoids double-capturing the device) but keeps the pickers usable. */
  connected?: boolean;
  /** Fired after a pick (persistence already done) so a live session can switch
   *  the device immediately. */
  onSelect?: (kind: 'input' | 'output', deviceId: string) => void;
  defaultExpanded?: boolean;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--pulse-ink-3)',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '6px 8px',
  borderRadius: 8,
  background: 'var(--pulse-surface-2, rgba(255,255,255,0.06))',
  color: 'var(--pulse-ink)',
  border: '1px solid var(--pulse-border)',
  cursor: 'pointer',
};

export const AudioDeviceSettings: React.FC<AudioDeviceSettingsProps> = ({
  connected = false,
  onSelect,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>(() => getPreferredInputDevice() || '');
  const [selectedOutput, setSelectedOutput] = useState<string>(() => getPreferredOutputDevice() || '');
  const [level, setLevel] = useState(0);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputs(devices.filter((d) => d.kind === 'audioinput'));
      setOutputs(devices.filter((d) => d.kind === 'audiooutput'));
    } catch (e) {
      console.warn('[AudioDeviceSettings] enumerateDevices failed', e);
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    stopMeter();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInput ? { deviceId: { exact: selectedInput } } : true,
      });
      streamRef.current = stream;
      setPermission('granted');

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(1, avg / 140));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Device labels are blank until permission is granted — refresh now.
      refreshDevices();
    } catch (e) {
      if ((e as DOMException)?.name === 'NotAllowedError') setPermission('denied');
      console.warn('[AudioDeviceSettings] mic test failed', e);
    }
  }, [selectedInput, stopMeter, refreshDevices]);

  // Enumerate on mount + whenever the device set changes (plug/unplug).
  useEffect(() => {
    refreshDevices();
    const md = navigator.mediaDevices;
    md.addEventListener?.('devicechange', refreshDevices);
    return () => md.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);

  // Run the local test meter only while expanded AND no live session owns the
  // mic (re-runs when the selected input changes).
  useEffect(() => {
    if (expanded && !connected) startMeter();
    else stopMeter();
    return stopMeter;
  }, [expanded, connected, selectedInput, startMeter, stopMeter]);

  const handleInput = (id: string) => {
    setSelectedInput(id);
    setPreferredInputDevice(id || undefined);
    onSelect?.('input', id);
  };
  const handleOutput = (id: string) => {
    setSelectedOutput(id);
    setPreferredOutputDevice(id || undefined);
    onSelect?.('output', id);
  };

  const meterActive = level > 0.04;

  return (
    <div style={{ width: '100%', maxWidth: 460, margin: '0 auto', fontFamily: 'var(--pulse-font-mono)' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--pulse-ink-3)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Mic size={12} /> Audio devices
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 2px 2px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Microphone</label>
            <select className="audio-device-select" value={selectedInput} onChange={(e) => handleInput(e.target.value)} style={selectStyle}>
              <option value="">System default</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>

          {!connected && (
            <div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'var(--pulse-surface-2, rgba(255,255,255,0.08))',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(level * 100)}%`,
                    background: meterActive ? 'var(--pulse-tone-positive)' : 'var(--pulse-ink-3)',
                    transition: 'width 80ms linear',
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: meterActive ? 'var(--pulse-tone-positive)' : 'var(--pulse-ink-3)', marginTop: 4 }}>
                {permission === 'denied'
                  ? 'Mic blocked — allow microphone access in your browser, then reopen.'
                  : meterActive
                  ? 'Mic is picking up sound ✓'
                  : 'Speak to test your mic…'}
              </div>
            </div>
          )}

          {SUPPORTS_SINK_ID && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Speaker</label>
              <select className="audio-device-select" value={selectedOutput} onChange={(e) => handleOutput(e.target.value)} style={selectStyle}>
                <option value="">System default</option>
                {outputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
