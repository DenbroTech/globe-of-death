import { globe } from '../arenas/globe.js';
import { makeBike } from '../bikes/bike.js';
import { garage } from './save.js';
import { glowSprite, makeRibbon, makeTrail } from '../render/trails.js';
import { V3 } from '../core/constants.js';

let player, myRing, pool;

const RIDERS = [
  ['Dario', 0xf4b400],
  ['Tess', 0x2ec4b6],
  ['Viktor', 0x9b5de5],
  ['Lupe', 0x8ac926],
  ['Mack', 0xff7a1a],
  ['Sky', 0x4cc9f0],
  ['Pia', 0xff4fa3],
];
const CROSS = [
  ['Dario', 0xf4b400],
  ['Tess', 0x2ec4b6],
  ['Viktor', 0x9b5de5],
  ['Lupe', 0x8ac926],
  ['Mack', 0xff7a1a],
  ['Nico', 0xe63946],
  ['Rosa', 0xff70a6],
  ['Bruno', 0x6c757d],
  ['Ines', 0x00b4d8],
];
const RSTY = ['classic', 'dirt', 'chopper', 'vintage', 'sport'],
  RCOS = ['leathers', 'daredevil', 'clown', 'skeleton', 'punk', 'hero', 'devil'];

export function initObjects() {
  /* ---------- 3D objects ---------- */
  player = { bike: makeBike(garage.sel), p: new V3(), t: new V3(), hopT0: -9, shake: 0, wh: 0 };
  globe.add(player.bike.g);
  player.trail = makeTrail(0xe63946);
  myRing = makeRibbon(0xffffff, 0.022, 0.5);
  pool = CROSS.map(([name, hex], i) => {
    const costume = RCOS[(i * 3 + 1) % 7];
    // riders in plain leathers wear their bike's colour, so the field stays varied
    const bike = makeBike({ paintHex: hex, style: RSTY[i % 5], costume, suitHex: costume === 'leathers' ? hex : undefined });
    bike.g.visible = false;
    globe.add(bike.g);
    // where they're heading: a line ahead of them in their colour (like your trail, but forwards)
    const ahead = makeTrail(hex);
    const mark = glowSprite(0xff2a40, 1.5);
    mark.visible = false;
    globe.add(mark);
    const trail = makeTrail(hex);
    return { name, hex, bike, ahead, mark, trail, busy: false };
  });
}

export { myRing, player, pool };
