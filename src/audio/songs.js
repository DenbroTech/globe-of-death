import { game } from '../core/state.js';
import { ARENAS } from '../arenas/arenas.js';
import { arenaId } from '../arenas/current.js';
import {
  ac,
  bass,
  comp,
  conga,
  hat,
  kick,
  kit,
  mid,
  nz,
  osc,
  rim,
  setMusicLevel,
  sfx,
  shaker,
  snare,
  tom,
  tone,
  voice,
} from './synth.js';
import { actOfBar, beatAt, bpmOfAct, lat, now, timeAt } from './clock.js';

/* ---------- songs: one per act, rotating; each arena starts on its own ---------- */
const SONGS = [
  {
    name: 'Big Top Stomp',
    prog: [45, 41, 48, 43],
    kick: [0, 4],
    snare: [2, 6],
    hat: 8,
    bass: [0, 0, 12, 0, 7, 0, 12, 7],
    bw: 'sawtooth',
  },
  {
    name: 'Surf Rock',
    prog: [45, 45, 50, 52],
    kick: [0, 3, 4],
    snare: [2, 6],
    hat: 8,
    open: [7],
    bass: [0, 0, 3, 5, 7, 5, 3, 0],
    bw: 'square',
    bcut: 900,
    lead: [12, 15, 19, null, 17, 15, 12, null],
    lw: 'square',
    lv: 0.03,
  },
  {
    name: 'Stadium Anthem',
    prog: [43, 48, 45, 41],
    kick: [0, 4],
    clap: [2, 6],
    hat: 4,
    bass: [0, null, 0, null, 0, null, 7, null],
    bw: 'sawtooth',
    bdec: 0.3,
    lead: [12, null, null, null, 19, null, 16, null],
    lw: 'sawtooth',
    lv: 0.045,
    ldec: 0.45,
    stab: [0],
  },
  {
    name: 'Neon Drive',
    prog: [45, 41, 43, 40],
    kick: [0, 4],
    snare: [2, 6],
    hat: 8,
    bass: [0, 12, 0, 12, 0, 12, 0, 12],
    bw: 'sawtooth',
    bcut: 600,
    lead: [24, 31, 36, 39, 36, 31, 27, 31],
    lw: 'triangle',
    lv: 0.05,
  },
  {
    name: 'Glitter Disco',
    prog: [45, 50, 43, 48],
    kick: [0, 2, 4, 6],
    open: [1, 3, 5, 7],
    clap: [2, 6],
    bass: [0, 12, 0, 12, 0, 12, 7, 12],
    bw: 'square',
    bcut: 1100,
    stab: [3, 7],
  },
  {
    name: 'Oompah Parade',
    prog: [48, 43, 48, 43],
    kick: [0, 4],
    snare: [2, 6],
    bass: [0, null, null, null, -5, null, null, null],
    bw: 'triangle',
    bdec: 0.45,
    bcut: 500,
    stab: [2, 6],
    lead: [24, null, 28, null, 31, null, 28, null],
    lw: 'square',
    lv: 0.025,
  },
  {
    name: 'Island Steel',
    prog: [48, 53, 55, 48],
    maj: 1,
    kick: [0, 4],
    rim: [3, 7],
    shk: [0, 1, 2, 3, 4, 5, 6, 7],
    conga: [2, 5, 6],
    bass: [0, null, 7, null, 0, null, 7, 12],
    bw: 'triangle',
    bdec: 0.3,
    bcut: 600,
    lead: [16, 19, 24, 19, 21, 19, 16, 14],
    lw: 'triangle',
    lv: 0.06,
    ldec: 0.3,
    chord: [1, 3, 5, 7],
  },
  {
    name: 'Reggae Sunset',
    prog: [50, 55, 57, 55],
    maj: 1,
    kick: [4],
    rim: [4],
    shk: [0, 2, 4, 6],
    conga: [7],
    bass: [0, null, null, 7, 5, null, 3, null],
    bw: 'sine',
    bdec: 0.4,
    bcut: 500,
    lead: [12, null, 16, 19, null, 16, 14, null],
    lw: 'triangle',
    lv: 0.06,
    ldec: 0.35,
    chord: [1, 3, 5, 7],
  },
  {
    name: 'Deep Blue',
    prog: [45, 41, 43, 40],
    kick: [0, 4],
    rim: [6],
    shk: [1, 3, 5, 7],
    bass: [0, null, null, 7, null, 0, null, 5],
    bw: 'sine',
    bdec: 0.5,
    bcut: 400,
    lead: [12, null, 19, null, 24, null, 19, 15],
    lw: 'sine',
    lv: 0.07,
    ldec: 0.3,
    chord: [2, 6],
  },
  {
    name: 'Coral Drift',
    prog: [50, 46, 53, 48],
    maj: 1,
    kick: [0, 3, 4],
    rim: [2, 6],
    hat: 4,
    bass: [0, 0, null, 7, null, 12, null, 7],
    bw: 'sine',
    bdec: 0.35,
    bcut: 500,
    lead: [12, 16, 19, 24, 19, 16, 12, null],
    lw: 'sine',
    lv: 0.06,
    ldec: 0.25,
    chord: [1, 5],
  },
  {
    name: 'Lunar Lounge',
    prog: [45, 50, 43, 48],
    kick: [0, 4],
    rim: [2, 6],
    hat: 8,
    bass: [0, null, 7, null, 0, null, 10, null],
    bw: 'triangle',
    bdec: 0.4,
    bcut: 500,
    lead: [12, null, null, 15, null, 19, null, 17],
    lw: 'sine',
    lv: 0.07,
    ldec: 0.6,
  },
];
const songFor = a => {
  const L = ARENAS[arenaId].songs;
  return L[(a - 1 + L.length * 99) % L.length];
};
const PENTA = { left: 0, dl: 3, ul: 5, right: 7, dr: 10, ur: 12, up: 12, down: 0 };
function songRoot() {
  const B = beatAt(now() - lat()),
    bar = Math.max(0, Math.floor(B / 4)),
    S = SONGS[songFor(actOfBar(Math.max(bar, 3)))];
  return S.prog[bar % 4];
}
function hitSound(type, step, g) {
  if (!ac) return;
  sfx(() => hitSound_(type, step, g));
}
function hitSound_(type, step, g) {
  const t = ac.currentTime,
    r = songRoot() + 24,
    K = kit(),
    V = K.hit || 'tri';
  if (type === 'jump') {
    const J = K.jump;
    if (J === 'slide') {
      osc(t, mid(r), 'sine', 0.11, 0.4, mid(r + 19));
      osc(t, mid(r + 12), 'triangle', 0.03, 0.3, mid(r + 31));
      return;
    }
    if (J === 'horn') {
      [0, 4, 7].forEach(i => voice('brass', t, r + i - 12, 0.06, 0.55));
      return;
    }
    if (J === 'swoop') {
      [0, 7, 12].forEach((iv, i) => voice('theremin', t + i * 0.07, r + iv + 12, 0.07, 0.3));
      return;
    }
    if (J === 'bubbles') {
      [0, 3, 7, 10, 12, 15].forEach((iv, i) => voice('bubble', t + i * 0.04, r + 12 + iv, 0.07, 0.18));
      return;
    }
    [0, 7, 12, 19].forEach((iv, i) => voice(V, t + i * 0.045, r + iv, 0.08 - i * 0.012, 0.4 - i * 0.05));
    return;
  }
  if (type === 'wheelie' || type === 'nose' || type === 'standl' || type === 'standr' || type === 'stand') {
    const up = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28],
      m = r + up[Math.min(up.length - 1, step || 0)] + (type === 'nose' ? -5 : 0);
    voice(V, t, m, type.startsWith('stand') ? 0.1 : 0.085, 0.38);
    if (V === 'tri') tone(t, mid(m + 12), type === 'wheelie' ? 'square' : 'sawtooth', 0.03, 0.25, 2000);
    return;
  }
  const m = r + (PENTA[type] ?? 0);
  voice(V, t, m, g === 'p' ? 0.15 : 0.1, 0.28);
}
function clap(t) {
  nz(t, 'bandpass', 1300, 0.35, 0.06);
  nz(t + 0.012, 'bandpass', 1100, 0.3, 0.09);
  nz(t + 0.024, 'bandpass', 1200, 0.28, 0.14);
}
/* one 8th-note step of a song: drums, bass, lead, the arena's chord comping and pad */
function playStep(S, k, bar, a, t, spb) {
  if (S.kick.includes(k) || (a >= 5 && k === 7 && S.kick.length < 4)) kick(t);
  if (S.snare && S.snare.includes(k)) snare(t);
  if (S.clap && S.clap.includes(k)) clap(t);
  if (S.hat === 8 || (S.hat === 4 && k % 2 === 0)) hat(t, false);
  if (S.open && S.open.includes(k)) hat(t, true);
  const K = kit(),
    root = S.prog[bar % 4],
    bn = S.bass[k];
  if (bn != null) bass(t, mid(root + bn), S);
  if (S.lead && bar >= 3) {
    const ln = S.lead[k];
    if (ln != null) voice(K.lead || 'tri', t, root + ln + 12, S.lv * 1.3, (S.ldec || 0.16) + 0.08);
  }
  if (S.stab && S.stab.includes(k)) [12, 16, 19].forEach(i => voice(K.stab || 'organ', t, root + i, 0.03, 0.14));
  if (S.chord && S.chord.includes(k)) [12, S.maj ? 16 : 15, 19].forEach(i => voice(K.stab || 'tri', t, root + i, 0.028, 0.16));
  comp(t, root, k, S.maj, spb);
  // stadium: tom fill rolling into every 4th bar
  if (K.toms && bar % 4 === 3 && k >= 5) tom(t, [196, 164, 130][k - 5]);
  if (S.rim && S.rim.includes(k)) rim(t);
  if (S.shk && S.shk.includes(k)) shaker(t);
  if (S.conga && S.conga.includes(k)) conga(t, k % 2 === 1);
}
function scheduleStep(s) {
  if (!ac) return;
  const B = s / 2,
    t = timeAt(B),
    bar = Math.floor(B / 4),
    k = ((s % 8) + 8) % 8,
    a = actOfBar(Math.max(bar, 3)),
    S = SONGS[songFor(a)];
  if (bar < 1) {
    if (k % 4 === 0) kick(t);
    hat(t, false);
  } else {
    playStep(S, k, bar, a, t, 30 / bpmOfAct(a));
  }
  if (bar === 1 && k >= 6) snare(t);
  if (bar === 1 && k % 2 === 0) tone(t, k === 6 ? 1320 : 660, 'square', 0.12, 0.12);
  // move cues one bar ahead: short sfx blips
  for (const n of game.notes)
    if (n.beat === B + 4)
      sfx(() => {
        const f = {
          up: 1046,
          down: 698,
          left: 784,
          right: 880,
          ul: 988,
          ur: 932,
          dl: 740,
          dr: 659,
          jump: 392,
          wheelie: 523,
        }[n.type];
        if (n.type === 'standl' || n.type === 'standr') {
          tone(t, 587, 'sine', 0.08, 0.12);
          tone(t + 0.08, 880, 'sine', 0.08, 0.18);
        } else if (n.type === 'nose') {
          tone(t, 784, 'triangle', 0.07, 0.1);
          tone(t + 0.08, 659, 'triangle', 0.07, 0.1);
          tone(t + 0.16, 523, 'triangle', 0.07, 0.18);
        } else if (n.type === 'wheelie') {
          tone(t, 523, 'triangle', 0.07, 0.1);
          tone(t + 0.08, 659, 'triangle', 0.07, 0.1);
          tone(t + 0.16, 784, 'triangle', 0.07, 0.18);
        } else tone(t, f, n.type === 'jump' ? 'sawtooth' : 'triangle', 0.08, 0.11, n.type === 'jump' ? 1600 : 0);
      });
}
/* menus: the arena's first song loops quietly (music bus at half volume) */
const menu = { t: 0, step: 0, on: false };
function menuMusic() {
  if (!ac || ac.state !== 'running') return;
  const inRide = game.running && !game.over;
  setMusicLevel(inRide ? 1 : 0.33); // menus: a third of the ride volume
  if (inRide || game.paused) {
    menu.on = false;
    return;
  }
  const spb = 30 / bpmOfAct(1);
  if (!menu.on) {
    menu.on = true;
    menu.step = 24; // start at bar 3 so the melody comes straight in
    menu.t = ac.currentTime + 0.1;
  }
  while (menu.t < ac.currentTime + 0.2) {
    const bar = Math.floor(menu.step / 8),
      S = SONGS[songFor(1 + (Math.floor(bar / 16) % 2))];
    playStep(S, menu.step % 8, bar, 1, menu.t, spb);
    menu.step++;
    menu.t += spb;
  }
}

export { SONGS, clap, hitSound, menuMusic, scheduleStep, songFor };
