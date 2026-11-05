/* songs and sound worlds of the premium arenas (arenas/premium.js). No imports, so it's safe to load early. */
/* their songs (appended to SONGS: indices 11-17; 18 = Big Top Bounce) */
/* `mel`: an 8-bar tune (8 eighth-notes a bar), MIDI notes; 0 = hold the previous note, null = rest.
   Written in the bouncy, major-key, sing-along style of Diddy Kong Racing / Mario kart-racer tunes, kept in a
   middle range (no high squeaks). It loops every 8 bars, lined up with the 4-chord progression. */
const PREMIUM_SONGS = [
  {
    name: 'Crystal Echo',
    prog: [45, 50, 45, 52],
    kick: [0, 4], rim: [3, 7], hat: 8, shk: [1, 5],
    bass: [0, null, 7, null, 0, null, 3, null], bw: 'sine', bcut: 600, bdec: 0.5, chord: [2, 6],
    mel: [69,0,0,72,0,0,76,0, 74,0,0,72,0,0,69,0, 72,0,0,69,0,0,64,0, 67,0,0,71,0,0,null,null,
          76,0,0,74,0,72,69,0, 65,0,0,69,0,0,74,0, 72,0,71,69,0,0,64,0, 64,0,0,null,null,null,null,null],
    mv: 0.085,
  },
  {
    name: 'Garden Party',
    prog: [53, 58, 53, 48], maj: 1,
    kick: [0, 4], snare: [2, 6], hat: 8, shk: [1, 3, 5, 7],
    bass: [0, null, 7, null, 0, null, 7, 5], bw: 'triangle', bcut: 800, bdec: 0.3,
    mel: [65,0,69,72,0,69,72,0, 70,0,74,0,72,70,69,0, 65,69,72,0,77,0,72,0, 67,0,64,67,72,0,null,null,
          72,0,69,0,65,0,69,72, 74,0,72,70,69,0,70,0, 69,0,72,0,69,65,0,0, 67,64,67,72,64,0,null,null],
    mv: 0.1,
  },
  {
    name: 'Orbit',
    prog: [43, 48, 43, 50], maj: 1,
    kick: [0, 3, 4], snare: [2, 6], hat: 8,
    bass: [0, null, 7, 0, 12, null, 7, null], bw: 'sawtooth', bcut: 700, bdec: 0.25,
    mel: [67,71,74,0,71,0,67,0, 72,0,76,0,74,72,0,null, 71,0,74,71,67,0,62,0, 66,0,69,0,74,0,null,null,
          74,0,71,0,74,76,74,0, 72,0,69,0,64,67,72,0, 71,0,67,0,62,67,71,0, 69,0,66,0,62,0,null,null],
    mv: 0.08,
  },
  {
    // a proper sea shanty: the traditional "Drunken Sailor" tune (public domain), D dorian, stomping 2-beat feel
    name: 'Sea Shanty',
    prog: [50, 50, 48, 48],
    qual: [0, 0, 1, 1], // D minor, D minor, C major, C major
    kick: [0, 4], snare: [2, 6], hat: 4, clap: [2, 6],
    bass: [0, null, 7, null, 0, null, 7, null], bw: 'triangle', bcut: 900, bdec: 0.25, chord: [2, 6],
    mel: [69,69,69,69,69,0,62,0, 65,0,69,0,null,null,null,null, 67,67,67,67,67,0,60,0, 64,0,67,0,null,null,null,null,
          69,69,69,69,69,0,71,72, 74,0,72,0,69,0,67,0, 64,0,0,0,62,0,62,0, 62,0,null,null,null,null,null,null],
    mv: 0.11,
  },
  {
    name: 'Royal Fanfare',
    prog: [46, 51, 46, 41], maj: 1,
    kick: [0, 4], snare: [2, 6], hat: 8,
    bass: [0, null, 7, null, 12, null, 7, null], bw: 'sawtooth', bcut: 1000, bdec: 0.3,
    mel: [58,0,62,65,70,0,0,null, 67,0,70,0,67,63,0,null, 65,0,70,0,74,0,70,0, 72,0,69,0,65,0,null,null,
          70,70,70,0,74,0,70,0, 72,0,70,67,63,0,67,0, 65,0,70,0,62,65,0,null, 69,0,72,0,70,0,null,null],
    mv: 0.075,
  },
  {
    name: 'Jungle Stomp',
    prog: [50, 55, 50, 45], maj: 1,
    kick: [0, 3, 5], snare: [4], shk: [1, 3, 5, 7], conga: [2, 6, 7],
    bass: [0, null, 0, 7, null, 5, null, 7], bw: 'square', bcut: 600, bdec: 0.3,
    mel: [62,66,69,0,66,69,74,0, 71,0,67,0,71,74,71,0, 69,66,62,66,69,0,74,0, 73,0,69,0,64,0,null,null,
          74,0,74,71,69,0,66,0, 67,0,71,0,74,71,67,0, 66,0,69,0,62,0,66,69, 64,0,69,0,61,0,null,null],
    mv: 0.1,
  },
  {
    name: 'Data Stream',
    prog: [52, 45, 52, 47],
    kick: [0, 2, 4, 6], snare: [2, 6], hat: 8,
    bass: [0, 12, 0, 12, 0, 12, 7, 10], bw: 'sawtooth', bcut: 1200,
    mel: [64,0,67,71,0,67,74,0, 69,0,72,0,69,67,64,0, 71,0,74,0,71,67,71,0, 66,0,71,0,66,0,null,null,
          76,0,74,71,0,67,71,0, 69,0,72,69,64,0,67,0, 71,0,67,64,0,67,71,0, 66,0,62,0,66,0,null,null],
    mv: 0.075,
  },
  {
    // the Big Top's main tune (SONGS index 18): a fast oom-pah circus march with chromatic runs, in C
    name: 'Big Top Bounce',
    prog: [48, 43, 48, 43], maj: 1,
    kick: [0, 4], snare: [2, 6], hat: 8, clap: [6],
    bass: [0, null, 7, null, 0, null, 7, null], bw: 'triangle', bcut: 800, bdec: 0.22,
    mel: [72,71,72,71,72,0,67,0, 71,70,71,70,71,0,67,0, 72,71,72,76,74,72,71,69, 67,0,66,67,69,0,71,0,
          72,71,72,71,72,0,67,0, 74,73,74,73,74,0,71,0, 72,74,76,74,72,71,69,71, 72,0,67,0,60,0,null,null],
    mv: 0.1,
  },
  {
    // South pole (SONGS index 19): a sparkly, skating major-key tune
    name: 'Snowball Slide',
    prog: [53, 50, 46, 48], qual: [1, 0, 1, 1], maj: 1,
    kick: [0, 4], snare: [2, 6], hat: 8, shk: [1, 3, 5, 7],
    bass: [0, null, 7, null, 12, null, 7, null], bw: 'triangle', bcut: 900, bdec: 0.3,
    mel: [72,0,69,0,65,0,69,72, 74,0,69,0,65,0,62,0, 70,0,74,0,77,0,74,70, 72,0,67,0,64,0,null,null,
          77,0,76,74,72,0,69,0, 74,0,72,69,65,0,69,0, 70,0,74,0,72,70,69,67, 65,0,null,null,null,null,null,null],
    mv: 0.09,
  },
];

/* their sound worlds (merged into THEMES) */
const PREMIUM_THEMES = {
  arctic: { mel: 'drop', lead: 'glass', stab: 'glass', hit: 'drop', jump: 'drop', sfx: 1.3, bass: 'pluck', kick: 'soft', snare: 'brush', comp: 'uke', pad: 'space', space: { dur: 3.2, decay: 1.8, wet: 0.35 }, echo: { beats: 0.75, fb: 0.35, wet: 0.2 }, amb: null },
  cavern: { mel: 'drop', lead: 'glass', stab: 'glass', hit: 'drop', jump: 'drop', sfx: 1.3, bass: 'sub', kick: 'soft', snare: 'snare', comp: 'none', pad: 'dark', space: { dur: 4.5, decay: 1.5, wet: 0.45 }, echo: { beats: 0.75, fb: 0.45, wet: 0.25 }, amb: 'deep' },
  garden: { mel: 'drop', lead: 'uke', stab: 'uke', hit: 'pluck', jump: 'pluck', sfx: 1.15, bass: 'pluck', kick: 'soft', snare: 'brush', comp: 'uke', space: { dur: 0.8, decay: 3, wet: 0.1 }, amb: null },
  solar: { mel: 'pluck', lead: 'synth', stab: 'glass', hit: 'blip', jump: 'blip', sfx: 1.25, bass: 'sub', kick: 'punch', snare: 'snare', comp: 'arp', pad: 'space', space: { dur: 4, decay: 1.6, wet: 0.35 }, echo: { beats: 1.5, fb: 0.45, wet: 0.25 }, amb: 'space' },
  pirate: { mel: 'organ', lead: 'organ', stab: 'organ', hit: 'pluck', jump: 'pluck', sfx: 1.2, bass: 'tuba', kick: 'boom', snare: 'snare', comp: 'oompah', space: { dur: 1.2, decay: 3, wet: 0.15 }, amb: 'surf' },
  castle: { mel: 'brass', lead: 'brass', stab: 'organ', hit: 'calliope', jump: 'calliope', bass: 'brassbass', kick: 'boom', snare: 'big', comp: 'brass', toms: 1, space: { dur: 3, decay: 2.2, wet: 0.3 }, amb: null },
  dino: { mel: 'pan', lead: 'metal', stab: 'metal', hit: 'drop', jump: 'drop', sfx: 1.3, bass: 'sub', kick: 'boom', snare: 'big', comp: 'none', toms: 1, space: { dur: 2.5, decay: 2.4, wet: 0.25 }, amb: null },
  matrix: { mel: 'synth', lead: 'synth', stab: 'synth', hit: 'blip', jump: 'blip', sfx: 1.25, bass: 'synth', kick: 'punch', snare: 'snare', comp: 'arp', pad: 'dark', space: { dur: 2, decay: 2.6, wet: 0.2 }, echo: { beats: 0.75, fb: 0.4, wet: 0.22 }, amb: null },
};

export { PREMIUM_SONGS, PREMIUM_THEMES };
