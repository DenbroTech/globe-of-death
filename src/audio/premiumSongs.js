/* songs and sound worlds of the premium arenas (arenas/premium.js). No imports, so it's safe to load early. */
/* their songs (appended to SONGS: indices 11-17) */
const PREMIUM_SONGS = [
  { name: 'Crystal Echo', prog: [45, 41, 48, 43], kick: [0, 4], rim: [3, 7], hat: 8, bass: [0, null, 7, null, 0, null, 3, null], bw: 'sine', bcut: 600, bdec: 0.5, chord: [2, 6] },
  { name: 'Garden Party', prog: [48, 53, 55, 48], maj: 1, kick: [0, 4], snare: [2, 6], hat: 8, bass: [0, null, 7, null, 12, null, 7, null], bw: 'triangle', bcut: 800, chord: [1, 3, 5, 7] },
  { name: 'Orbit', prog: [45, 48, 43, 50], kick: [0, 3, 4], snare: [2, 6], hat: 8, bass: [0, 0, 12, 0, 7, 0, 12, 10], bw: 'sawtooth', bcut: 700 },
  { name: 'Sea Shanty', prog: [50, 45, 50, 45], kick: [0, 3, 6], snare: [2, 5], hat: 4, bass: [0, null, 7, 0, null, 7, 5, null], bw: 'triangle', bcut: 900, chord: [1, 4, 7] },
  { name: 'Royal Fanfare', prog: [48, 53, 55, 48], maj: 1, kick: [0, 4], snare: [2, 6], hat: 8, bass: [0, 0, 7, 7, 12, 12, 7, 7], bw: 'sawtooth', bcut: 1000 },
  { name: 'Jungle Stomp', prog: [45, 43, 41, 43], kick: [0, 3, 5], snare: [4], shk: [1, 3, 5, 7], bass: [0, null, 0, 3, null, 5, null, 7], bw: 'square', bcut: 600 },
  { name: 'Data Stream', prog: [45, 41, 43, 48], kick: [0, 2, 4, 6], snare: [2, 6], hat: 8, bass: [0, 12, 0, 12, 0, 12, 7, 10], bw: 'sawtooth', bcut: 1200 },
];

/* their sound worlds (merged into THEMES) */
const PREMIUM_THEMES = {
  cavern: { lead: 'glass', stab: 'glass', hit: 'drop', jump: 'drop', sfx: 1.3, bass: 'sub', kick: 'soft', snare: 'snare', comp: 'none', pad: 'dark', space: { dur: 4.5, decay: 1.5, wet: 0.45 }, echo: { beats: 0.75, fb: 0.45, wet: 0.25 }, amb: 'deep' },
  garden: { lead: 'uke', stab: 'uke', hit: 'pluck', jump: 'pluck', sfx: 1.15, bass: 'pluck', kick: 'soft', snare: 'brush', comp: 'uke', space: { dur: 0.8, decay: 3, wet: 0.1 }, amb: null },
  solar: { lead: 'synth', stab: 'glass', hit: 'blip', jump: 'blip', sfx: 1.25, bass: 'sub', kick: 'punch', snare: 'snare', comp: 'arp', pad: 'space', space: { dur: 4, decay: 1.6, wet: 0.35 }, echo: { beats: 1.5, fb: 0.45, wet: 0.25 }, amb: 'space' },
  pirate: { lead: 'organ', stab: 'organ', hit: 'pluck', jump: 'pluck', sfx: 1.2, bass: 'tuba', kick: 'boom', snare: 'snare', comp: 'oompah', space: { dur: 1.2, decay: 3, wet: 0.15 }, amb: 'surf' },
  castle: { lead: 'brass', stab: 'organ', hit: 'calliope', jump: 'calliope', bass: 'brassbass', kick: 'boom', snare: 'big', comp: 'brass', toms: 1, space: { dur: 3, decay: 2.2, wet: 0.3 }, amb: null },
  dino: { lead: 'metal', stab: 'metal', hit: 'drop', jump: 'drop', sfx: 1.3, bass: 'sub', kick: 'boom', snare: 'big', comp: 'none', toms: 1, space: { dur: 2.5, decay: 2.4, wet: 0.25 }, amb: null },
  matrix: { lead: 'synth', stab: 'synth', hit: 'blip', jump: 'blip', sfx: 1.25, bass: 'synth', kick: 'punch', snare: 'snare', comp: 'arp', pad: 'dark', space: { dur: 2, decay: 2.6, wet: 0.2 }, echo: { beats: 0.75, fb: 0.4, wet: 0.22 }, amb: null },
};

export { PREMIUM_SONGS, PREMIUM_THEMES };
