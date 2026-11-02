import { game } from '../core/state.js';
import { ACT_START, actOfBar, timeAt } from '../audio/clock.js';
import { actBpm, cursed } from './perks.js';
import { addTurn } from './path.js';
import { setCross } from './freeride.js';
import { $ } from '../core/constants.js';

let notesEl;

const ARROW = '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>';
const ICON = {
  up: ARROW,
  down: ARROW,
  left: ARROW,
  right: ARROW,
  ul: ARROW,
  ur: ARROW,
  dl: ARROW,
  dr: ARROW,
  jump: 'JUMP',
  wheelie: 'WHEELIE',
  nose: 'STOPPIE',
  standl: ARROW,
  standr: ARROW,
};
const DIRS = ['up', 'down', 'left', 'right', 'ul', 'ur', 'dl', 'dr'],
  ROT = { up: 0, ur: 45, right: 90, dr: 135, down: 180, dl: 225, left: 270, ul: 315 };
function addNote(beat, type, len, decoy) {
  const n = { beat, type, judged: null, len: len || 0, decoy: !!decoy };
  if (decoy) {
  } else if (DIRS.includes(type)) {
    addTurn(beat, type);
    n.to = true;
    game.lastTiltBeat = beat;
  } else if (n.len) {
  } else {
    game.lastJumpBeat = beat;
    n.beat = beat;
    setCross(n);
  }
  n.el = document.createElement('div');
  n.el.className = 'note ' + type + (DIRS.includes(type) ? ' dir' : '') + (decoy ? ' decoy' : '');
  n.el.innerHTML = ICON[type];
  if (DIRS.includes(type)) n.el.style.setProperty('--r', ROT[type] + 'deg');
  if (type === 'standl' || type === 'standr') n.el.style.setProperty('--r', (type === 'standl' ? 270 : 90) + 'deg');
  notesEl.appendChild(n.el);
  game.notes.push(n);
  if (decoy) return;
  game.lastNoteBeat = beat + (n.len ? 0.5 : 0);
  if (n.len) {
    game.holdEnd = beat + n.len;
    game.holdStart = beat;
    game.holdSingles = 0; // single moves placed inside this long press (max 2)
  }
}
let ppbNow = 50;
function genBarNotes(b) {
  const a = actOfBar(b);
  if ((b >= 3 && actOfBar(b - 1) !== a) || b === 3) {
    const bpm = actBpm(a);
    if (game.tempos[game.tempos.length - 1].bpm !== bpm) game.tempos.push({ beat: b * 4, time: timeAt(b * 4), bpm });
  }
  if (b < 3 || (b > 3 && ACT_START.includes(b))) return; // first bar of every act is a breather
  let slots;
  const r = Math.random();
  const P1 = [[0], [2]],
    P2 = [
      [0, 2],
      [0, 3],
    ],
    P3 = [
      [0, 1, 2],
      [0, 2, 3],
    ],
    P3h = [
      [0, 1.5, 2],
      [0, 2, 3.5],
    ],
    P4 = [
      [0, 1, 2, 3],
      [0, 1, 1.5, 2.5],
    ],
    P5 = [
      [0, 1.5, 2, 3, 3.5],
      [0, 1, 2, 2.5, 3],
    ];
  const mix = [
    null,
    [[P1, 1]],
    [
      [P1, 0.55],
      [P2, 0.45],
    ],
    [
      [P1, 0.2],
      [P2, 0.8],
    ],
    [
      [P2, 0.6],
      [P3, 0.4],
    ],
    [
      [P2, 0.3],
      [P3, 0.7],
    ],
    [
      [P3, 0.6],
      [P3h, 0.4],
    ],
    [
      [P3, 0.4],
      [P3h, 0.3],
      [P4, 0.3],
    ],
    [
      [P3h, 0.4],
      [P4, 0.6],
    ],
    [
      [P4, 0.7],
      [P5, 0.3],
    ],
    [
      [P4, 0.5],
      [P5, 0.5],
    ],
  ][Math.min(a + (cursed('double') ? 3 : 0), 10)];
  {
    let q = r,
      pick = mix[mix.length - 1][0];
    for (const [pp, w] of mix) {
      if (q < w) {
        pick = pp;
        break;
      }
      q -= w;
    }
    slots = pick === P1 ? [b % 2 ? 2 : 0] : pick[Math.floor(Math.random() * pick.length)];
  }
  const actEnd = (ACT_START.find(x => x > b) || 9999) * 4;
  const mania = cursed('wheelies');
  if (
    b >= 5 &&
    b - game.lastWheelieBar >= (mania ? 1 : 3) &&
    b * 4 >= game.holdEnd + 1 &&
    Math.random() < (mania ? 1 : 0.4) &&
    actEnd - 1 - b * 4 >= 2
  ) {
    game.lastWheelieBar = b;
    const len = Math.min(
        mania ? 2 + Math.floor(Math.random() * 2) : [2, 2, 3, 3, 4, 5, 6][Math.floor(Math.random() * 7)],
        actEnd - 1 - b * 4,
      ),
      hr = Math.random(),
      ht = a < 2 ? 'wheelie' : hr < 0.4 ? 'wheelie' : hr < 0.7 ? 'nose' : Math.random() < 0.5 ? 'standl' : 'standr';
    addNote(b * 4, ht, len);
    slots = a >= 5 ? (r < 0.5 ? [1, 2, len + 1] : [1.5, len + 1]).filter(x => x < 4) : slots.filter(s => s >= len + 1);
  }
  for (const s of slots) {
    const B = b * 4 + s;
    if (B > actEnd - 1) continue;
    // at most two single moves while a long press is held (holds can run into the next bar)
    const inHold = B > (game.holdStart ?? -9) && B < game.holdEnd;
    if (inHold && game.holdSingles >= 2) continue;
    // keep a clear beat either side of where a long press ends, so it's never unclear if a move is in or out
    if (Math.abs(B - game.holdEnd) < 1) continue;
    let type;
    const canJump =
        B - game.lastTiltBeat >= 1 &&
        B - game.lastJumpBeat >= 1 &&
        B - game.lastNoteBeat >= 0.5 &&
        B >= game.holdEnd + 0.5,
      canTilt = B - game.lastNoteBeat >= 0.5;
    const wantJump = a === 1 ? b % 2 === 0 : Math.random() < Math.min(0.55, 0.3 + 0.03 * a);
    if (wantJump && canJump) type = 'jump';
    else if (canTilt) {
      const opts = ['left', 'right'];
      if (a >= 3) opts.push('ul', 'ur', 'dl', 'dr');
      type = opts[Math.floor(Math.random() * opts.length)];
    } else continue;
    addNote(B, type);
    if (inHold) game.holdSingles++;
  }
  // Decoys curse: a crossed-out move in a gap, at least a beat clear of anything real
  if (cursed('decoys') && Math.random() < 0.7) {
    const B = b * 4 + [1, 2, 3][Math.floor(Math.random() * 3)];
    const clear = !game.notes.some(
      n => Math.abs(n.beat - B) < 1 || (n.len && B > n.beat - 1 && B < n.beat + n.len + 1),
    );
    if (clear && B <= actEnd - 1)
      addNote(B, ['left', 'right', 'ul', 'ur', 'dl', 'dr'][Math.floor(Math.random() * 6)], 0, true);
  }
}

export function initChart() {
  /* ---------- song / chart ---------- */
  game.notes = [];
  game.genBar = 0;
  game.lastNoteBeat = -9;
  game.lastTiltBeat = -9;
  game.lastJumpBeat = -9;
  game.planned = { tilt: 0, yaw: 0 };
  game.schedStep = 0;
  game.holdNote = null;
  game.wheelieDown = false;
  game.noseDown = false;
  game.lastWheelieBar = -9;
  game.encore = false;
  game.running = false;
  game.paused = false;
  game.over = null;
  game.score = 0;
  game.combo = 0;
  game.balance = 100;
  game.act = 1;
  game.stats = undefined;
  game.slow = 0;
  game.cheer = 0;
  game.lastBarShown = -1;
  game.best = 0;
  try {
    game.best = +localStorage.getItem('god-beat-best') || 0;
  } catch (e) {}
  notesEl = $('#notes');
  game.holdEnd = -9;
}

export { DIRS, addNote, genBarNotes };
