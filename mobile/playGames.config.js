/* Google Play Games IDs. Fill these in from Play Console → Play Games Services → Setup and management.
   While appId is empty, Play Games is switched off completely (the app builds and runs as before). */
module.exports = {
  // "Project ID" / application ID: the number shown on the Play Games Services configuration page
  appId: '404696304692',
  // leaderboard IDs (look like CgkI...EAIQAQ)
  leaderboards: {
    show: 'CgkItJiezuMLEAIQAA', // Show points
    combo: 'CgkItJiezuMLEAIQAQ', // Best combo
    free: 'CgkItJiezuMLEAIQAg', // Free ride time (format: time; the game sends milliseconds)
    perfects: 'CgkItJiezuMLEAIQAw', // Perfects in one show
    freepts: 'CgkItJiezuMLEAIQBQ', // Free ride points
  },
  /* achievement IDs (look like CgkI...EAIQ..). Create each one in Play Console → Play Games Services → Setup and
     management → Achievements (name + description below; points add up to max 1000), then paste its ID here.
     An empty ID is simply skipped, so the app works before they're all filled in. */
  achievements: {
    first_show: '', // Showtime: play your first show
    act5: '', // Halfway there: reach act 5
    showstopper: '', // Showstopper: finish all ten acts of the show
    combo25: '', // On a roll: reach a combo of 25
    combo100: '', // Unstoppable: reach a combo of 100
    perfects500: '', // Perfectionist: hit 500 perfect moves
    cursed: '', // Curse breaker: survive a cursed act
    free60: '', // Survivor: last one minute in free ride
    free300: '', // Iron nerve: last five minutes in free ride
    near50: '', // Close shave: 50 near misses in free ride
    new_bike: '', // New wheels: unlock a new bike
    neon: '', // Glow up: unlock a neon paint
    three_levels: '', // Globetrotter: ride three different levels
    all_levels: '', // World tour: ride all 14 levels
  },
};
