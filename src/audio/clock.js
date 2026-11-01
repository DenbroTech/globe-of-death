import { game } from '../core/state.js';
import { ac, initAudio } from './synth.js';
import { toast } from '../ui/hud.js';

let pauseAcc = 0,
  pauseAt = 0;
const wakeAudio = () => {
  // first touch anywhere starts the sound (browsers only allow audio after a gesture): menu music begins here
  if (!ac) initAudio();
  if (ac && ac.state !== 'running') ac.resume().catch(() => {});
};
const now = () => (ac ? ac.currentTime : performance.now() / 1000 - pauseAcc);
const lat = () => (ac ? ac.outputLatency || ac.baseLatency || 0 : 0);
function beatAt(t) {
  let k = game.tempos[0];
  for (const x of game.tempos) if (t >= x.time) k = x;
  return k.beat + ((t - k.time) * k.bpm) / 60;
}
function timeAt(b) {
  let k = game.tempos[0];
  for (const x of game.tempos) if (b >= x.beat) k = x;
  return k.time + ((b - k.beat) * 60) / k.bpm;
}
const FINAL = 10,
  INTRO = 8,
  LOOK = 6,
  PW = 0.085,
  GW = 0.165;
const ACT_START = [];
const actOfBar = b => {
    if (b < 3) return 1;
    let a = 1;
    while (a < ACT_START.length && b >= ACT_START[a]) a++;
    return a;
  },
  bpmOfAct = a => Math.min(96 + 3 * (a - 1), 130);

export function initClock() {
  /* ---------- clock & tempo map ---------- */
  game.tempos = [{ beat: 0, time: 0, bpm: 100 }];
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    addEventListener(ev, wakeAudio, { capture: true, passive: true }),
  );
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) wakeAudio();
  });
  setInterval(() => {
    if (
      typeof game.running !== 'undefined' &&
      game.running &&
      !game.paused &&
      !game.over &&
      ac &&
      ac.state !== 'running'
    ) {
      wakeAudio();
      toast('Tap the screen to keep riding', 900);
    }
  }, 700);
  {
    let b = 3;
    for (let a = 0; a < 60; a++) {
      ACT_START.push(b);
      b += Math.min(16 + 2 * a, 36);
    }
  }
}

export { wakeAudio, ACT_START, FINAL, GW, INTRO, LOOK, PW, actOfBar, beatAt, bpmOfAct, lat, now, timeAt };
