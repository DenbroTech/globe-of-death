# Globe Riders: free vs full game, ads and achievements (Play Console setup)

The code is done. These are the steps only you can do in Google's consoles. The app works before they're all done:
anything not set up yet is simply skipped.

## 1. The "Full game" purchase (Play Console)
1. Monetise with Play → Products → **In-app products** → Create product.
   (If it asks for a payments profile / merchant account, set that up first.)
2. Product ID: **`full_game`** (exactly this; it's in `mobile/store.config.js`).
   Name: *Full game*. Description: *All 14 levels and no ads.*
3. Set the price, Save, then **Activate**.
4. Setup → **License testing**: add your own Gmail, so you can buy it in a test build without being charged.

The product only shows up in a build that's been uploaded to a Play track (internal testing is fine).

## 2. Achievements (Play Console → Play Games Services → Setup and management → Achievements)
Create these 14 (name, then description). After saving each, copy its ID (looks like `CgkI…`) and send me the list,
or paste them into `mobile/playGames.config.js` under the matching key. Then **Publish** the Play Games changes.

| key | Name | Description |
| --- | --- | --- |
| first_show | Showtime | Play your first show |
| act5 | Halfway there | Reach act 5 |
| showstopper | Showstopper | Finish all ten acts of the show |
| combo25 | On a roll | Reach a combo of 25 |
| combo100 | Unstoppable | Reach a combo of 100 |
| perfects500 | Perfectionist | Hit 500 perfect moves |
| cursed | Curse breaker | Survive a cursed act |
| free60 | Survivor | Last one minute in free ride |
| free300 | Iron nerve | Last five minutes in free ride |
| near50 | Close shave | 50 near misses in free ride |
| new_bike | New wheels | Unlock a new bike |
| neon | Glow up | Unlock a neon paint |
| three_levels | Globetrotter | Ride three different levels |
| all_levels | World tour | Ride all 14 levels |

Points: any split adding up to at most 1000 (e.g. 25 for the easy ones, 100 for Showstopper / Unstoppable / World tour).
Icons are optional.

## 3. AdMob (apps.admob.com)
1. Apps → Globe Riders: make sure it's **linked to the Play Store listing**.
2. **Privacy & messaging** → create a **European regulations (GDPR)** message for Globe Riders and **publish** it.
   The app shows it to players in the UK/EU (it's what "Ad privacy" in Settings reopens). Optionally also the
   US states message.
3. Settings → **Test devices**: add your phone, so you never click your own real ads (that can get the account
   suspended). Until then, don't tap ads in your own builds.

## 4. Play Console → App content (must match the new build)
- **Ads**: Yes, the app contains ads.
- **Advertising ID**: Yes, used for advertising (the ads SDK uses it).
- **Data safety**: add *Device or other IDs* (advertising), shared with Google AdMob for advertising, and
  *Purchase history* (Google Play billing). Ads data is collected; it's not optional for free players.
- **Target audience**: if it includes under-13s, keep the Families policy settings. The app asks a neutral
  birth-year question once and serves child-directed, G-rated, non-personalised ads to under-13s.

## 5. Build and test
Build with EAS as usual (Expo Go can't run ads or purchases; it still opens, just without them):
`npx eas-cli build --platform android --profile production` → upload to **internal testing** first, install from
the Play link, then check: age question → ads before acts 4, 7 and 10 → Settings → Full game → buy (as a license
tester) → ads stop and every level opens → reinstall → Restore purchase brings it back.
