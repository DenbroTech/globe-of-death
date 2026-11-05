import { PREMIUM_THEMES } from './premiumSongs.js';
/* ---------- sound worlds: every arena has its own instruments, room and background ambience ----------
   lead/stab/hit/jump: voice names (see voice() in synth.js)
   bass: bass instrument, kick/snare: drum flavour, comp: how chords are played, pad: sustained chord bed
   lp: muffle (underwater), space: reverb {dur s, decay, wet}, echo: tempo delay {beats, fb, wet}
   amb: background ambience recipe (see ambience in synth.js) */
const THEMES = {
  bigtop: {
    lead: 'calliope',
    stab: 'organ',
    hit: 'calliope',
    jump: 'slide',
    bass: 'tuba',
    kick: 'boom',
    snare: 'snare',
    comp: 'oompah',
    space: { dur: 1.8, decay: 2.6, wet: 0.22 },
    amb: 'tent',
  },
  beach: {
    // the music is all steel pan, so it sits a bit lower than other arenas
    mus: 0.75,
    lead: 'pan',
    stab: 'pan',
    hit: 'pan',
    jump: 'pan',
    bass: 'pluck',
    kick: 'soft',
    snare: 'brush',
    comp: 'uke',
    space: { dur: 0.7, decay: 3.5, wet: 0.12 },
    amb: 'surf',
  },
  stadium: {
    lead: 'brass',
    stab: 'brass',
    // move sounds use Big Top's calliope (the owner found the brass hits horrible)
    hit: 'calliope',
    jump: 'calliope',
    bass: 'brassbass',
    kick: 'boom',
    snare: 'big',
    comp: 'brass',
    toms: 1,
    space: { dur: 3.2, decay: 2.2, wet: 0.3 },
    echo: { beats: 1, fb: 0.18, wet: 0.12 },
    amb: null, // no background crowd noise (owner found it read as static)
  },
  crane: {
    lead: 'synth',
    stab: 'metal',
    hit: 'pluck', // punchy pluck so moves cut through the synth music
    jump: 'pluck',
    sfx: 1.25,
    bass: 'synth',
    kick: 'punch',
    snare: 'snare',
    comp: 'arp',
    pad: 'dark',
    space: { dur: 2.2, decay: 2.8, wet: 0.18 },
    echo: { beats: 0.75, fb: 0.38, wet: 0.2 },
    amb: 'city',
  },
  under: {
    lead: 'bubble',
    stab: 'bubble',
    hit: 'drop', // bubbly marimba, pitched where the underwater muffle doesn't swallow it
    jump: 'drop',
    sfx: 1.5,
    bass: 'sub',
    kick: 'soft',
    snare: 'brush',
    comp: 'none',
    pad: 'whale',
    lp: 1700,
    space: { dur: 3.5, decay: 1.8, wet: 0.4 },
    amb: 'deep',
  },
  moon: {
    lead: 'theremin',
    stab: 'glass',
    hit: 'blip', // crisp blip; the theremin is the melody and smeared the moves
    jump: 'blip',
    sfx: 1.25,
    bass: 'sub',
    kick: 'soft',
    snare: 'snare',
    comp: 'none',
    pad: 'space',
    space: { dur: 4, decay: 1.6, wet: 0.35 },
    echo: { beats: 1.5, fb: 0.45, wet: 0.25 },
    amb: 'space',
  },
};

Object.assign(THEMES, PREMIUM_THEMES);

export { THEMES };
