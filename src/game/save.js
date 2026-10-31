
/* ---------- garage save: current picks (unlocks live in game/unlocks.js) ---------- */
let garage = {
  tickets: 0,
  owned: { style: ['classic'], paint: ['red', 'black'], costume: ['leathers'] },
  sel: { style: 'classic', paint: 'red', costume: 'leathers' },
};
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
}

export { garage, saveGarage };
