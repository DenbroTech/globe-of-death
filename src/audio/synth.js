import { game } from '../core/state.js';
import { arenaId } from '../arenas/current.js';
import { actOfBar, bpmOfAct, timeAt } from './clock.js';
import { toast } from '../ui/hud.js';
import { SONGS, clap, songFor } from './songs.js';
import { THEMES } from './themes.js';

/* ---------- audio engine ----------
   voices -> music / sfx / ambience buses -> (dry + reverb + echo sends) -> compressor -> master (mute) -> muffle -> out
   Music bus sits at 1 in a ride and 0.5 in the menus. Each arena sets its own reverb room, echo and ambience. */
let ac = null,
  master = null,
  noiseBuf = null,
  moodLP = null,
  musicBus = null,
  sfxBus = null,
  ambBus = null,
  revIn = null,
  conv = null,
  revOut = null,
  echoIn = null,
  echoDelay = null,
  echoFb = null,
  echoOut = null,
  dest = null;
/* the phone's audio clock froze (it can report "running" while stuck, e.g. Bluetooth dropping): throw the
   context away and build a fresh one. The show clock's jump guard in frame() re-anchors the tempo map */
function rebuildAudio() {
  const old = ac;
  ac = null;
  try {
    if (old) old.close().catch(() => {});
  } catch (e) {}
  for (const k in IRS) delete IRS[k];
  initAudio();
}
function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = game.sndOn ? 0.6 : 0;
    moodLP = ac.createBiquadFilter();
    moodLP.type = 'lowpass';
    moodLP.frequency.value = kit().lp || 20000;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.006;
    comp.release.value = 0.2;
    comp.connect(master);
    master.connect(moodLP);
    moodLP.connect(ac.destination);
    // reverb and echo returns
    revIn = ac.createGain();
    conv = ac.createConvolver();
    revOut = ac.createGain();
    revIn.connect(conv);
    conv.connect(revOut);
    revOut.connect(comp);
    echoIn = ac.createGain();
    echoDelay = ac.createDelay(2);
    echoFb = ac.createGain();
    echoOut = ac.createGain();
    const echoLP = ac.createBiquadFilter();
    echoLP.type = 'lowpass';
    echoLP.frequency.value = 3200;
    echoIn.connect(echoDelay);
    echoDelay.connect(echoLP);
    echoLP.connect(echoFb);
    echoFb.connect(echoDelay);
    echoLP.connect(echoOut);
    echoOut.connect(comp);
    const bus = (lvl, rev, echo) => {
      const g = ac.createGain();
      g.gain.value = lvl;
      g.connect(comp);
      const r = ac.createGain();
      r.gain.value = rev;
      g.connect(r);
      r.connect(revIn);
      const e = ac.createGain();
      e.gain.value = echo;
      g.connect(e);
      e.connect(echoIn);
      return g;
    };
    musicBus = bus(game.running ? 1 : 0.33, 1, 1);
    sfxBus = bus(1, 0.7, 0.5);
    ambBus = bus(0.55, 0.4, 0);
    dest = musicBus;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyArenaAudio(arenaId);
  } catch (e) {
    ac = null;
  }
}
const kit = () => THEMES[arenaId] || THEMES.bigtop;
/* route everything played inside fn to the sound-effects bus */
function sfx(fn) {
  if (!ac) return;
  const prev = dest;
  dest = sfxBus;
  try {
    fn();
  } finally {
    dest = prev;
  }
}
/* music volume: full in a ride, half in the menus */
let musLvl = 0.33;
function setMusicLevel(v, tc = 0.4) {
  // each arena can sit its music lower (kit().mus) so move sounds stay clear
  const L = v * (kit().mus ?? 1);
  if (L === musLvl) return;
  musLvl = L;
  if (musicBus) musicBus.gain.setTargetAtTime(L, ac.currentTime, tc);
}
/* every move sound briefly dips the music (sidechain-style) so the hit pops out of the mix */
function duckMusic() {
  if (!musicBus) return;
  const t = ac.currentTime,
    g = musicBus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(musLvl * 0.55, t + 0.015);
  g.setTargetAtTime(musLvl, t + 0.08, 0.12);
}
function out(node, pan) {
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    p.connect(dest);
  } else node.connect(dest);
}
function env(t, g, peak, dec) {
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dec);
}
function nz(t, type, freq, peak, dec, q, pan) {
  const s = ac.createBufferSource(),
    f = ac.createBiquadFilter(),
    g = ac.createGain();
  s.buffer = noiseBuf;
  f.type = type;
  f.frequency.value = freq;
  if (q) f.Q.value = q;
  env(t, g, peak, dec);
  s.connect(f);
  f.connect(g);
  out(g, pan);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dec + 0.02);
}
/* ---- drums ---- */
function kick(t) {
  const K = kit().kick,
    [f0, f1, dec, pk] = K === 'boom' ? [120, 38, 0.55, 1] : K === 'soft' ? [110, 50, 0.28, 0.7] : K === 'punch' ? [170, 46, 0.32, 1] : [150, 45, 0.36, 0.9];
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + 0.1);
  env(t, g, pk, dec);
  o.connect(g);
  out(g);
  o.start(t);
  o.stop(t + dec + 0.05);
  if (K !== 'soft') nz(t, 'highpass', 2500, K === 'punch' ? 0.3 : 0.18, 0.014);
}
function snare(t) {
  const K = kit().snare;
  if (K === 'brush') {
    nz(t, 'bandpass', 3000, 0.22, 0.16, 0.8, 0.1);
    return;
  }
  const big = K === 'big';
  [185, 330].forEach((f, i) => {
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.15, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    env(t, g, i ? 0.12 : 0.24, 0.09);
    o.connect(g);
    out(g);
    o.start(t);
    o.stop(t + 0.12);
  });
  nz(t, 'highpass', 1300, big ? 0.42 : 0.32, big ? 0.28 : 0.18);
  nz(t, 'bandpass', 4000, 0.14, 0.1, 1);
}
/* metallic 808-style hat: square oscillators at clangy ratios */
function hat(t, open) {
  const g = ac.createGain(),
    bp = ac.createBiquadFilter(),
    hp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 10000;
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  env(t, g, open ? 0.09 : 0.055, open ? 0.22 : 0.045);
  bp.connect(hp);
  hp.connect(g);
  out(g, 0.25);
  for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = 40 * r;
    o.connect(bp);
    o.start(t);
    o.stop(t + (open ? 0.25 : 0.06));
  }
}
function tom(t, f) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.frequency.setValueAtTime(f * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  env(t, g, 0.5, 0.35);
  o.connect(g);
  out(g, (Math.random() - 0.5) * 0.4);
  o.start(t);
  o.stop(t + 0.4);
}
function tone(t, f, type, peak, dec, filt, pan) {
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
  out(g, pan);
  o.start(t);
  o.stop(t + dec + 0.02);
}
const mid = m => 440 * Math.pow(2, (m - 69) / 12);
function osc(t, f, type, peak, dec, f1, pan) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + Math.min(dec, 0.3));
  env(t, g, peak, dec);
  o.connect(g);
  out(g, pan);
  o.start(t);
  o.stop(t + dec + 0.03);
  return o;
}
/* oscillator(s) through an enveloped low-pass: attack a, hold to d, cutoff sweep c0 -> c1 */
function synthNote(t, f, types, v, d, c0, c1, a = 0.01, detune = 0, vib = 0, pan) {
  const g = ac.createGain(),
    lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(c0, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(60, c1), t + d);
  g.gain.setValueAtTime(0.0008, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0008, t + d);
  lp.connect(g);
  out(g, pan);
  let lfo = null;
  if (vib) {
    lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.value = f * vib;
    lfo.connect(lg);
    lfo.lg = lg;
    lfo.start(t);
    lfo.stop(t + d + 0.05);
  }
  types.forEach((ty, i) => {
    const o = ac.createOscillator();
    o.type = ty;
    o.frequency.value = f;
    o.detune.value = (i - (types.length - 1) / 2) * detune;
    if (lfo) lfo.lg.connect(o.frequency);
    o.connect(lp);
    o.start(t);
    o.stop(t + d + 0.05);
  });
}
function swell(t, f, type, v, d, cut) {
  synthNote(t, f, [type], v, d, cut * 0.4, cut * 0.3, 0.035);
}
/* ---- melodic voices ---- */
function voice(kind, t, m, v = 0.1, d = 0.3) {
  const f = mid(m);
  if (kind === 'pan') {
    // steel pan: sine partials with a quick shimmer
    osc(t, f, 'sine', v, d * 1.5, f * 0.996, -0.15);
    osc(t, f * 2, 'sine', v * 0.5, d * 0.7, 0, -0.15);
    osc(t, f * 3.02, 'sine', v * 0.2, d * 0.35, 0, -0.15);
    osc(t, f * 4.2, 'sine', v * 0.07, d * 0.15, 0, -0.15);
  } else if (kind === 'calliope') {
    // steam calliope: breathy pipe with wobbly pitch
    synthNote(t, f, ['square', 'sine'], v * 0.75, d * 1.2, 2600, 1800, 0.02, 6, 0.012, -0.1);
    nz(t, 'bandpass', f * 2, v * 0.08, d * 0.4, 6, -0.1);
  } else if (kind === 'organ') {
    osc(t, f, 'square', v * 0.3, d);
    osc(t, f * 2, 'sine', v * 0.45, d);
    osc(t, f * 1.5, 'triangle', v * 0.18, d);
  } else if (kind === 'brass') {
    synthNote(t, f, ['sawtooth', 'sawtooth'], v, d, 600, 3600, 0.04, 9, 0.004, -0.1);
  } else if (kind === 'bubble') {
    osc(t, f * 0.5, 'sine', v, d, f * 1.03);
    osc(t + 0.025, f * 2, 'sine', v * 0.22, d * 0.4, f * 2.7, 0.3);
  } else if (kind === 'theremin') {
    synthNote(t, f, ['sine'], v, d * 1.4, 4000, 3000, 0.08, 0, 0.014, -0.15);
    const o = osc(t, f * 0.94, 'sine', 0.0001, 0.01); // keeps the old glide character subtle
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  } else if (kind === 'metal') {
    // night-city: metallic bell over a detuned saw
    osc(t, f, 'triangle', v, d, 0, 0.1);
    osc(t, f * 2.76, 'sine', v * 0.3, d * 0.5, 0, 0.1);
    osc(t, f * 5.4, 'sine', v * 0.12, d * 0.25, 0, 0.1);
  } else if (kind === 'synth') {
    synthNote(t, f, ['sawtooth', 'sawtooth', 'square'], v * 0.8, d * 1.3, 3800, 900, 0.008, 14, 0.003, -0.15);
  } else if (kind === 'glass') {
    osc(t, f * 2, 'sine', v * 0.6, d * 2, 0, 0.3);
    osc(t, f * 5.03, 'sine', v * 0.15, d, 0, 0.3);
  } else if (kind === 'pluck') {
    // sky crane move sound: punchy filtered electronic pluck that cuts through the synth music
    synthNote(t, f, ['square', 'sawtooth'], v * 1.1, d * 0.9, 5200, 650, 0.002, 7, 0.004, 0.15);
    osc(t, f * 2, 'triangle', v * 0.3, d * 0.4, 0, 0.15);
  } else if (kind === 'drop') {
    // underwater move sound: bubbly marimba: a round body with a little rising bubble on the attack
    osc(t, f * 0.97, 'sine', v * 1.2, d * 1.1, f, -0.1);
    osc(t, f * 3.9, 'sine', v * 0.35, d * 0.25, 0, -0.1);
    osc(t, f * 1.5, 'sine', v * 0.25, 0.06, f * 2.2, 0.2);
  } else if (kind === 'blip') {
    // moon move sound: crisp space blip with a tiny pitch drop (the moon's echo trails it)
    osc(t, f * 1.06, 'triangle', v * 1.1, d * 0.9, f, 0.1);
    osc(t, f * 2, 'sine', v * 0.4, d * 0.5, 0, 0.1);
    osc(t, f * 3, 'square', v * 0.05, 0.05, 0, 0.1);
  } else if (kind === 'uke') {
    synthNote(t, f, ['triangle', 'sawtooth'], v, 0.35, 3200, 500, 0.003, 4, 0, 0.2);
  } else {
    tone(t, f, 'triangle', v, d);
    tone(t, f * 2, 'sine', v * 0.35, d * 0.7);
  }
}
/* ---- bass ---- */
function bass(t, f, S) {
  const K = kit().bass,
    d = S.bdec || 0.22;
  if (K === 'tuba') synthNote(t, f, ['triangle', 'square'], 0.2, d + 0.15, 900, 300, 0.02, 4);
  else if (K === 'pluck') synthNote(t, f, ['triangle', 'sine'], 0.24, d + 0.1, 1400, 180, 0.004);
  else if (K === 'brassbass') synthNote(t, f, ['sawtooth', 'triangle'], 0.18, d + 0.1, 1200, 300, 0.015, 6);
  else if (K === 'synth') synthNote(t, f, ['sawtooth', 'square'], 0.17, d, 2000, 160, 0.004, 10);
  else if (K === 'sub') synthNote(t, f, ['sine', 'triangle'], 0.24, d + 0.2, 700, 250, 0.02);
  else synthNote(t, f, [S.bw || 'sawtooth'], 0.15, d, S.bcut ? S.bcut * 2 : 1400, S.bcut || 700, 0.005);
  if (K !== 'sub') osc(t, f / 2, 'sine', 0.12, d + 0.05); // sub weight
}
/* ---- chords: how each arena comps the harmony on a given step ---- */
function comp(t, root, k, maj, spb) {
  const K = kit(),
    ch = [12, maj ? 16 : 15, 19];
  if (K.comp === 'oompah') {
    if (k % 4 === 2) ch.forEach(i => voice('organ', t, root + i, 0.028, spb * 0.6));
  } else if (K.comp === 'uke') {
    if (k % 2 === 1 || k === 0) ch.concat([24]).forEach((i, n) => voice('uke', t + n * 0.012, root + i, 0.035, 0.3));
  } else if (K.comp === 'brass') {
    if (k === 0 || k === 3) ch.forEach(i => voice('brass', t, root + i, 0.028, spb * 1.1));
  } else if (K.comp === 'arp') {
    const seq = [0, 12, 19, 24, 15 + (maj ? 1 : 0), 19, 12, 7];
    synthNote(t, mid(root + 24 + seq[k]), ['sawtooth', 'square'], 0.028, spb * 0.45, 2600, 600, 0.004, 8, 0, (k % 2 ? 0.35 : -0.35));
  }
  // sustained pad at the start of each bar
  if (K.pad && k === 0) {
    const d = spb * 8,
      notes = K.pad === 'whale' ? [0, 7, 12] : K.pad === 'space' ? [0, 7, 14, 19] : [0, maj ? 4 : 3, 7];
    notes.forEach((i, n) =>
      synthNote(t, mid(root + 12 + i), ['sawtooth', 'triangle'], 0.022, d, K.pad === 'whale' ? 500 : 1500, 400, d * 0.35, 12, K.pad === 'whale' ? 0.006 : 0, (n - 1) * 0.4),
    );
    if (K.pad === 'whale' && Math.random() < 0.5) {
      // whale call: a slow gliding moan
      const o = osc(t + spb * 2, mid(root + 31), 'sine', 0.04, spb * 4, mid(root + 26), 0.4);
      o.frequency.exponentialRampToValueAtTime(mid(root + 33), t + spb * 5);
    }
  }
}
/* ---- arena rooms ---- */
function makeIR(dur, decay) {
  const n = Math.floor(ac.sampleRate * dur),
    b = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.45 * x); // darker as it decays
      d[i] = lp * Math.pow(1 - x, decay) * (i < ac.sampleRate * 0.012 ? i / (ac.sampleRate * 0.012) : 1);
    }
  }
  return b;
}
const IRS = {};
function applyArenaAudio(id) {
  if (!ac) return;
  const K = THEMES[id] || THEMES.bigtop,
    t = ac.currentTime;
  moodLP.frequency.setTargetAtTime(K.lp || 20000, t, 0.05);
  const sp = K.space || { dur: 1, decay: 3, wet: 0.1 };
  conv.buffer = IRS[id] || (IRS[id] = makeIR(sp.dur, sp.decay));
  revOut.gain.setTargetAtTime(sp.wet, t, 0.1);
  const e = K.echo;
  echoOut.gain.setTargetAtTime(e ? e.wet : 0, t, 0.1);
  echoFb.gain.setTargetAtTime(e ? e.fb : 0, t, 0.1);
  if (e) echoDelay.delayTime.setTargetAtTime(Math.min(1.9, (e.beats * 60) / bpmOfAct(Math.max(1, game.act || 1))), t, 0.1);
  startAmbience(K.amb);
  if (sfxBus) sfxBus.gain.setTargetAtTime(K.sfx ?? 1, t, 0.1);
}
/* ---- ambience beds: a looping filtered-noise layer plus occasional themed events ---- */
let amb = null;
function startAmbience(kind) {
  // no continuous noise beds (they read as static); ambience is just the occasional themed sound below
  amb = { kind, next: 1 };
}
/* called every frame: sprinkles the arena's one-off ambience sounds */
function ambienceTick(dt) {
  if (!ac || !amb || ac.state !== 'running') return;
  amb.next -= dt;
  if (amb.next > 0) return;
  const t = ac.currentTime + 0.05,
    r = Math.random,
    pan = (r() - 0.5) * 1.6,
    prev = dest;
  dest = ambBus;
  if (amb.kind === 'surf') {
    // gull cry
    for (let i = 0; i < 2 + (r() * 3) | 0; i++) {
      const o = osc(t + i * 0.22, 1500 + r() * 300, 'sine', 0.035, 0.18, 1100, pan);
      o.type = 'triangle';
    }
    amb.next = 4 + r() * 6;
  } else if (amb.kind === 'tent') {
    // laughs/cheers ripple and the odd honk of a clown horn
    [0, 0.09].forEach(d => osc(t + d, 420, 'square', 0.03, 0.12, 380, pan));
    amb.next = 6 + r() * 8;
  } else if (amb.kind === 'city') {
    // distant car horns and a far-off siren
    if (r() < 0.3) {
      const o = osc(t, 700, 'sawtooth', 0.012, 2.4, 0, pan);
      for (let i = 0; i < 4; i++) o.frequency.setValueAtTime(i % 2 ? 560 : 760, t + i * 0.6);
    } else [0, 0.18].forEach(d => synthNote(t + d, 330 + r() * 80, ['square'], 0.018, 0.14, 1200, 900, 0.005, 0, 0, pan));
    amb.next = 4 + r() * 7;
  } else if (amb.kind === 'deep') {
    // bubble streams
    for (let i = 0; i < 4 + r() * 6; i++) osc(t + i * 0.07 + r() * 0.05, 300 + r() * 500, 'sine', 0.03, 0.08, 900 + r() * 900, pan);
    amb.next = 1.5 + r() * 3;
  } else if (amb.kind === 'space') {
    // mission-control beeps and radio crackle
    [0, 0.15].forEach(d => osc(t + d, 1760, 'sine', 0.025, 0.08, 0, pan));
    amb.next = 3 + r() * 5;
  } else amb.next = 5;
  dest = prev;
}
/* ---- stadium specials ---- */
function chantVoice(t, m, d, vow) {
  const f = mid(m),
    g = ac.createGain(),
    f1 = ac.createBiquadFilter(),
    f2 = ac.createBiquadFilter();
  f1.type = f2.type = 'bandpass';
  f1.Q.value = f2.Q.value = 5;
  f1.frequency.value = vow === 'e' ? 420 : 560;
  f2.frequency.value = vow === 'e' ? 1900 : 950;
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
  out(g);
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
  nz(t, 'highpass', 5200, 0.07, 0.05, 0, 0.35);
}
function conga(t, hi) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.frequency.setValueAtTime(hi ? 340 : 230, t);
  o.frequency.exponentialRampToValueAtTime(hi ? 260 : 175, t + 0.14);
  env(t, g, 0.3, 0.2);
  o.connect(g);
  out(g, hi ? 0.3 : -0.3);
  o.start(t);
  o.stop(t + 0.22);
}
function rim(t) {
  nz(t, 'bandpass', 2600, 0.26, 0.03);
  tone(t, 1700, 'square', 0.03, 0.02);
}
/* one-shot effects (cheers, crashes) */
function sfxNoise(dur, freq, vol, type) {
  if (!ac) return;
  sfx(() => {
    const t = ac.currentTime;
    if (type === 'crash') {
      nz(t, 'lowpass', freq, vol, dur);
      nz(t, 'bandpass', 3200, vol * 0.3, dur * 0.5, 0.7);
      osc(t, 90, 'sine', vol * 0.5, 0.4, 35);
    } else {
      // crowd cheer after wheelies, jumps and combos: kept quiet (33%) so it doesn't hiss over the music
      const v = vol * 0.33;
      nz(t, 'bandpass', freq, v, dur, 0.6, -0.3);
      nz(t + 0.05, 'bandpass', freq * 1.7, v * 0.6, dur * 0.9, 0.8, 0.3);
    }
  });
}

export function initSynth() {
  game.sndOn = true;
  game.engineOsc = null;
  try {
    game.sndOn = localStorage.getItem('god-snd') !== '0';
  } catch (e) {}
}

export {
  ac,
  ambienceTick,
  applyArenaAudio,
  bass,
  comp,
  conga,
  hat,
  initAudio,
  rebuildAudio,
  kick,
  kit,
  master,
  mid,
  moodLP,
  nz,
  osc,
  rim,
  setMusicLevel,
  duckMusic,
  sfx,
  sfxBus,
  sfxNoise,
  shaker,
  snare,
  stadiumChant,
  stadiumStomp,
  tom,
  tone,
  voice,
};
