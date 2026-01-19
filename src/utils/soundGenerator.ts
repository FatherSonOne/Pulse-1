/**
 * Pulse Notification Sound Generator
 * Creates custom notification sounds using Web Audio API
 * Generates a "digital heartbeat" pulse sound
 */

// Audio context singleton
let audioContext: AudioContext | null = null;

/**
 * Get or create the audio context
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Generate a "digital heartbeat" pulse notification sound
 * Two quick beats followed by a subtle fade
 */
export function playPulseHeartbeat(volume: number = 0.7): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Create master gain for volume control
  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // First beat - slightly higher pitch
  createPulseBeat(ctx, masterGain, now, 440, 0.08);

  // Second beat - same pitch, slightly quieter
  createPulseBeat(ctx, masterGain, now + 0.15, 440, 0.06);
}

/**
 * Create a single pulse beat
 */
function createPulseBeat(
  ctx: AudioContext,
  destination: AudioNode,
  startTime: number,
  frequency: number,
  duration: number
): void {
  // Create oscillator for the main tone
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = frequency;

  // Create gain envelope
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01); // Quick attack
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration); // Quick decay

  // Add subtle harmonic
  const harmonic = ctx.createOscillator();
  harmonic.type = 'sine';
  harmonic.frequency.value = frequency * 2;

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0, startTime);
  harmonicGain.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
  harmonicGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration * 0.8);

  // Connect the nodes
  osc.connect(gainNode);
  gainNode.connect(destination);

  harmonic.connect(harmonicGain);
  harmonicGain.connect(destination);

  // Start and stop
  osc.start(startTime);
  osc.stop(startTime + duration);

  harmonic.start(startTime);
  harmonic.stop(startTime + duration);
}

/**
 * Generate a soft "ping" notification sound
 * Good for low-priority notifications
 */
export function playSoftPing(volume: number = 0.5): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}

/**
 * Generate an alert/urgent notification sound
 * Two-tone ascending pattern
 */
export function playUrgentAlert(volume: number = 0.8): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // First tone
  createAlertTone(ctx, masterGain, now, 523.25, 0.1); // C5

  // Second tone (higher)
  createAlertTone(ctx, masterGain, now + 0.12, 659.25, 0.1); // E5

  // Third tone (highest)
  createAlertTone(ctx, masterGain, now + 0.24, 783.99, 0.15); // G5
}

/**
 * Create an alert tone
 */
function createAlertTone(
  ctx: AudioContext,
  destination: AudioNode,
  startTime: number,
  frequency: number,
  duration: number
): void {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frequency;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
  gainNode.gain.setValueAtTime(0.3, startTime + duration * 0.7);
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Generate a message notification sound
 * Friendly double-tap
 */
export function playMessageSound(volume: number = 0.6): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // First tap
  createTapSound(ctx, masterGain, now, 698.46, 0.06); // F5

  // Second tap
  createTapSound(ctx, masterGain, now + 0.08, 880, 0.08); // A5
}

/**
 * Create a tap sound
 */
function createTapSound(
  ctx: AudioContext,
  destination: AudioNode,
  startTime: number,
  frequency: number,
  duration: number
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = frequency;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  // Add subtle resonance
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 5;

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Generate an email notification sound
 * Classic "you've got mail" style ping
 */
export function playEmailSound(volume: number = 0.6): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // Rising glissando
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, now); // C5
  osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15); // C6

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
  gainNode.gain.setValueAtTime(0.3, now + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  osc.connect(gainNode);
  gainNode.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.2);
}

/**
 * Generate a task completion sound
 * Satisfying "ding" with harmonics
 */
export function playTaskCompleteSound(volume: number = 0.6): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // Fundamental
  createBellTone(ctx, masterGain, now, 880, 0.4, 0.3);

  // Harmonic 1
  createBellTone(ctx, masterGain, now, 1760, 0.3, 0.15);

  // Harmonic 2
  createBellTone(ctx, masterGain, now, 2640, 0.25, 0.08);
}

/**
 * Create a bell-like tone
 */
function createBellTone(
  ctx: AudioContext,
  destination: AudioNode,
  startTime: number,
  frequency: number,
  duration: number,
  amplitude: number
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = frequency;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(amplitude, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Generate a calendar reminder sound
 * Gentle chime sequence
 */
export function playCalendarSound(volume: number = 0.6): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // Three-note chime
  const notes = [659.25, 783.99, 987.77]; // E5, G5, B5
  notes.forEach((freq, i) => {
    createBellTone(ctx, masterGain, now + i * 0.12, freq, 0.5, 0.2);
  });
}

/**
 * Generate an AI response sound
 * Futuristic "processing complete" tone
 */
export function playAISound(volume: number = 0.5): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // Sweeping synth tone
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);

  // Low-pass filter for smoothness
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, now);
  filter.frequency.exponentialRampToValueAtTime(3000, now + 0.2);
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.4);
  filter.Q.value = 2;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
  gainNode.gain.setValueAtTime(0.15, now + 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.5);
}

/**
 * Play notification sound based on category
 */
export function playNotificationSound(
  category: 'message' | 'email' | 'task' | 'calendar' | 'ai' | 'voice' | 'decision' | 'crm' | 'system' | 'urgent' | 'default',
  volume: number = 0.7
): void {
  switch (category) {
    case 'message':
      playMessageSound(volume);
      break;
    case 'email':
      playEmailSound(volume);
      break;
    case 'task':
      playTaskCompleteSound(volume);
      break;
    case 'calendar':
      playCalendarSound(volume);
      break;
    case 'ai':
      playAISound(volume);
      break;
    case 'voice':
      playMessageSound(volume);
      break;
    case 'decision':
      playCalendarSound(volume);
      break;
    case 'crm':
      playSoftPing(volume);
      break;
    case 'system':
      playSoftPing(volume);
      break;
    case 'urgent':
      playUrgentAlert(volume);
      break;
    case 'default':
    default:
      playPulseHeartbeat(volume);
      break;
  }
}

/**
 * Test all notification sounds
 */
export async function testAllSounds(volume: number = 0.5): Promise<void> {
  const sounds = [
    { name: 'Pulse Heartbeat', fn: () => playPulseHeartbeat(volume) },
    { name: 'Soft Ping', fn: () => playSoftPing(volume) },
    { name: 'Urgent Alert', fn: () => playUrgentAlert(volume) },
    { name: 'Message', fn: () => playMessageSound(volume) },
    { name: 'Email', fn: () => playEmailSound(volume) },
    { name: 'Task Complete', fn: () => playTaskCompleteSound(volume) },
    { name: 'Calendar', fn: () => playCalendarSound(volume) },
    { name: 'AI', fn: () => playAISound(volume) },
  ];

  for (const sound of sounds) {
    console.log(`Playing: ${sound.name}`);
    sound.fn();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// Export default heartbeat as the main Pulse sound
export const playPulseNotification = playPulseHeartbeat;
