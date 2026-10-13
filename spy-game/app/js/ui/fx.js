// Sound (synthesised with Web Audio, no files to download), haptics and screen wake lock.
import { getState } from '../state.js';

let ctx = null;

/** iOS/Chrome only allow audio after a user gesture: call on the first tap. */
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch {
    ctx = null;
  }
}

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  return buf;
}

const SOUNDS = {
  // Rubber stamp hitting paper: low thump + short noise slap.
  stamp(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.25);
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(0.08);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    n.connect(f).connect(ng).connect(ctx.destination);
    n.start(t);
  },
  // Typewriter key click for the timer's last seconds.
  tick(t) {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(0.03);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    n.connect(f).connect(g).connect(ctx.destination);
    n.start(t);
  },
  // Paper slide when a card is revealed.
  reveal(t) {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(0.22);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(2600, t + 0.2);
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    n.connect(f).connect(g).connect(ctx.destination);
    n.start(t);
  },
  // Two-tone alarm when time runs out.
  alarm(t) {
    [0, 0.18, 0.36].forEach((dt, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = i % 2 ? 660 : 880;
      g.gain.setValueAtTime(0.12, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.16);
    });
  },
};

export function play(name) {
  if (!getState().prefs.sound || !ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[name]?.(ctx.currentTime + 0.01);
  } catch {
    /* audio is best-effort */
  }
}

export function vibrate(pattern = 30) {
  if (!getState().prefs.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

// ------------------------------------------------------------ wake lock

let lock = null;
let wanted = false;

async function acquire() {
  if (!wanted || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    lock = null; // refused (battery saver, iframe…) → fail silently
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') acquire();
});

export function keepAwake(on) {
  wanted = on;
  if (on) acquire();
  else if (lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}

export function reducedMotion() {
  if (getState().prefs.reducedMotion === 'on') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
