/**
 * Pulse hero — "Propagation Mesh" 3D field.
 *
 * A spherical network of signal nodes (rose→violet by depth) threaded with a
 * faint structural lattice, plus bright rose "ping" strands that draw themselves
 * from one node to the next. An intermittent heartbeat sends a slow wavefront
 * rippling outward, lighting nodes as it passes, then settling back to a calm
 * rest. Ported from the qntmecos Pulse engine and the hero visual 3D lab
 * (`_design-playground/hero-visual-3d-lab.html`); the TUNE below is Frank's
 * signed-off export. Framework-free, kept out of React's render cycle — lazy
 * imported so `three` never touches the main app bundle.
 */
import * as THREE from 'three';

const ROSE = new THREE.Color(0xf43f5e);
const CORAL = new THREE.Color(0xfb7185);
const VIOLET = new THREE.Color(0x8b5cf6);
const WHITE = new THREE.Color(0xffffff);
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Baked tune — exported verbatim from the hero visual 3D lab. */
const TUNE = {
  lattice: 0.77,
  pingDensity: 0.20,
  density: 0.83,
  spin: 0.53,
  beat: 17.3,
  glow: 2.5,
  zoom: 1.51,
  softBurst: true,
  pings: true,
} as const;

const RAD = 7.2;
const PING_CAP = 260;

export interface PulseHeroMesh {
  start(): void;
  stop(): void;
  resize(): void;
  dispose(): void;
}

export interface PulseHeroOptions {
  /** prefers-reduced-motion — renders a single static frame, no rAF, no beat. */
  reduced?: boolean;
  /** Override node density (e.g. 0.45 on mobile). Defaults to the baked tune. */
  density?: number;
}

/** lub-dub envelope in SECONDS since the beat fired (tight double-thump). */
function beatEnv(s: number): number {
  const lub = Math.exp(-Math.pow(s / 0.06, 2));
  const dub = 0.5 * Math.exp(-Math.pow((s - 0.24) / 0.07, 2));
  return Math.min(1, lub + dub);
}

function glowTexture(): THREE.CanvasTexture {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.65)');
  grd.addColorStop(0.55, 'rgba(255,255,255,.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.needsUpdate = true;
  return t;
}

export function createPulseHeroMesh(canvas: HTMLCanvasElement, opts: PulseHeroOptions = {}): PulseHeroMesh {
  const reduced = !!opts.reduced;
  const density = opts.density ?? TUNE.density;

  const dims = () => ({
    w: canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth,
    h: canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight,
  });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0); // transparent; the section bg supplies the dark mask

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 200);
  camera.position.set(0, 0, 16);
  const group = new THREE.Group();
  scene.add(group);

  const GLOW = glowTexture();

  // ── core glow sprite ──
  const coreMat = new THREE.SpriteMaterial({ map: GLOW, color: ROSE.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = new THREE.Sprite(coreMat);
  core.scale.setScalar(5);
  group.add(core);

  // ── propagation mesh (built once; rebuilt only on density change, which we don't do here) ──
  const N = Math.round(2400 * density);
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  const radii = new Float32Array(N);
  const baseCol: THREE.Color[] = [];
  for (let i = 0; i < N; i++) {
    const u = Math.random(), v = Math.random();
    const th = u * TAU, ph = Math.acos(2 * v - 1);
    const r = RAD * (0.55 + Math.random() * 0.45);
    positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
    positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    positions[i * 3 + 2] = r * Math.cos(ph);
    radii[i] = r;
    const base = new THREE.Color().lerpColors(ROSE, VIOLET, clamp((r / RAD - 0.5) / 0.5, 0, 1));
    baseCol.push(base);
    colors[i * 3] = base.r; colors[i * 3 + 1] = base.g; colors[i * 3 + 2] = base.b;
    sizes[i] = 0.5 + Math.random() * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: GLOW }, uGlow: { value: TUNE.glow } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC;
      void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*300.0/(-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uGlow; varying vec3 vC;
      void main(){ float a=texture2D(uTex,gl_PointCoord).a; gl_FragColor=vec4(vC*uGlow, a); }`,
  });
  const cloud = new THREE.Points(geo, mat);
  group.add(cloud);
  const colAttr = geo.attributes.color as THREE.BufferAttribute;
  const sizAttr = geo.attributes.size as THREE.BufferAttribute;

  // ── candidate neighbour edges — pool for the bright ping strands ──
  const candidateEdges: [number, number][] = [];
  {
    const cs = Math.max(1, Math.floor(N / 600));
    for (let i = 0; i < N; i += cs) {
      let b1 = -1, d1 = 1e9, b2 = -1, d2 = 1e9;
      for (let j = i + 1; j < Math.min(N, i + cs * 40); j++) {
        const dx = positions[i * 3] - positions[j * 3], dy = positions[i * 3 + 1] - positions[j * 3 + 1], dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = j; } else if (d < d2) { d2 = d; b2 = j; }
      }
      if (b1 >= 0 && d1 < 16) candidateEdges.push([i, b1]);
      if (b2 >= 0 && d2 < 16) candidateEdges.push([i, b2]);
    }
  }

  // ── faint structural lattice ──
  const seg: number[] = [];
  {
    const sampleStep = Math.max(1, Math.floor(N / (220 + TUNE.lattice * 1500)));
    const neighbors = TUNE.lattice > 0.55 ? 2 : 1;
    const thresh = 6 + TUNE.lattice * 8;
    for (let i = 0; i < N; i += sampleStep) {
      const found: [number, number][] = [];
      for (let j = i + 1; j < Math.min(N, i + sampleStep * 48); j++) {
        const dx = positions[i * 3] - positions[j * 3], dy = positions[i * 3 + 1] - positions[j * 3 + 1], dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < thresh) found.push([d, j]);
      }
      found.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < Math.min(neighbors, found.length); k++) seg.push(i, found[k][1]);
    }
  }
  const linePos = new Float32Array(seg.length * 3);
  for (let k = 0; k < seg.length; k++) {
    const idx = seg[k];
    linePos[k * 3] = positions[idx * 3]; linePos[k * 3 + 1] = positions[idx * 3 + 1]; linePos[k * 3 + 2] = positions[idx * 3 + 2];
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color().lerpColors(ROSE, VIOLET, 0.5), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
  const links = new THREE.LineSegments(lineGeo, lineMat);
  group.add(links);

  // ── ping strands: rose lines that draw themselves between neighbour nodes ──
  const pingPos = new Float32Array(PING_CAP * 6);
  const pingCol = new Float32Array(PING_CAP * 6);
  const pingGeo = new THREE.BufferGeometry();
  pingGeo.setAttribute('position', new THREE.BufferAttribute(pingPos, 3));
  pingGeo.setAttribute('color', new THREE.BufferAttribute(pingCol, 3));
  const pingMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pingLines = new THREE.LineSegments(pingGeo, pingMat);
  pingGeo.setDrawRange(0, 0);
  group.add(pingLines);
  const activePings: { ei: number; t: number; dur: number }[] = [];

  function updatePings(dt: number): void {
    if (!TUNE.pings || candidateEdges.length === 0) { pingGeo.setDrawRange(0, 0); return; }
    const target = Math.min(PING_CAP, Math.round(2 + TUNE.pingDensity * Math.min(candidateEdges.length, PING_CAP - 2)));
    let guard = 0;
    while (activePings.length < target && guard++ < PING_CAP) {
      activePings.push({ ei: (Math.random() * candidateEdges.length) | 0, t: 0, dur: 0.7 + Math.random() * 1.2 });
    }
    let c = 0;
    for (let k = activePings.length - 1; k >= 0; k--) {
      const pg = activePings[k]; pg.t += dt;
      if (pg.t >= pg.dur) { activePings.splice(k, 1); continue; }
      if (c >= PING_CAP) continue;
      const e = candidateEdges[pg.ei]; if (!e) continue;
      const i = e[0], j = e[1];
      const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
      const bx = positions[j * 3], by = positions[j * 3 + 1], bz = positions[j * 3 + 2];
      const grow = Math.min(1, pg.t / (pg.dur * 0.5)), ease = 1 - Math.pow(1 - grow, 3);
      const hx = ax + (bx - ax) * ease, hy = ay + (by - ay) * ease, hz = az + (bz - az) * ease;
      const br = grow < 1 ? ease : 1 - (pg.t - pg.dur * 0.5) / (pg.dur * 0.5);
      const I = Math.max(0, br) * 1.5, o = c * 6;
      pingPos[o] = ax; pingPos[o + 1] = ay; pingPos[o + 2] = az;
      pingPos[o + 3] = hx; pingPos[o + 4] = hy; pingPos[o + 5] = hz;
      const r = 0.957 * I, g = 0.247 * I, bl = 0.369 * I;
      pingCol[o] = r * 0.6; pingCol[o + 1] = g * 0.6; pingCol[o + 2] = bl * 0.6;            // dim tail
      pingCol[o + 3] = r + 0.12 * I; pingCol[o + 4] = g + 0.08 * I; pingCol[o + 5] = bl + 0.08 * I; // bright head
      c++;
    }
    (pingGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (pingGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    pingGeo.setDrawRange(0, c * 2);
  }

  // ── nucleus: right-biased so the hero copy stays clear on the left ──
  const nucleus = new THREE.Vector3();
  function placeNucleus(): void {
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const { w, h } = dims();
    const nx = (0.70) * 2 - 1, ny = -((0.46) * 2 - 1);
    nucleus.set(nx * halfW, ny * halfH, 0);
    void w; void h;
  }

  // ── state ──
  const clock = new THREE.Clock();
  const tmp = new THREE.Color();
  const wavefronts: number[] = [];
  let raf = 0, running = false, disposed = false;
  let beatT = 0, lastPhase = 1;
  let zoom = TUNE.zoom;

  function renderFrame(dt: number, t: number): void {
    // auto heartbeat on interval
    beatT += reduced ? 0 : dt;
    const phase = (beatT % TUNE.beat) / TUNE.beat;
    if (!reduced && phase < lastPhase) wavefronts.push(0);
    lastPhase = phase;
    const env = reduced ? 0 : beatEnv(beatT % TUNE.beat);

    const wspd = 0.12 * 12, bandW = 0.98;
    for (let i = wavefronts.length - 1; i >= 0; i--) { wavefronts[i] += dt * wspd; if (wavefronts[i] > RAD * 1.6 + bandW) wavefronts.splice(i, 1); }

    const wl = TUNE.softBurst ? 0.34 : 0.7, szb = TUNE.softBurst ? 1.3 : 2.4;
    for (let i = 0; i < N; i++) {
      let br = 0;
      for (let w = 0; w < wavefronts.length; w++) { const d = Math.abs(radii[i] - wavefronts[w]); if (d < bandW) br = Math.max(br, 1 - d / bandW); }
      tmp.copy(baseCol[i]).lerp(WHITE, br * wl).lerp(CORAL, br * 0.24);
      colAttr.array[i * 3] = tmp.r; colAttr.array[i * 3 + 1] = tmp.g; colAttr.array[i * 3 + 2] = tmp.b;
      sizAttr.array[i] = 0.5 + (i % 7) * 0.05 + br * szb;
    }
    colAttr.needsUpdate = true; sizAttr.needsUpdate = true;

    mat.uniforms.uGlow.value = TUNE.glow;
    lineMat.opacity = (0.04 + TUNE.lattice * 0.42) * (0.6 + env * 0.9);
    const cf = TUNE.softBurst ? 0.3 : 0.55;
    core.scale.setScalar(5 * (1 + env * cf));
    coreMat.opacity = (0.4 + env * (TUNE.softBurst ? 0.25 : 0.45)) * Math.min(1, TUNE.glow / 2.5);
    updatePings(reduced ? 0.016 : dt);

    zoom += (TUNE.zoom - zoom) * 0.08; group.scale.setScalar(zoom);
    group.rotation.y = reduced ? 0 : t * 0.05 * TUNE.spin;
    group.rotation.x = -0.1;
    group.position.copy(nucleus);

    renderer.render(scene, camera);
  }

  function frame(): void {
    if (!running || disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    renderFrame(dt, clock.elapsedTime);
  }

  const onContextLost = (e: Event) => { e.preventDefault(); stop(); };
  const onContextRestored = () => { if (!disposed) start(); };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  function resizeImpl(): void {
    const { w, h } = dims();
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    placeNucleus(); group.position.copy(nucleus);
  }

  function start(): void {
    if (running || disposed) return;
    running = true;
    clock.getDelta();
    if (reduced) { renderFrame(0, 0); running = false; return; } // single static frame
    raf = requestAnimationFrame(frame);
  }
  function stop(): void { running = false; cancelAnimationFrame(raf); }

  resizeImpl();

  return {
    start,
    stop,
    resize: resizeImpl,
    dispose() {
      disposed = true;
      stop();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      geo.dispose(); mat.dispose(); lineGeo.dispose(); lineMat.dispose();
      pingGeo.dispose(); pingMat.dispose(); coreMat.dispose(); GLOW.dispose();
      renderer.dispose();
    },
  };
}
