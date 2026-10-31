import { game } from './core/state.js';
import { arenaId, setArena } from './arenas/current.js';
import { beatAt, lat, now, timeAt } from './audio/clock.js';
import { orientOnWall, posAt, tanAt } from './game/path.js';
import { player } from './game/objects.js';
import { drawHearts } from './ui/hud.js';
import { useBoost } from './game/boost.js';
import { press, release } from './game/judging.js';
import { resize } from './render/camera.js';
import { frame } from './game/loop.js';
import { showStart } from './ui/menus.js';
import { initRenderer } from './render/renderer.js';
import { initTextures } from './render/textures.js';
import { initLights } from './render/lights.js';
import { initStage } from './arenas/stage.js';
import { initCrowd } from './arenas/crowd.js';
import { initGlobe } from './arenas/globe.js';
import { initArenas } from './arenas/arenas.js';
import { initSealife } from './arenas/sealife.js';
import { initProgress } from './game/progress.js';
import { initCurrent } from './arenas/current.js';
import { initBike } from './bikes/bike.js';
import { initNeon } from './render/neon.js';
import { initRiderModel } from './rider/riderModel.js';
import { initSave } from './game/save.js';
import { initTrails } from './render/trails.js';
import { initParticles } from './render/particles.js';
import { initSynth } from './audio/synth.js';
import { initClock } from './audio/clock.js';
import { initPath } from './game/path.js';
import { initFreeride } from './game/freeride.js';
import { initObjects } from './game/objects.js';
import { initChart } from './game/chart.js';
import { initHud } from './ui/hud.js';
import { initBoost } from './game/boost.js';
import { initJudging } from './game/judging.js';
import { initKeys } from './input/keys.js';
import { initControls } from './input/controls.js';
import { initCamera } from './render/camera.js';
import { initPerks } from './game/perks.js';
import { initGarage } from './ui/garage.js';
import { initLeaderboard } from './ui/leaderboard.js';
import { initTutorial } from './ui/tutorial.js';
import { initRun } from './game/run.js';
import { initLoop } from './game/loop.js';

function boot() {
  if (initRenderer() === false) return;
  initTextures();
  initLights();
  initStage();
  initCrowd();
  initGlobe();
  initArenas();
  initSealife();
  initProgress();
  initCurrent();
  initBike();
  initNeon();
  initRiderModel();
  initSave();
  initTrails();
  initParticles();
  initSynth();
  initClock();
  initPath();
  initFreeride();
  initObjects();
  initChart();
  initHud();
  initBoost();
  initJudging();
  initKeys();
  initControls();
  initCamera();
  initPerks();
  initGarage();
  initLeaderboard();
  initTutorial();
  initRun();
  initLoop();
  window.__god = {
    useBoost,
    fillBoost: () => {
      game.boostCharge = 100;
    },
    press,
    release,
    get state() {
      return {
        fs: player.fs,
        fInit: player.fInit,
        paused: game.paused,
        running: game.running,
        boostCharge: game.boostCharge,
        slow: game.slow,
        score: game.score,
        combo: game.combo,
        balance: game.balance,
        act: game.act,
        over: game.over,
        notes: game.notes.map(n => ({ b: n.beat, t: n.type, j: n.judged, l: n.len })),
        beat: beatAt(now() - lat()),
        stats: game.stats,
      };
    },
    timeAt,
    now,
  };
  setArena(arenaId);
  player.h = 0;
  posAt(0, player.p);
  tanAt(0, player.t);
  orientOnWall(player.bike.g, player.p, player.t, 0);
  drawHearts();
  resize();
  showStart();
  requestAnimationFrame(t => {
    game.lastT = t;
    frame(t);
  });
  {
    const add = (u, cb) => {
      const sc = document.createElement('script');
      sc.src = u;
      sc.onload = cb;
      sc.onerror = () => {};
      document.head.appendChild(sc);
    }; /* rider is built in code now; no model download */
  }
}
boot();
