/* The one-off "Full game" purchase (Google Play in-app product, NOT a subscription).
   Create it in Play Console → Monetise with Play → Products → In-app products with exactly this product ID,
   set a price and make it Active. Unlocks every level and removes ads (see src/platform/store.js). */
module.exports = {
  fullGame: 'full_game',
};
