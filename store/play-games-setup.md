# Google Play Games: leaderboard setup (Play Console)

1. **Create the Play Games project**: Play Console → Globe Riders → **Grow users → Play Games Services → Setup and management → Configuration** → "No, my game doesn't use Google APIs" → name it *Globe Riders* → **Create**.
2. **OAuth consent screen** (Google Cloud opens in a new tab from the Configuration page's "Configure" link): External → app name *Globe Riders*, your support email, developer email → Save. Then **Publish app** on that screen (Play Games only asks for basic profile, so no review is needed).
3. **Android credential**: back on Configuration → **Add credential** → type **Android** → name *Globe Riders Android* → **Create OAuth client** (opens Google Cloud) → type Android, package `com.denbro.globeofdeath.app`, SHA-1 = the **App signing key certificate** SHA-1 from Play Console → **Test and release → App integrity → App signing**. Create, return, refresh, pick it, **Save**.
   - Optional (for test APKs you install directly): add a second Android credential with the **Upload key certificate** SHA-1 from the same App signing page.
4. **Leaderboards**: Setup and management → **Leaderboards → Add leaderboard** (icons in `store/play-games-icons/`):

| Name | Format | Order | Icon |
|---|---|---|---|
| Show points | Numeric | Higher is better | lb-show-points.png |
| Best combo | Numeric | Higher is better | lb-best-combo.png |
| Free ride time | Time | Higher is better | lb-free-ride-time.png |
| Perfects | Numeric | Higher is better | lb-perfects.png |

5. **Testers**: Setup and management → **Testers** → add your Google account.
6. **Publish**: Play Games Services → **Review and publish** → Publish (this is separate from app releases).
7. **Send Claude**: the **Project ID** (number at the top of the Configuration page) and the 4 **leaderboard IDs** (they look like `CgkI…EAIQAQ`). Claude puts them in `mobile/playGames.config.js`, switches the module on (`mobile/package.json` → `expo.autolinking.exclude`), and you build a new AAB.

Game side (already done): scores are sent after every run (show points, best combo, perfects; free ride time in ms), and the Scores screen gets a **Google Play** button once Play Games is on. Native code: `mobile/modules/play-games` (Play Games Services v2), manifest ID via `mobile/plugins/withPlayGames.js`.
