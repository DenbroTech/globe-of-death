# Globe of Death — project handover

A phone-first 3D rhythm stunt game. You ride a motorbike inside a steel "globe of death" cage, hitting moves to the beat while a crowd watches. Built with three.js r128 + Vite, ES modules in `src/`. It started life as a single-file claude.ai artifact (kept in `original/globe-of-death.html` for comparison) and will later become a mobile app (Capacitor).

## The owner (how to work with them)
- Tests on an iPhone, sometimes on desktop. Phone-first always: portrait, thumb controls, 60 fps target.
- Wants things to look good and feel polished. Dislikes: clutter and paragraphs of text on screens, anything that looks "AI generated", primitive-looking models ("spheres and cylinders"), pastel colours where they asked for bold.
- Gives quick, informal feedback mid-task; act on it, keep replies short, show screenshots of what changed.
- Everything is unlocked for testing ("Unlock all" in Settings defaults ON). Keep it that way until they say otherwise.
- Name is **Globe of Death** (not the Spanish one).

## Game overview
**Modes**
- **The show** (main): moves scroll right-to-left along a top "conveyor" track and must be hit as they reach the circle. 10 acts + finale/encore. Act lengths vary (16, 18, 20… bars, max 36). Between acts: pick 1 of 3 perks. Balance bar = health; misses cost balance, hits restore it; empty = crash. Difficulty ramps gently (act 1: 1 move per bar … act 9–10: 4–5 with half-beats). BPM rises +3 per act (96 → 130 max). Act N has N−1 other riders who cut across (you jump them).
- **Free ride**: analog thumb stick (steer + throttle, speed persists), wheelies/stoppies, dodge riders, too slow over the top = fall. Survive as long as possible.
- **Tutorial**: 10 steps, each must be performed before the next (left, right, camera button ×3, diagonals, jump, wheelie, stoppie, seat stand, steer during wheelie, NOS). No crash possible.

**Controls (swipe anywhere, multi-touch)**
- Left/right swipe = turn; diagonals: up-left/up-right = gentle veer, down-left/down-right = hard turn. Turns are real heading changes on the sphere (quaternion path), not just loop rotation.
- Pull back (swipe down) and hold = wheelie; push forward and hold = stoppie; flick forward and release = jump (210 ms pending decision between jump and stoppie).
- Hold a side swipe = seat stand.
- During a held wheelie/stoppie, sliding the same thumb sideways ~24 px fires a turn (soft press: ignored if no matching note; wider window). A second finger also works.
- NOS button on the handlebars: when charged (needs full balance), next moves auto-play; the blue NOS band on the track extends to the end of any long press it overlaps.
- Long-press notes (wheelie/stoppie/seat stand) are 2–6 beats; holds only end when the finger lifts.

**Screens**
- Home: title, The show / Free ride chips, Ride, icon row (Level · Garage · Scores · Learn · Settings).
- Levels list (status: Selected / Unlocked / requirement). Unlock order when not testing: Big Top (start), Beach (act 2), Stadium (act 3), Sky crane (act 5), Underwater (act 7), Moon (finish all 10 acts).
- Garage: Bike / Rider tabs. 6 bikes in a grid (classic, dirt, chopper, vintage, sport, rocket) with stats that affect play. Paint groups: Solid, Metallic, Patterns, Animal, Neon. Rider: outfits grid + Suit/Helmet colour picker.
- Leaderboard (on-phone, localStorage): Show points, Best combo, Free ride time; top 10. No names (it's your phone): rows show rank, the run (act / near misses), score, date.
- Settings: sound, touch ring, unlock all, replay tutorial.
- Test ads: full-screen placeholder after acts 3, 6, 9, closable after 5 s.
- Crowd grows with games played (7 fans first game, ×1.5 per game) — full crowd while "Unlock all" is on.

**Arenas** (each with its own songs, instrument kit for music and move sounds, and animated "life")
- Big Top (organ; trapeze artists, balloons with strings, confetti)
- Beach (steel drums; waves with whitecaps, gulls, sailboat, beach balls, tiki bar with string lights + bartender + 12 dancers, sunbathers on towels, umbrellas, deckchairs, jumping dolphins)
- Stadium (brass; fireworks, blimp, camera flashes, flags, footballs, "olé" chants + stomp-clap)
- Sky crane (metal; night city ~500 lit buildings, street grid, stars, moon, helicopter searchlight, planes, traffic, birds)
- Underwater (bubbly synths + muffled lowpass; bubble globe instead of cage; real fish species with swimming wag, sardine bait ball, sharks, jellyfish, manta, turtle, kelp, coral)
- Moon base (theremin; low gravity/floaty jumps; ringed planet, Mars, rockets launching, UFO, satellite, shooting stars)

**Visual systems**
- Bikes: procedural "v2" builder (BSPEC per style): continuous frames, distinct engines (twin/single/V-twin/MX/four/jet), spoked or cast wheels, drilled discs, sprockets, chain, shocks with coil springs, exhausts, controls/cables/mirrors/dials, shaped tanks/seats/fairings (extruded side profiles), lights. Static parts merged per material for performance (`mergeGroup`).
- Rider: procedural "kit v3" (`riderKit`) — sculpted limbs/torso (`sculptGeo` with RGB vertex-colour panels), one-piece colour-blocked race leathers modelled on `art/rider-refs/` (suit material is white; each panel carries main / SEC white-grey stripe / BLK black via codes MAIN, SEC, BLK, DIM mapped through `M.pal`; helmet graphics via `M.hpal`). Leathers default suit colour = bike paint, armour sliders, aero hump, gauntlets wrapped on grips, tall race boots, race helmet (deformed sphere, big tinted visor). Posed with 2-bone IK to grips/pegs. The owner wants this pushed further toward their reference images (Dainese/Alpinestars-style race suits) but stylised, not hyper-real.
- Finishes: canvas-generated seamless textures applied triplanar (no UV stretching). Neon = white-hot core + saturated rim + pulsing additive halo shells (`neonify`).
- Studio env-map reflections on bikes/riders (`envify`). Spotlight shadows are OFF (they caused crawling cage-shadow flicker on floors). Logarithmic depth buffer on.
- First-person handlebars HUD at the bottom (DOM/SVG): bars steer and lift with stunts, throttle grip has an orange marker that rolls with throttle, tacho + NOS button.

**Audio**: WebAudio, all synthesised. `audio/synth.js`: voices -> music/sfx/ambience buses -> reverb (generated IR per arena) + tempo echo sends -> compressor -> master (mute) -> muffle LP. `audio/themes.js`: per-arena sound world (lead/stab/hit/jump voices, bass, kick/snare flavour, chord comping, pad, room, echo, ambience bed + one-off events like gulls/sirens/bubbles/radio beeps). Music bus = 1 in a ride, 0.5 in menus; `menuMusic()` loops the arena song in menus; audio starts on the first touch anywhere. `sfx(fn)` routes hit sounds/crashes to the sfx bus. Drum machine + bass + lead scheduled on the beat; tempo map supports pausing by shifting tempo times (`holdClock`/`freeClock`). Hit sounds are musical (in key, per-arena instrument). The game clock is the AudioContext clock — it's resumed on every touch and when returning to the app (iOS suspends audio).

## Code map (`src/`)
- `main.js` — boot: calls every module's `initX()` in the original order, then starts the frame loop. Modules only declare things at load time; anything that touches the scene, DOM or storage runs inside `initX()`, so import order never matters.
- `core/` — `constants.js` (R, GY, D, clamp, `$`…), `state.js` (`S`: mutable state shared across systems — score, combo, balance, act, run flags, input state…).
- `render/` — renderer (scene, camera, PMREM env), textures, lights, envmap (`envify`), neon (`neonify`), trails & rings, particles, camera (modes, orbit, resize).
- `arenas/` — stage (Big Top tent), crowd (sprite atlas → InstancedMesh), globe (cage), arenas (`ARENAS` table: env, crowd, build), current (`setArena`, `arenaTick`), life (`LIFE`), people (beach sprite people + extras), sealife (fish, sharks).
- `bikes/` — bike (`BSPEC`, `makeBike`, `mergeGroup`), finishes (`FIN_GEN`, `applyFinish`, triplanar), catalog (`CATALOG`), stats.
- `rider/` — rider (`sculptGeo`, `helmetDeform`, `riderKit`, `riderMats`, `buildRider`, `makeFigure`), ik (`ik2`), riderModel (unused Mixamo loader path — can delete or reuse for an imported model).
- `audio/` — synth (WebAudio voices/kits), clock (tempo map, `now`, `beatAt`, `timeAt`, acts), songs (`SONGS`, hit sounds, step scheduler).
- `game/` — path (sphere path: `posAt`/`qAt`/turns), freeride, objects (player, other riders), chart (`genBarNotes`, notes DOM), judging (`press`/`release`/`miss`), boost (NOS), perks, progress (arena unlocks), save (garage save), run (`start`, pause, quit), loop (`frame`).
- `input/` — keys, controls (swipe gestures + handlebar HUD).
- `ui/` — hud (judge/toast/balance), menus (home, levels, settings), garage (screen + 3D showroom), leaderboard, tutorial.
- `platform/ads.js` — test-ad placeholder; the Capacitor/AdMob hook goes here.
- `assets/crowd-atlas.png` — crowd sprites (byte-identical to the old embedded base64). Source sheets live in `art/`.
`window.__god` is a debug hook (press, release, state, fillBoost, useBoost, timeAt, now) used by headless tests.

## Testing approach that worked
- `npm test` (`tests/smoke.mjs`): perfect-timing bot, idle bot and free ride against the dev server.
- `tests/parity.mjs urlA urlB outDir` + `python3 tests/imgdiff.py outDir`: screenshots two builds with seeded `Math.random` and a frozen clock and diffs pixels (used to prove the module split changed nothing). Serve `original/` with a local `three.min.js`; it has no charset tag, so "·"/"…" show garbled there — expected. `ONLY=ride,menu` limits scenes.
- `tests/rider-shot.mjs out.png [style]` and `tests/outfits-shot.mjs out.png`: close-up contact sheets of bike+rider and of every outfit/finish (set `URL=` for another dev server).
- Headless Chromium (Playwright) with SwiftShader; serve the folder over `python3 -m http.server` (file:// blocks loading extra files). Replace the three.js CDN URL with a local `three.min.js` (r128) for offline tests.
- Synthetic `PointerEvent`s dispatched on `#touch` for gesture tests; `__god.press()` for timing bots. SwiftShader renders ~2 fps but the audio clock keeps real time.
- Render bikes/riders standalone with a custom camera for close-up checks.

## Assets
- `art/crowd-sheet-1.png`, `art/crowd-sheet-2.png` — original crowd sprite sheets (10 cols × 20 rows, idle/cheer row pairs; sheet 2 had its checkerboard keyed out; characters 54, 62, 75, 87, 89 excluded). `art/crowd-atlas.png` — combined atlas source; the game uses `src/assets/crowd-atlas.png`.

## Suggested next steps (agree with the owner first)
1. ~~Restructure into Vite + ES modules~~ (done: menus, levels, all 6 arenas and the garage render pixel-identical to `original/` apart from sub-pixel noise; the show ride matches; free ride matches step-for-step in game state — its screenshot is not deterministic even original-vs-original). Upgrade three.js from r128 when safe (r128-specific APIs: `material.skinning`, `outputEncoding`, examples/js loaders) — re-run the parity test against `original/` before/after.
2. Further tidy-ups as we touch code: move more of `S` into owning modules, remove `rider/riderModel.js` if no imported model is planned.
3. **Rider**: keep improving toward the reference race suits (owner will share images); or import a rigged rider model the owner downloads (`.glb`/`.fbx`) and pose it with the existing IK targets.
4. **Mobile app**: wrap with Capacitor for iOS/Android; Google AdMob for interstitials (every 3 acts, at natural breaks, frequency-capped) and rewarded ads (unlocks, second chance, double tickets); one-off "Remove ads" in-app purchase.
5. **Online leaderboards** (later): Google Play Games / Game Center, or a small backend.
6. Performance pass on mid-range phones (draw calls, shadow map size, crowd counts, particle counts).

## Known rough edges
- Rider still reads a bit "mannequin" — the owner wants more realism (in-between stylised and real).
- Sport bike fairing is blobby; neon halos on thin parts can streak.
- Flames pattern could look more like classic hot-rod flames.
- The unused Mixamo/X Bot loader code (`loadRiderModel`, `prepRider`, `buildRiderModel`, `figureFromModel`) can be removed or reused for an imported model.
