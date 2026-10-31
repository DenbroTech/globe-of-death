// Mutable game state shared between systems (score, run flags, input state...).
// Each field is initialised by the module that owns it, in boot order (see main.js).
export const game = {};
