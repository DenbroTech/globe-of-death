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
};
