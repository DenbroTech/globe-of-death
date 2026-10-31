import { game } from '../core/state.js';
import { ARENAS } from '../arenas/arenas.js';
import { arenaId } from '../arenas/current.js';
import { actOfBar, bpmOfAct, timeAt } from './clock.js';
import { toast } from '../ui/hud.js';
import { SONGS, clap, songFor } from './songs.js';

let ac = null,
  master = null,
  noiseBuf = null;
function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = game.sndOn ? 0.6 : 0;
    moodLP = ac.createBiquadFilter();
    moodLP.type = 'lowpass';
    moodLP.frequency.value = (ARENAS[arenaId].kit || {}).lp || 20000;
    master.connect(moodLP);
    moodLP.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) {
    ac = null;
  }
}
function env(t, g, peak, dec) {
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dec);
}
function kick(t) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(t, g, 0.9, 0.32);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.35);
}
function nz(t, type, freq, peak, dec) {
  const s = ac.createBufferSource(),
    f = ac.createBiquadFilter(),
    g = ac.createGain();
  s.buffer = noiseBuf;
  f.type = type;
  f.frequency.value = freq;
  env(t, g, peak, dec);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t);
  s.stop(t + dec + 0.02);
}
function snare(t) {
  nz(t, 'bandpass', 1900, 0.45, 0.16);
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.frequency.value = 190;
  env(t, g, 0.25, 0.08);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.1);
}
function hat(t, open) {
  nz(t, 'highpass', 7500, open ? 0.1 : 0.06, open ? 0.12 : 0.035);
}
function tone(t, f, type, peak, dec, filt) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.type = type;
  o.frequency.value = f;
  env(t, g, peak, dec);
  if (filt) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filt;
    o.connect(lp);
    lp.connect(g);
  } else o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dec + 0.02);
}
const mid = m => 440 * Math.pow(2, (m - 69) / 12);
let moodLP = null;
const kit = () => ARENAS[arenaId].kit || {};
function osc(t, f, type, peak, dec, f1) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + Math.min(dec, 0.3));
  env(t, g, peak, dec);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dec + 0.03);
  return o;
}
function swell(t, f, type, v, d, cut) {
  const o = ac.createOscillator(),
    g = ac.createGain(),
    lp = ac.createBiquadFilter();
  o.type = type;
  o.frequency.value = f;
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(cut * 0.15, t);
  lp.frequency.exponentialRampToValueAtTime(cut, t + 0.06);
  lp.frequency.exponentialRampToValueAtTime(cut * 0.3, t + d);
  g.gain.setValueAtTime(0.0008, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0008, t + d);
  o.connect(lp);
  lp.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + d + 0.03);
}
function voice(kind, t, m, v = 0.1, d = 0.3) {
  const f = mid(m);
  if (kind === 'pan') {
    osc(t, f, 'sine', v, d * 1.5, f * 0.996);
    osc(t, f * 2, 'sine', v * 0.5, d * 0.7);
    osc(t, f * 3.02, 'sine', v * 0.2, d * 0.35);
    osc(t, f * 4.2, 'sine', v * 0.07, d * 0.15);
  } else if (kind === 'organ') {
    osc(t, f, 'square', v * 0.35, d);
    osc(t, f * 2, 'sine', v * 0.5, d);
    osc(t, f * 1.5, 'triangle', v * 0.2, d);
  } else if (kind === 'brass') {
    swell(t, f, 'sawtooth', v, d, 3200);
    swell(t, f * 1.006, 'sawtooth', v * 0.5, d, 2400);
  } else if (kind === 'bubble') {
    osc(t, f * 0.5, 'sine', v, d, f * 1.03);
    osc(t + 0.025, f * 2, 'sine', v * 0.22, d * 0.4, f * 2.7);
  } else if (kind === 'theremin') {
    const o = ac.createOscillator(),
      g = ac.createGain(),
      lfo = ac.createOscillator(),
      lg = ac.createGain(),
      e = t + d * 1.4;
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    lfo.frequency.value = 6;
    lg.gain.value = f * 0.013;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0008, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0008, e);
    o.connect(g);
    g.connect(master);
    o.start(t);
    lfo.start(t);
    o.stop(e + 0.03);
    lfo.stop(e + 0.03);
  } else if (kind === 'metal') {
    osc(t, f, 'triangle', v, d);
    osc(t, f * 2.76, 'sine', v * 0.3, d * 0.5);
    osc(t, f * 5.4, 'sine', v * 0.12, d * 0.25);
  } else {
    tone(t, f, 'triangle', v, d);
    tone(t, f * 2, 'sine', v * 0.35, d * 0.7);
  }
}
function chantVoice(t, m, d, vow) {
  const f = mid(m),
    g = ac.createGain(),
    f1 = ac.createBiquadFilter(),
    f2 = ac.createBiquadFilter();
  f1.type = f2.type = 'bandpass';
  f1.Q.value = f2.Q.value = 5;
  f1.frequency.value = vow === 'e' ? 420 : 560;
  f2.frequency.value = vow === 'e' ? 1900 : 950;
  const mix = ac.createGain();
  mix.gain.value = 1;
  g.gain.setValueAtTime(0.0008, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
  g.gain.setValueAtTime(0.16, t + d * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0008, t + d);
  for (let k = 0; k < 6; k++) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f * (k % 3 === 2 ? 2 : 1);
    o.detune.value = (k - 2.5) * 11;
    o.connect(f1);
    o.connect(f2);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  f1.connect(g);
  f2.connect(g);
  g.connect(master);
  nz(t, 'bandpass', vow === 'e' ? 2400 : 900, 0.05, d * 0.8);
}
function stadiumChant(B0) {
  const root = SONGS[songFor(actOfBar(Math.floor(B0 / 4)))].prog[0] + 12;
  [
    [0, 7, 0.9, 'o'],
    [1, 4, 0.9, 'e'],
    [2, 7, 0.45, 'o'],
    [2.5, 4, 0.45, 'e'],
    [3, 7, 0.45, 'o'],
    [3.5, 4, 0.9, 'e'],
    [4.5, 7, 0.45, 'o'],
    [5, 4, 0.9, 'e'],
    [6, 7, 0.45, 'o'],
    [6.5, 4, 1.1, 'e'],
  ].forEach(([b, iv, d, v]) => {
    const t = timeAt(B0 + b);
    if (t > ac.currentTime) chantVoice(t, root + iv, (d * 60) / bpmOfAct(game.act), v);
  });
  toast('¡Olé, olé, olé!', 1400);
}
function stadiumStomp(B0) {
  for (let r = 0; r < 4; r++) {
    const b = B0 + r * 2;
    kick(timeAt(b));
    kick(timeAt(b + 0.5));
    clap(timeAt(b + 1));
  }
}
function shaker(t) {
  nz(t, 'highpass', 5200, 0.08, 0.05);
}
function conga(t, hi) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.frequency.setValueAtTime(hi ? 340 : 230, t);
  o.frequency.exponentialRampToValueAtTime(hi ? 260 : 175, t + 0.14);
  env(t, g, 0.32, 0.2);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.22);
}
function rim(t) {
  nz(t, 'bandpass', 2600, 0.28, 0.03);
  tone(t, 1700, 'square', 0.035, 0.02);
}
function sfxNoise(dur, freq, vol, type) {
  if (!ac) return;
  const t = ac.currentTime;
  nz(t, type === 'crash' ? 'lowpass' : 'bandpass', freq, vol, dur);
}

export function initSynth() {
  /* ---------- audio: a small drum machine + bass, scheduled on the beat ---------- */
  game.sndOn = true;
  game.engineOsc = null;
  try {
    game.sndOn = localStorage.getItem('god-snd') !== '0';
  } catch (e) {}
}

export {
  ac,
  conga,
  hat,
  initAudio,
  kick,
  kit,
  master,
  mid,
  moodLP,
  nz,
  osc,
  rim,
  sfxNoise,
  shaker,
  snare,
  stadiumChant,
  stadiumStomp,
  tone,
  voice,
};
