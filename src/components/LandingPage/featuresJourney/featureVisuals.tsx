import React from 'react';
import type { JourneyFeature, JourneyVisual } from '../landingData';

// ── Signature product visuals ──────────────────────────────────────────────
// React port of the `vis(f)` switch from features-gallery-lab-v2.html. Each
// visual is an abstract "device" frame so the journey reads as Pulse without
// shipping screenshots of unfinished UI. Accent colour comes from the CSS var
// `--accent` set per-cluster on the journey root, so a single component recolours
// automatically. (Per the brand-asset principle, these are honest abstractions of
// real surfaces — Relay waveform, Glimpse player, etc. — not generic filler.)

const Device: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="fj-device">
    <div className="fj-d-bar">
      <i /><i /><i />
      <span className="fj-d-title">Pulse · {title}</span>
    </div>
    <div className="fj-d-body">{children}</div>
  </div>
);

const Lines: React.FC<{ n: number; widths?: string[] }> = ({ n, widths = ['100%', '86%', '64%'] }) => (
  <>{Array.from({ length: n }, (_, i) => <div key={i} className="fj-line" style={{ width: widths[i % widths.length] }} />)}</>
);

// Relay's signature visual (hybrid A+B, chosen 2026-06-29): a Triage card whose
// top item is the *live* message — waveform + real-time transcript + AI summary —
// with the rest of the peer stream beneath. Makes "five peers, one stream" literal
// and shows the live transcription moment in one card. Peers + keystrokes mirror
// RELAY_PEERS / useRelayKeyboardShortcuts (T/D/C/B/N/L).
const RelayTriageVisual: React.FC = () => {
  const rows: { k: string; name: string; ctx: string; snippet: string; next: string; live?: boolean }[] = [
    { k: 'B', name: 'Broadcast', ctx: 'All-hands', snippet: '“Ship freeze starts Friday — read before EOD…”', next: 'Next: read' },
    { k: 'C', name: 'Channel', ctx: '#sales', snippet: '“Acme verbally agreed — looping legal @sam”', next: 'Tasked ✓' },
    { k: 'L', name: 'Live', ctx: 'Design room', snippet: '2 talking now · join or catch the replay', next: '● live', live: true },
  ];
  return (
    <div className="fj-triage">
      <div className="fj-triage-hd">
        <span className="fj-ping" /> Triage <small>· sorted by what needs you now</small>
        <span className="fj-kbd">T</span>
      </div>
      {/* Featured live message */}
      <div className="fj-tfeat">
        <div className="fj-tfeat-hd">
          <div className="fj-tbadge fj-on">D</div>
          <div>
            <div className="fj-tname">Direct <small>· Dana K.</small></div>
            <div className="fj-tsub">recording now</div>
          </div>
          <span className="fj-pill"><span className="fj-ping" />Live · transcribing</span>
        </div>
        <div className="fj-bigwave">
          {Array.from({ length: 18 }, (_, i) => <b key={i} style={{ animationDelay: `${(i * 0.045).toFixed(3)}s` }} />)}
        </div>
        <div className="fj-tx">“Sure, I can take the Tuesday demo — pulling the deck now<span className="fj-cursor" />”</div>
        <div className="fj-summary">
          <b>AI&nbsp;summary</b>
          <span>Next action: <span style={{ color: 'var(--fj-ink)' }}>confirm + share deck.</span></span>
          <button type="button" className="fj-replybtn" tabIndex={-1} aria-hidden="true">Reply →</button>
        </div>
      </div>
      {/* Rest of the Triage stream */}
      {rows.map(r => (
        <div className="fj-trow" key={r.k}>
          <div className="fj-tbadge">{r.k}</div>
          <div className="fj-tmain">
            <div className="fj-tname">{r.name} <small>· {r.ctx}</small></div>
            <div className="fj-tsnippet">{r.snippet}</div>
          </div>
          <span className={`fj-tnext${r.live ? ' fj-live-chip' : ''}`}>{r.next}</span>
        </div>
      ))}
    </div>
  );
};

function renderVisual(visual: JourneyVisual, eyebrow: string): React.ReactNode {
  switch (visual) {
    case 'wave':
      return <RelayTriageVisual />;
    case 'play':
      return (
        <Device title={eyebrow}>
          <div className="fj-play"><span className="fj-tri" /></div>
          <div className="fj-scrub"><b /></div>
          <span className="fj-pill">0:30 · transcript ready</span>
          <Lines n={2} />
        </Device>
      );
    case 'chat':
      return (
        <Device title={eyebrow}>
          <div className="fj-bub fj-them">Can you take the Tuesday demo?</div>
          <div className="fj-bub fj-me">On it — pulling the deck now <b style={{ color: 'var(--accent)' }}>@dana</b></div>
          <div className="fj-bub fj-them">Mirrored to #sales in Slack ✓</div>
        </Device>
      );
    case 'research':
      return (
        <Device title={eyebrow}>
          <div className="fj-bub fj-me" style={{ fontFamily: 'var(--fj-body)' }}><b style={{ color: 'var(--accent)' }}>/research</b> competitor pricing</div>
          <span className="fj-pill"><span className="fj-ping" />Synthesizing · 6 sources</span>
          <div className="fj-rowx">
            <div className="fj-av" />
            <div style={{ flex: 1 }}><Lines n={1} widths={['82%']} /></div>
            <span className="fj-chip">cited</span>
          </div>
          <Lines n={2} />
        </Device>
      );
    case 'list': {
      const items: [string, string][] = [['Ship pricing page', 'Dana · Fri'], ['Approve Q3 budget', 'You · Today'], ['Renew Acme contract', 'Sam · Mon']];
      return (
        <Device title={eyebrow}>
          {items.map(([t, m], i) => (
            <div className="fj-rowx" key={t}>
              <div style={{ width: 18, height: 18, borderRadius: 6, border: '2px solid var(--accent)', background: i === 1 ? 'var(--accent)' : undefined }} />
              <div style={{ flex: 1, fontSize: 13, color: 'var(--fj-ink)' }}>{t}</div>
              <span className="fj-chip" style={{ background: 'none', borderColor: 'var(--fj-line)' }}>{m}</span>
            </div>
          ))}
        </Device>
      );
    }
    case 'chart': {
      const h = [44, 68, 52, 82, 60, 96, 74];
      return (
        <Device title={eyebrow}>
          <div className="fj-bars">{h.map((v, i) => <b key={i} style={{ height: `${v}%` }} />)}</div>
          <div className="fj-rowx">
            <span className="fj-chip">▲ 24% velocity</span>
            <span className="fj-muted">last 30 days</span>
          </div>
        </Device>
      );
    }
    case 'cards': {
      const rows: [string, string][] = [['Acme Co', 'warm'], ['Globex', 'cooling'], ['Initech', 'at risk']];
      return (
        <Device title={eyebrow}>
          {rows.map(([n, s]) => (
            <div className="fj-rowx" key={n}>
              <div className="fj-av" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--fj-ink)', fontWeight: 600 }}>{n}</div>
                <div className="fj-line" style={{ width: '55%', marginTop: 5 }} />
              </div>
              <span className="fj-chip">{s} · health</span>
            </div>
          ))}
        </Device>
      );
    }
    case 'cal': {
      const on = [3, 9, 11, 17, 22];
      return (
        <Device title={eyebrow}>
          <div className="fj-caldow">{'SMTWTFS'.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="fj-cal">
            {Array.from({ length: 28 }, (_, i) => <i key={i} className={on.includes(i) ? 'fj-on' : undefined} />)}
          </div>
          <span className="fj-pill">Focus block protected · 2–4pm</span>
        </Device>
      );
    }
    case 'map':
      return (
        <Device title={eyebrow}>
          <div className="fj-map">
            <span className="fj-pin" style={{ left: '24%', top: '36%' }} />
            <span className="fj-pin" style={{ left: '62%', top: '26%' }} />
            <span className="fj-pin" style={{ left: '48%', top: '64%' }} />
          </div>
          <div className="fj-rowx">
            <span className="fj-chip"><span className="fj-ping" style={{ display: 'inline-block' }} /> Sam · ETA 7 min</span>
            <span className="fj-muted">geofence: HQ</span>
          </div>
        </Device>
      );
    case 'grid':
      return (
        <Device title={eyebrow}>
          <div className="fj-grid4">
            {['Acme', 'Internal', 'Glassroots', 'Q3 Launch'].map(n => (
              <div key={n}><span />{n}</div>
            ))}
          </div>
        </Device>
      );
    default:
      return <Device title={eyebrow}><Lines n={4} /></Device>;
  }
}

const FeatureVisual: React.FC<{ feature: JourneyFeature }> = ({ feature }) => (
  <>{renderVisual(feature.visual, feature.eyebrow)}</>
);

export default FeatureVisual;
