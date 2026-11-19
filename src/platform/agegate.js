import { isApp, toNative } from './app.js';

/* ---------- neutral age question (once, in the app) ----------
   Globe Riders is for all ages, so before any ad is requested the player picks their birth year from a plain
   list (no default, no hint about what "should" be picked, as Google Play's Families policy asks). The answer
   is reduced to a group and kept on the phone:
     child  (under 13): ads are tagged child-directed, rated G and never personalised
     teen   (13–15):    tagged "under the age of consent", rated PG
     adult  (16+):      Google's consent form where the law needs one, rated PG
   The native side (mobile/App.js) waits for this before it starts AdMob. */
const KEY = 'god-age';
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
};
const send = group => toNative({ type: 'age', group });

function groupFor(year) {
  const age = new Date().getFullYear() - year; // may be a year high before their birthday: rounds toward older only by < 1
  return age - 1 < 13 ? 'child' : age - 1 < 16 ? 'teen' : 'adult';
}

function initAgeGate() {
  if (!isApp) return;
  const known = read();
  if (known) return send(known);
  const now = new Date().getFullYear(),
    years = [];
  for (let y = now; y >= now - 100; y--) years.push(y);
  const el = document.createElement('div');
  el.className = 'agegate';
  el.innerHTML = `<div class="agecard"><h1>Welcome, rider</h1><p>What year were you born?</p>
    <select id="ageYear" aria-label="Year of birth"><option value="" selected disabled>Choose year</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}</select>
    <button class="go big" id="ageOk" disabled>Continue</button></div>`;
  document.body.appendChild(el);
  const sel = el.querySelector('#ageYear'),
    ok = el.querySelector('#ageOk');
  sel.onchange = () => (ok.disabled = !sel.value);
  ok.onclick = () => {
    if (!sel.value) return;
    const g = groupFor(+sel.value);
    try {
      localStorage.setItem(KEY, g);
    } catch (e) {}
    el.remove();
    send(g);
  };
}

export { initAgeGate };
