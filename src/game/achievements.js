import { game } from '../core/state.js';
import { career, earned } from './unlocks.js';
import { playGamesOn, toNative } from '../platform/app.js';

/* ---------- Google Play Games achievements ----------
   Each achievement here needs a matching one created in Play Console (Play Games Services → Achievements),
   with its ID pasted into mobile/playGames.config.js under the same key. They're checked after every run
   (checkAchievements, from recordRun) and kept on the phone; everything earned so far is sent again each
   time Play Games signs in, so nothing is lost if the player wasn't signed in when they earned it. */
const NEONS = ['synth', 'npink', 'nblue', 'ngreen', 'norange', 'npurple', 'nyellow', 'tubes'];
const BIKES = ['dirt', 'chopper', 'vintage', 'sport', 'rocket'];
const ACH = {
  first_show: () => career.shows >= 1, // Showtime: play your first show
  act5: () => career.act >= 5, // Halfway there: reach act 5
  showstopper: () => career.win >= 1, // Showstopper: finish all ten acts
  combo25: () => career.combo >= 25, // On a roll: combo ×25
  combo100: () => career.combo >= 100, // Unstoppable: combo ×100
  perfects500: () => career.perf >= 500, // Perfectionist: 500 perfect moves
  cursed: () => !!rec.cursed, // Curse breaker: survive a cursed act
  free60: () => career.free >= 60, // Survivor: last a minute in free ride
  free300: () => career.free >= 300, // Iron nerve: last five minutes in free ride
  near50: () => career.near >= 50, // Close shave: 50 near misses
  new_bike: () => BIKES.some(b => earned('style', b)), // New wheels: unlock a new bike
  neon: () => NEONS.some(p => earned('paint', p)), // Glow up: unlock a neon paint
  three_levels: () => (rec.rode || []).length >= 3, // Globetrotter: ride three different levels
  all_levels: () => (rec.rode || []).length >= 14, // World tour: ride all 14 levels
};

let got = new Set(),
  rec = {};
const load = () => {
  try {
    got = new Set(JSON.parse(localStorage.getItem('god-ach') || '[]'));
    rec = JSON.parse(localStorage.getItem('god-achrec') || '{}');
  } catch (e) {}
};
const save = () => {
  try {
    localStorage.setItem('god-ach', JSON.stringify([...got]));
    localStorage.setItem('god-achrec', JSON.stringify(rec));
  } catch (e) {}
};
const send = key => playGamesOn() && toNative({ type: 'ach', key });

/* after a run: run = { arena, cursed } */
function checkAchievements(run = {}) {
  if (game.TUT) return;
  if (run.arena) rec.rode = [...new Set([...(rec.rode || []), run.arena])];
  if (run.cursed) rec.cursed = true;
  for (const [key, test] of Object.entries(ACH))
    if (!got.has(key) && test()) {
      got.add(key);
      send(key);
    }
  save();
}

function initAchievements() {
  load();
  // Play Games just signed in: (re)send everything earned on this phone
  const prev = window.__pgReady;
  window.__pgReady = () => {
    if (prev) prev();
    got.forEach(send);
  };
}
const showPlayAchievements = () => toNative({ type: 'achievements' });

export { ACH, checkAchievements, initAchievements, showPlayAchievements };
