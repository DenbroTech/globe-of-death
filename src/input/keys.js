import { game } from '../core/state.js';
import { press, release } from '../game/judging.js';
import { cycleCam } from '../render/camera.js';
import { setPause, start } from '../game/run.js';

const keymap = {
  ArrowUp: 'nose',
  KeyW: 'nose',
  ArrowDown: 'wheelie',
  KeyS: 'wheelie',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  KeyJ: 'jump',
  ShiftLeft: 'wheelie',
  ShiftRight: 'wheelie',
  KeyK: 'wheelie',
  KeyN: 'nose',
  KeyQ: 'ul',
  KeyE: 'ur',
  KeyZ: 'dl',
  KeyX: 'dr',
};
const FK = {
  ArrowLeft: 'l',
  KeyA: 'l',
  ArrowRight: 'r',
  KeyD: 'r',
  ArrowUp: 'u',
  KeyW: 'u',
  ArrowDown: 'd',
  KeyS: 'd',
  ShiftLeft: 'w',
  ShiftRight: 'w',
  KeyN: 'n',
};

export function initKeys() {
  addEventListener('keydown', e => {
    if (game.FREE && FK[e.code]) {
      game.fKeys[FK[e.code]] = 1;
      e.preventDefault();
    }
  });
  addEventListener('keyup', e => {
    if (FK[e.code]) game.fKeys[FK[e.code]] = 0;
  });
  addEventListener('keyup', e => {
    const k = keymap[e.code];
    if (k) release(k);
  });
  addEventListener('blur', () => {
    release('wheelie');
    release('nose');
  });
  addEventListener('keydown', e => {
    const k = keymap[e.code];
    if (k) {
      e.preventDefault();
      if (!e.repeat) press(k);
    }
    if (e.code === 'KeyC') cycleCam();
    if (e.code === 'KeyP' || e.code === 'Escape') setPause(!game.paused);
    if (e.code === 'Enter' && (!game.running || (game.over && game.slow <= 0))) start();
  });
}
