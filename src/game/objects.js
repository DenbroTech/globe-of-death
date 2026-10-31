import { globe } from '../arenas/globe.js';
import { makeBike } from '../bikes/bike.js';
import { garage } from './save.js';
import { glowSprite, makeRing, makeTrail } from '../render/trails.js';
import { V3 } from '../core/constants.js';

let player, myRing, nextRing, pool;

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
  myRing = makeRing(0xffffff, 0.014, 0.28, false);
  nextRing = makeRing(0x6fd3ff, 0.04, 0.6, true);
  myRing.visible = nextRing.visible = false;
  pool = CROSS.map(([name, hex], i) => {
    const costume = RCOS[(i * 3 + 1) % 7];
    // riders in plain leathers wear their bike's colour, so the field stays varied
    const bike = makeBike({ paintHex: hex, style: RSTY[i % 5], costume, suitHex: costume === 'leathers' ? hex : undefined });
    bike.g.visible = false;
    globe.add(bike.g);
    const beacon = glowSprite(hex, 0.8);
    beacon.position.set(0, 1.55, 0);
    bike.m.add(beacon);
    const dots = [];
    for (let i = 0; i < 12; i++) {
      const d = glowSprite(hex, 0.32);
      d.visible = false;
      globe.add(d);
      dots.push(d);
    }
    const mark = glowSprite(0xff2a40, 1.5);
    mark.visible = false;
    globe.add(mark);
    const trail = makeTrail(hex);
    return { name, hex, bike, dots, mark, trail, busy: false };
  });
}

export { myRing, nextRing, player, pool };
