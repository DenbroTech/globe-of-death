// One-off migration tool: split the single-file game (main() body of original/globe-of-death.html) into ES modules.
// Kept for reference. Run: extract lines 318-2147 of the original to body.js, then node split.mjs body.js outDir, then prettier.
// Split main() body into ES modules. Usage: node split.mjs body.js outDir
import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import * as escope from 'eslint-scope';
import MagicString from 'magic-string';

const [, , inFile, outDir] = process.argv;
const src = fs.readFileSync(inFile, 'utf8');
const PRE = 'function main(){\n';
const wrapped = PRE + src + '\n}';
const ast = acorn.parse(wrapped, { ecmaVersion: 2022, ranges: true, locations: true });
const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
const fnNode = ast.body[0];
const fnScope = sm.acquire(fnNode);
const body = fnNode.body.body;

// ---------- module assignment ----------
const SECTION = {
  prelude: 'core/constants', renderer: 'render/renderer', textures: 'render/textures', lights: 'render/lights',
  arena: 'arenas/stage', crowds: 'arenas/crowd', globe: 'arenas/globe', arenas: 'arenas/arenas',
  'arena life': 'arenas/life', 'people as sprites': 'arenas/people', 'sea life': 'arenas/sealife',
  bikes: 'bikes/finishes', 'garage catalogue': 'bikes/finishes', finishes: 'bikes/finishes',
  'bike + rider builder': 'render/envmap', 'studio reflections': 'render/envmap', 'bikes v2': 'bikes/bike',
  riders: 'rider/rider', neon: 'render/neon', 'rider model': 'rider/riderModel', 'bike stats': 'bikes/stats',
  'garage save': 'game/save', particles: 'render/particles', audio: 'audio/synth', 'clock & tempo map': 'audio/clock',
  'your path is a pure function of the beat': 'game/path', 'free ride': 'game/freeride', '3D objects': 'game/objects',
  'song / chart': 'game/chart', songs: 'audio/songs', judging: 'game/judging', input: 'input/keys',
  'one control': 'input/controls', camera: 'render/camera', screens: 'ui/hud', perks: 'game/perks',
  'garage screen': 'ui/garage', 'the garage set': 'ui/garage', leaderboard: 'ui/leaderboard', tutorial: 'ui/tutorial', frame: 'game/loop',
};
// names that live in a different system than the banner they were written under
const NAME = {
  CROWD_URI: 'arenas/crowd', RIDERS: 'game/objects',
  // sea life section tail: arena selection + progress
  windows: 'arenas/arenas', lattice: 'arenas/arenas', prog: 'game/progress', unlockAll: 'game/progress', saveProg: 'game/progress',
  ARENA_REQ: 'game/progress', arenaOpen: 'game/progress', reqText: 'game/progress',
  arenaId: 'arenas/current', built: 'arenas/current', setArena: 'arenas/current', arenaTick: 'arenas/current',
  CATALOG: 'bikes/catalog', findItem: 'bikes/catalog',
  ik2: 'rider/ik',
  // garage save section tail: orbit math, trails, rings
  _a: 'render/trails', _b: 'render/trails', _c: 'render/trails', _p: 'render/trails', _t: 'render/trails', _M: 'render/trails', ZAX: 'render/trails',
  setOrbit: 'render/trails', orbitPoint: 'render/trails', TRAIL: 'render/trails', makeTrail: 'render/trails', fillTrail: 'render/trails',
  pushTrail: 'render/trails', makeRing: 'render/trails', aimRing: 'render/trails', glowSprite: 'render/trails',
  // free ride section tail: the sphere path (turns, pose)
  _pose: 'game/path', turns: 'game/path', IDQ: 'game/path', _q1: 'game/path', _q2: 'game/path', TURN_ANG: 'game/path', baseAt: 'game/path',
  rebakeTurns: 'game/path', addTurn: 'game/path', qAt: 'game/path', turnRate: 'game/path', normalAt: 'game/path', poseAt: 'game/path',
  posAt: 'game/path', tanAt: 'game/path', _o1: 'game/path', _o2: 'game/path', _o3: 'game/path', orientOnWall: 'game/path', loopNormal: 'game/path',
  // judging: hud bits
  judgeEl: 'ui/hud', toastEl: 'ui/hud', judgeTO: 'ui/hud', toastTO: 'ui/hud', showJudge: 'ui/hud', toast: 'ui/hud',
  boostB0: 'game/boost', boostB1: 'game/boost', boostCharge: 'game/boost', boostEnd: 'game/boost', boostWasReady: 'game/boost', boostBtn: 'game/boost',
  chargeBoost: 'game/boost', boostActive: 'game/boost', useBoost: 'game/boost', autoHit: 'game/boost',
  // handlebar HUD lives with the controls (it is the controls)
  showAd: 'platform/ads',
  // garage-set section: menus
  ARENA_ART: 'ui/menus', ICO: 'ui/menus', showStart: 'ui/menus', showLevels: 'ui/menus', showSettings: 'ui/menus',
  // tutorial section: run control
  start: 'game/run', quitToMenu: 'game/run', warnHide: 'game/run', resetInput: 'game/run', setPause: 'game/run',
};
// non-declaration statements forced to a module (by index) — filled from report
const STMT = JSON.parse(process.env.STMT || '{}');

const lines = wrapped.split('\n');
const banners = [];
lines.forEach((l, i) => { const m = l.match(/^\/\* -{5,} (.*?) -{5,}/); if (m) banners.push({ line: i + 1, name: m[1] }); });
const secKey = name => { const ks = Object.keys(SECTION).sort((a, b) => b.length - a.length); for (const k of ks) if (name.startsWith(k)) return k; throw new Error('no section ' + name); };
const secOf = line => { let s = 'prelude'; for (const b of banners) if (b.line <= line) s = secKey(b.name); return s; };
const stmtIdx = node => body.findIndex(s => s.range[0] <= node.range[0] && node.range[1] <= s.range[1]);

// declared names per statement
const declOf = new Map(); // var -> stmt index
const vars = new Map();
for (const v of fnScope.variables) { if (!v.defs.length) continue; const d = v.defs[0]; vars.set(v.name, v); declOf.set(v.name, stmtIdx(d.name)); }
const stmtNames = body.map(() => []);
for (const [n, i] of declOf) stmtNames[i].push(n);

// module per statement
const modOf = [];
body.forEach((s, i) => modOf.push((() => {
  if (STMT[i]) return STMT[i];
  if (!stmtNames[i].length && i > 0) return modOf[i - 1];
  const ns = stmtNames[i];
  if (ns.length) { const ms = new Set(ns.map(n => NAME[n] || SECTION[secOf(s.loc.start.line)])); if (ms.size > 1) console.warn('mixed decl stmt', i, ns, [...ms]); return NAME[ns[0]] || SECTION[secOf(s.loc.start.line)]; }
  return SECTION[secOf(s.loc.start.line)];
})()));
// trailing boot statements -> main
for (let i = 0; i < body.length; i++) if (i >= 458) modOf[i] = 'main';
const nameMod = n => modOf[declOf.get(n)];

// ---------- state: lets written outside their module ----------
const stateVars = new Set();
for (const [n, v] of vars) {
  const d = v.defs[0]; if (d.type !== 'Variable' || d.parent.kind === 'const') continue;
  for (const r of v.references) if (r.isWrite() && !r.init && modOf[stmtIdx(r.identifier)] !== nameMod(n)) { stateVars.add(n); break; }
}

// ---------- rewrite ----------
for (const sc of sm.scopes) for (const v of sc.variables) if (v.name === 'game') throw new Error('name collision: game');
const ms = new MagicString(wrapped);
const used = {}; // mod -> Map(name -> fromMod)
const needS = new Set(), needTHREE = new Set(), exportsOf = {};
const parentMap = new Map();
(function walk(n, p) { if (!n || typeof n.type !== 'string') return; parentMap.set(n, p); for (const k in n) { const c = n[k]; if (Array.isArray(c)) c.forEach(x => x && typeof x.type === 'string' && walk(x, n)); else if (c && typeof c.type === 'string') walk(c, n); } })(fnNode.body, null);

for (const [n, v] of vars) {
  const home = nameMod(n);
  for (const r of v.references) {
    const id = r.identifier; const m = modOf[stmtIdx(id)];
    if (stateVars.has(n)) {
      needS.add(m);
      const p = parentMap.get(id);
      if (p && p.type === 'Property' && p.shorthand && p.value === id) ms.overwrite(id.start, id.end, `${n}:game.${n}`);
      else if (!(r.init && r.isWrite())) ms.overwrite(id.start, id.end, 'game.' + n);
      continue;
    }
    if (m !== home) { (used[m] = used[m] || new Map()).set(n, home); (exportsOf[home] = exportsOf[home] || new Set()).add(n); }
  }
}
// globals: THREE
const globalTHREE = fnScope.through.filter(r => r.identifier.name === 'THREE');
for (const r of sm.globalScope.through) if (r.identifier.name === 'THREE') needTHREE.add(modOf[stmtIdx(r.identifier)]);
// unresolved names per module (debug)
const otherGlobals = new Set(sm.globalScope.through.map(r => r.identifier.name));

// ---------- emit ----------
// static = safe to evaluate at module load in any order (no reads of other bindings)
const MATH_CLS = new Set(['Vector2', 'Vector3', 'Vector4', 'Quaternion', 'Matrix3', 'Matrix4', 'Euler', 'Color']);
let staticLocal = new Set(); // static consts already declared in the current module
const isThreeMath = c => c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.object.name === 'THREE' && MATH_CLS.has(c.property.name);
const isStatic = n => !n || (n.type === 'Identifier' && staticLocal.has(n.name)) ||
  (n.type === 'NewExpression' && (isThreeMath(n.callee) || (n.callee.type === 'Identifier' && staticLocal.has(n.callee.name) && staticLocal.has('__math_' + n.callee.name))) && n.arguments.every(isStatic)) ||
  (n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === 'THREE') || n.type === 'Literal' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression' ||
  (n.type === 'Identifier' && n.name === 'undefined') ||
  (n.type === 'TemplateLiteral' && n.expressions.every(isStatic)) ||
  (n.type === 'ObjectExpression' && n.properties.every(p => p.type === 'Property' && !p.computed && isStatic(p.value))) ||
  (n.type === 'ArrayExpression' && n.elements.every(isStatic)) || (n.type === 'UnaryExpression' && isStatic(n.argument)) ||
  ((n.type === 'BinaryExpression' || n.type === 'LogicalExpression') && isStatic(n.left) && isStatic(n.right)) ||
  (n.type === 'ConditionalExpression' && isStatic(n.test) && isStatic(n.consequent) && isStatic(n.alternate)) ||
  (n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === 'Math');
const patNames = p => p.type === 'Identifier' ? [p.name] : p.type === 'ArrayPattern' ? p.elements.filter(Boolean).flatMap(patNames) :
  p.type === 'ObjectPattern' ? p.properties.flatMap(q => patNames(q.type === 'RestElement' ? q.argument : q.value)) :
  p.type === 'AssignmentPattern' ? patNames(p.left) : p.type === 'RestElement' ? patNames(p.argument) : (() => { throw new Error('pat ' + p.type) })();
const staticMod = {};
const staticBy = m => (staticMod[m] = staticMod[m] || new Set());
const isStaticIn = (m, n) => { staticLocal = staticBy(m); try { return isStatic(n); } finally { staticLocal = new Set(); } };
const mods = {};
const M = m => (mods[m] = mods[m] || { top: [], hoist: [], init: [], firstInit: Infinity, first: Infinity });
for (let i = 0; i < body.length; i++) {
  const s = body[i]; const mod = M(modOf[i]); mod.first = Math.min(mod.first, i);
  const from = i === 0 ? fnNode.body.start + 1 : body[i - 1].end;
  const lead = ms.slice(from, s.start).replace(/^[ \t]*\n/, '').replace(/\s+$/, '');
  const leadC = lead.trim() ? lead.trim() + '\n' : '';
  const toInit = code => { mod.init.push(code); mod.firstInit = Math.min(mod.firstInit, i); };
  if (s.type === 'VariableDeclaration' && s.declarations[0].id.name === 'CROWD_URI') { mod.assetImport = `import CROWD_URI from '../assets/crowd-atlas.png';`; continue; }
  if (s.type === 'FunctionDeclaration') { mod.top.push(leadC + ms.slice(s.start, s.end)); continue; }
  if (s.type === 'VariableDeclaration') {
    const keepTop = [], initParts = [];
    for (const d of s.declarations) {
      const names = patNames(d.id);
      const isState = d.id.type === 'Identifier' && stateVars.has(d.id.name);
      if (isState) { initParts.push(`game.${d.id.name}=${d.init ? ms.slice(d.init.start, d.init.end) : 'undefined'};`); continue; }
      if (s.kind === 'const' && d.id.type === 'Identifier' && (!staticMod[modOf[i]] || true) && isStaticIn(modOf[i], d.init)) {
        keepTop.push(ms.slice(d.start, d.end)); staticBy(modOf[i]).add(d.id.name);
        if (d.init && d.init.type === 'MemberExpression' && isThreeMath(d.init)) staticBy(modOf[i]).add('__math_' + d.id.name);
        continue; }
      if (s.kind === 'let' && isStaticIn(modOf[i], d.init)) { keepTop.push(ms.slice(d.start, d.end)); continue; }
      mod.hoist.push(...names);
      const tgt = ms.slice(d.id.start, d.id.end);
      initParts.push(d.id.type === 'ObjectPattern' ? `(${tgt}=${ms.slice(d.init.start, d.init.end)});` : `${tgt}=${ms.slice(d.init.start, d.init.end)};`);
    }
    if (keepTop.length) mod.top.push((initParts.length ? '' : leadC) + `${s.kind} ${keepTop.join(',')};`);
    if (initParts.length) toInit(leadC + initParts.join(''));
    continue;
  }
  toInit(leadC + ms.slice(s.start, s.end));
}
const key = m => Math.min(mods[m].firstInit, 1e6 + mods[m].first);
const order = Object.keys(mods).sort((a, b) => key(a) - key(b));
const rel = (from, to) => { let r = path.relative(path.dirname(from), to); if (!r.startsWith('.')) r = './' + r; return r + '.js'; };
const cap = m => 'init' + m.split('/').pop().replace(/^./, c => c.toUpperCase());
fs.rmSync(outDir, { recursive: true, force: true });
const graph = {};
for (const m of order) {
  const mod = mods[m], head = [];
  if (needTHREE.has(m)) head.push(`import * as THREE from 'three';`);
  if (mods[m].assetImport) head.push(mods[m].assetImport);
  if (needS.has(m)) head.push(`import { game } from '${rel(m, 'core/state')}';`);
  const byMod = {};
  for (const [n, from] of (used[m] || new Map())) (byMod[from] = byMod[from] || []).push(n);
  graph[m] = Object.keys(byMod);
  for (const from of order.filter(x => byMod[x])) head.push(`import { ${byMod[from].sort().join(', ')} } from '${rel(m, from)}';`);
  if (m === 'main') { for (const o of order) if (o !== 'main' && mods[o].init.length) head.push(`import { ${cap(o)} } from '${rel(m, o)}';`); }
  let code = '';
  if (mod.hoist.length) code += `let ${mod.hoist.join(', ')};\n\n`;
  code += mod.top.join('\n') + '\n';
  if (mod.init.length && m !== 'main') code += `\nexport function ${cap(m)}(){\n${mod.init.join('\n')}\n}\n`;
  if (m === 'main') code += `\nfunction boot(){\n${order.filter(o => o !== 'main' && mods[o].init.length).map(o => o === 'render/renderer' ? 'if(initRenderer()===false)return;' : cap(o) + '();').join('\n')}\n${mod.init.join('\n')}\n}\nboot();\n`;
  const ex = [...(exportsOf[m] || [])].filter(n => !stateVars.has(n)).sort();
  const tail = ex.length ? `\nexport { ${ex.join(', ')} };\n` : '\n';
  const file = path.join(outDir, m + '.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, head.join('\n') + '\n\n' + code.trim() + '\n' + tail);
}
fs.writeFileSync(path.join(outDir, 'core/state.js'),
  `// Mutable game state shared between systems (score, run flags, input state...).\n// Each field is initialised by the module that owns it, in boot order (see main.js).\nexport const game = {};\n`);
fs.writeFileSync(path.join(outDir, '_order.json'), JSON.stringify({ order, graph, state: [...stateVars], globals: [...otherGlobals] }, null, 1));
console.log('modules', order.length, 'state vars', stateVars.size);
console.log('order', order.join(' '));
// init sequence vs original statement order
const seq = []; for (const m of order) for (let i = 0; i < body.length; i++) if (modOf[i] === m) seq.push(i);
const initStmts = new Set(); for (let i = 0; i < body.length; i++) { const s = body[i]; if (s.type !== 'FunctionDeclaration' && !(s.type === 'VariableDeclaration' && s.declarations.every(d => isStatic(d.init) && !(d.id.type === 'Identifier' && stateVars.has(d.id.name))))) initStmts.add(i); }
const imp = seq.filter(i => initStmts.has(i));
for (let k = 1; k < imp.length; k++) if (imp[k] < imp[k - 1]) console.log('init out of order:', imp[k], modOf[imp[k]], 'after', imp[k - 1], modOf[imp[k - 1]], '|', ms.slice(body[imp[k]].start, body[imp[k]].start + 60).replace(/\n/g, ' '));

// direct init-time reads of bindings whose module inits later
const initPos = Object.fromEntries(order.map((m, k) => [m, k]));
for (const [n, v] of vars) {
  const home = nameMod(n);
  const d = v.defs[0]; const di = declOf.get(n); const ds = body[di];
  const lazy = ds.type === 'FunctionDeclaration' || (ds.type === 'VariableDeclaration' && ds.declarations.find(x => patNames(x.id).includes(n)) && isStatic(ds.declarations.find(x => patNames(x.id).includes(n)).init) && !stateVars.has(n));
  if (lazy) continue;
  for (const r of v.references) {
    let sc = r.from, inFn = false; while (sc && sc !== fnScope) { if (sc.type === 'function') { inFn = true; break; } sc = sc.upper; }
    if (inFn) continue;
    const m = modOf[stmtIdx(r.identifier)];
    if (m !== home && initPos[home] > initPos[m]) console.log('INIT-TIME READ', n, 'from', home, 'by', m);
  }
}
