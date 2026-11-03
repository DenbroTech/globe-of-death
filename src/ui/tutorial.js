import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { beatAt, lat, now } from '../audio/clock.js';
import { addNote } from '../game/chart.js';
import { ov, showJudge } from './hud.js';
import { drawStash, offerPerks } from '../game/perks.js';
import { resetCam } from '../render/camera.js';
import { boostActive } from '../game/boost.js';
import { holdClock } from '../game/judging.js';
import { quitToMenu, resetInput, start } from '../game/run.js';
import { $ } from '../core/constants.js';

let tutEl;

/* ---------- tutorial: one thing at a time, do it to move on ---------- */
const tutDone = () => {
  try {
    return localStorage.getItem('god-tut') === '1';
  } catch (e) {
    return false;
  }
};
let tutTipT = 0;
const TUT_STEPS = [
  {
    t: 'Steer left',
    d: 'When the blue arrow reaches the circle on the left, swipe left anywhere on the screen.',
    need: 2,
    ev: 'hit',
    ok: x => x === 'left',
    gen: b => addNote(b * 4, 'left'),
  },
  {
    t: 'Steer right',
    d: 'Now the other way. Swipe right as the arrow hits the circle.',
    need: 2,
    ev: 'hit',
    ok: x => x === 'right',
    gen: b => addNote(b * 4, 'right'),
  },
  {
    t: 'Camera',
    d: 'Tap the camera button at the top to switch view. Try a few: you\'ll go back to Centre after.',
    need: 3,
    ev: 'cam',
    cam: true,
    gen: () => {}, // no moves: just ride and look around
  },
  {
    t: 'Veers and hard turns',
    d: 'Diagonal arrows: up-left and up-right are gentle veers, down-left and down-right are hard turns. Swipe the way the arrow points.',
    need: 3,
    ev: 'hit',
    ok: x => ['ul', 'ur', 'dl', 'dr'].includes(x),
    gen: b => addNote(b * 4, ['ul', 'ur', 'dr', 'dl'][b % 4]),
  },
  {
    t: 'Jump',
    d: 'Red notes are jumps. Flick your thumb up and let go. Later, other riders cut across and you jump over them.',
    need: 2,
    ev: 'hit',
    ok: x => x === 'jump',
    gen: b => addNote(b * 4, 'jump'),
  },
  {
    t: 'Wheelie',
    d: 'Gold bars are wheelies. Pull your thumb down and keep holding until the whole bar has passed the circle.',
    need: 1,
    ev: 'hold',
    ok: x => x === 'wheelie',
    gen: b => {
      if (b % 2 === 1) addNote(b * 4, 'wheelie', 3);
    },
  },
  {
    t: 'Stoppie',
    d: 'Pink bars are stoppies. Push your thumb up, hold it there, and only let go once the bar has passed.',
    need: 1,
    ev: 'hold',
    ok: x => x === 'nose',
    gen: b => {
      if (b % 2 === 1) addNote(b * 4, 'nose', 3);
    },
  },
  {
    t: 'Seat stand',
    d: 'Long blue bars with an arrow: swipe that way and keep holding to stand on the seat.',
    need: 1,
    ev: 'hold',
    ok: x => x.startsWith('stand'),
    gen: b => {
      if (b % 2 === 1) addNote(b * 4, b % 4 === 1 ? 'standl' : 'standr', 3);
    },
  },
  {
    t: 'Steer during a wheelie',
    d: 'Pull back into the wheelie and keep holding. When the arrow arrives, slide the same thumb left without letting go.',
    need: 1,
    ev: 'double',
    gen: b => {
      if (b % 2 === 1) {
        addNote(b * 4, 'wheelie', 4);
        addNote(b * 4 + 2, 'left');
      }
    },
  },
  {
    t: 'NOS',
    d: 'NOS plays the next few moves for you automatically. It charges while your balance is full, and it is full now: tap the red NOS button on the handlebars.',
    need: 1,
    ev: 'nos',
    gen: b => {
      addNote(b * 4, b % 2 ? 'left' : 'right');
      if (!boostActive()) game.boostCharge = 100;
    },
  },
  {
    t: 'Action',
    d: 'Some perks are stored for later (shown in gold at the top). Quick swipe down to use one. Holding down is still a wheelie.',
    need: 1,
    ev: 'action',
    gen: () => {
      if (!game.stash) {
        game.stash = 'refill';
        drawStash();
      }
    },
  },
  {
    t: 'Perks',
    d: 'The yellow line ends an act: pick a perk to help you. Sometimes a curse follows: pick the least bad. It lasts one act.',
    need: 1,
    ev: 'perk',
    gen: b => {
      // the yellow act line arrives a couple of bars later, once the NOS has finished
      if (game.tutLine == null && !boostActive()) game.tutLine = b * 4 + 4;
    },
  },
];
// the yellow act line only shows in the Perks step: when it reaches the circle, a perk pick pops up
function tutTick(B) {
  // the Camera step has no moves: if the camera button isn't tapped 3 times within ~4 bars, move on anyway
  // (testers thought the lesson had ended after Steer right)
  const S = TUT_STEPS[game.tutI];
  if (S && S.cam) {
    if (game.tutCamB == null) game.tutCamB = B;
    else if (B - game.tutCamB > 16) {
      game.tutCamB = null;
      while (TUT_STEPS[game.tutI] === S) tutEv('cam');
    }
  } else game.tutCamB = null;
  if (game.tutLine != null && B >= game.tutLine) {
    game.tutLine = Infinity; // shown once: never triggers again
    tutEl.hidden = true;
    offerPerks(0, true);
  }
}
function tutDraw(pop) {
  const S = TUT_STEPS[game.tutI];
  if (!S) {
    $('#camBtn').classList.remove('hint');
    tutEl.hidden = true;
    return;
  }
  tutEl.hidden = false;
  // point at the camera button while that step is up
  $('#camBtn').classList.toggle('hint', !!S.cam);
  tutEl.innerHTML = `<div class="tk"><span>Tutorial · ${game.tutI + 1} of ${TUT_STEPS.length}</span><button id="tutSkip">Skip</button></div><h3>${S.t}</h3><p>${S.d}</p><div class="dots">${[...Array(S.need)].map((_, i) => `<i class="${i < game.tutN ? 'on' : ''}"></i>`).join('')}</div><div class="tip" id="tutTip"></div>`;
  $('#tutSkip').onclick = () => tutFinish(true);
  if (pop) {
    tutEl.classList.remove('pop');
    void tutEl.offsetWidth;
    tutEl.classList.add('pop');
  }
}
function tutGen(b) {
  if (b < 3) return;
  const S = TUT_STEPS[game.tutI];
  if (S) S.gen(b);
}
function tutCut(B) {
  const keep = [];
  for (const n of game.notes) {
    if (!n.judged && n.beat > B + 0.6 && n !== game.holdNote) n.el.remove();
    else keep.push(n);
  }
  game.notes = keep;
  const k = game.turns.findIndex(t => t.beat > B + 0.6);
  if (k >= 0) game.turns.splice(k);
  game.holdEnd = game.holdNote ? game.holdNote.beat + game.holdNote.len : -9;
  game.lastNoteBeat = Math.min(game.lastNoteBeat, B);
  game.genBar = Math.floor(B / 4) + 2;
}
function tutEv(kind, type) {
  if (!game.TUT) return;
  const S = TUT_STEPS[game.tutI];
  if (!S) return;
  if (kind === 'miss' || kind === 'drop') {
    const tip = $('#tutTip');
    if (tip)
      tip.textContent =
        kind === 'drop'
          ? 'Let go too early. Keep holding until the bar passes the circle.'
          : 'Missed that one. Try again on the next.';
    return;
  }
  if (kind !== S.ev || (S.ok && !S.ok(type))) return;
  game.tutN++;
  tutDraw();
  if (game.tutN >= S.need) {
    if (S.cam) setTimeout(resetCam, 400); // back to Centre so nobody gets stuck in an odd view
    game.tutI++;
    game.tutN = 0;
    showJudge('p', 'NICE!');
    game.cheer = 1;
    crowd.wave();
    tutCut(beatAt(now() - lat()));
    if (game.tutI >= TUT_STEPS.length) setTimeout(() => tutFinish(false), 900);
    else setTimeout(() => tutDraw(true), 500);
  }
}
function tutFinish(skipped) {
  try {
    localStorage.setItem('god-tut', '1');
  } catch (e) {}
  tutEl.hidden = true;
  $('#camBtn').classList.remove('hint');
  if (!game.running) return;
  resetInput();
  game.paused = true;
  holdClock();
  ov.hidden = false;
  ov.innerHTML = `<div class="card"><h1><small>Tutorial ${skipped ? 'skipped' : 'complete'}</small>${skipped ? 'Ready when you are' : 'You know every move'}</h1>
  <p>The bar at the top is your balance. Misses knock it down, hits win it back. Empty means crash. Ten acts finish the show.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="go" id="tutGo">Start the show</button><button class="go ghost" id="tutMenu">Menu</button></div></div>`;
  $('#tutGo').onclick = () => {
    game.TUT = false;
    game.gameMode = 'show';
    start();
  };
  $('#tutMenu').onclick = () => {
    game.TUT = false;
    quitToMenu();
  };
}
function startTutorial() {
  game.tutPending = true;
  game.tutLine = null;
  game.gameMode = 'show';
  start();
}

export function initTutorial() {
  game.TUT = false;
  game.tutPending = false;
  game.tutI = 0;
  game.tutN = 0;
  tutEl = $('#tut');
}

export { startTutorial, tutDone, tutDraw, tutEl, tutEv, tutGen, tutTick };
