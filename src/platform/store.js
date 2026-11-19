import { game } from '../core/state.js';
import { $ } from '../core/constants.js';
import { isApp, toNative } from './app.js';

/* ---------- free vs full game ----------
   Free: the first three levels (FREE_LEVELS), with ads between acts.
   Full game (one-off Google Play purchase, product in mobile/store.config.js): no ads, and the cap is lifted so
   all 14 levels can be unlocked (each still opens when you finish the show on the level before).
   game.full is cached in localStorage so the game starts right; the app confirms it with Google Play on every
   launch (window.__setFull) and that answer wins.
   In a desktop browser there's no store: the full game is on, unless localStorage god-freetest = '1'
   (to try the free version on desktop). */
// (the level rules themselves live in game/unlocks.js: LEVELS order, FREE_LEVELS)

let price = '';
let onChange = [];
const store = k => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const keep = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
};

function initStore() {
  game.full = isApp ? store('god-full') === '1' : store('god-freetest') !== '1';
  // the app (mobile/App.js) answers these
  window.__setFull = v => {
    const was = game.full;
    game.full = !!v;
    keep('god-full', game.full ? '1' : '0');
    if (game.full !== was) onChange.forEach(f => f(game.full, was));
  };
  window.__price = p => {
    price = p || '';
    const b = $('#fgBuy');
    if (b && price) b.textContent = 'Buy · ' + price;
  };
  window.__buyResult = r => {
    const s = $('#fgState');
    if (!s) return;
    s.textContent = r === 'pending' ? 'Payment pending: it unlocks as soon as Google Play confirms it.' : r === 'error' ? 'Couldn’t complete the purchase. Try again.' : r === 'none' ? 'No purchase found on this Google account.' : '';
  };
}
const isFull = () => !!game.full;
const whenFullChanges = f => onChange.push(f);

/* the "Full game" sheet: what you get, the price, buy and restore */
function showFullGame(back) {
  const ov = $('#ov');
  ov.hidden = false;
  const tick = '<svg viewBox="0 0 24 24" class="fgi"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  ov.innerHTML = `<div class="card fg">
    <h1>Full game</h1>
    <ul class="fglist"><li>${tick}All 14 levels to ride</li><li>${tick}No ads</li><li>${tick}One payment, yours to keep</li></ul>
    ${
      game.full
        ? '<p class="fgok">You own the full game. Thanks!</p>'
        : `<button class="go big" id="fgBuy">${price ? 'Buy · ' + price : 'Buy'}</button><button class="go ghost" id="fgRestore">Restore purchase</button>`
    }
    <p class="fgstate" id="fgState"></p>
    <button class="go ghost" id="fgBack">Back</button></div>`;
  const st = $('#fgState');
  if ($('#fgBuy'))
    $('#fgBuy').onclick = () => {
      if (!isApp) {
        st.textContent = 'Purchases work in the Android app.';
        return;
      }
      st.textContent = '';
      toNative({ type: 'buy' });
    };
  if ($('#fgRestore'))
    $('#fgRestore').onclick = () => {
      st.textContent = 'Checking…';
      toNative({ type: 'restore' });
    };
  $('#fgBack').onclick = () => back && back();
  if (isApp) toNative({ type: 'price' });
}

export { initStore, isFull, showFullGame, whenFullChanges };
