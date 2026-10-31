import { CATALOG } from '../bikes/catalog.js';

/* ---------- garage save (tickets + unlocks) ---------- */
let garage = {
  tickets: 0,
  owned: { style: ['classic'], paint: ['red', 'black'], costume: ['leathers'] },
  sel: { style: 'classic', paint: 'red', costume: 'leathers' },
};
// preview build: everything unlocked
function saveGarage() {
  try {
    localStorage.setItem('god-garage', JSON.stringify(garage));
  } catch (e) {}
}

export function initSave() {
  try {
    const sv = JSON.parse(localStorage.getItem('god-garage'));
    if (sv && sv.owned && sv.sel) garage = sv;
  } catch (e) {}
  if (garage.sel.helmet === undefined) garage.sel.helmet = null;
  if (garage.sel.suit === undefined) garage.sel.suit = null;
  for (const k in CATALOG) garage.owned[k] = CATALOG[k].map(i => i.id);
}

export { garage, saveGarage };
