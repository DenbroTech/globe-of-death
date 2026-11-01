# Google Play Games: leaderboards and achievements (draft)

Play Games rules: achievement XP is in steps of 5, max 1,000 in total (this list uses 820, leaving room
for more later). Every leaderboard and achievement needs a 512×512 icon. "Inc" = incremental (counts up
across runs, the player sees progress). "Hidden" = shown as ??? until earned.
"New" = the game doesn't track it yet; needs a counter adding.

## Leaderboards
| # | Name | What | Format | Order |
|---|---|---|---|---|
| 1 | Show points | Best score in one show | Numeric | Higher is better |
| 2 | Best combo | Longest combo in one show | Numeric | Higher is better |
| 3 | Free ride time | Longest free ride | Time (seconds) | Higher is better |
| 4 | Perfects | Most perfects in one show (New) | Numeric | Higher is better |

## Achievements
| # | Name | How to earn | XP | Type |
|---|---|---|---|---|
| | **The show** | | | |
| 1 | First Lap | Finish the Lesson | 5 | |
| 2 | Showtime | Clear act 1 | 5 | |
| 3 | Halfway Hero | Reach act 5 | 15 | |
| 4 | Headliner | Finish the whole show | 50 | |
| 5 | Encore! | Survive 1 minute of the encore (New) | 50 | |
| 6 | Flawless | Clear an act without a miss (New) | 25 | |
| | **Combos** | | | |
| 7 | Warming Up | 10 combo | 5 | |
| 8 | On a Roll | 25 combo | 10 | |
| 9 | Unstoppable | 50 combo | 25 | |
| 10 | Perfect Rhythm | 100 combo | 50 | |
| | **Points** | | | |
| 11 | Crowd Pleaser | 50,000 points in one show | 10 | |
| 12 | Star Act | 250,000 points in one show | 25 | |
| 13 | Millionaire | 1,000,000 points in one show | 50 | |
| 14 | Pinpoint | 1,000 perfects in total | 25 | Inc |
| | **Moves** | | | |
| 15 | High Flyer | Jump 100 riders (New) | 15 | Inc |
| 16 | Wheelie King | 100 wheelies (New) | 15 | Inc |
| 17 | Nose Diver | 100 stoppies (New) | 15 | Inc |
| 18 | Look, No Feet | 50 seat stands (New) | 15 | Inc |
| 19 | Double Trouble | 25 turns during a long press (New) | 15 | Inc |
| 20 | Nitro | Use NOS 25 times (New) | 10 | Inc |
| 21 | Second Wind | Get saved by the Second Wind perk (New) | 10 | Hidden |
| | **Free ride** | | | |
| 22 | Survivor | Free ride for 1 minute | 5 | |
| 23 | Iron Nerves | Free ride for 3 minutes | 15 | |
| 24 | Globe Master | Free ride for 5 minutes | 40 | |
| 25 | Close Shave | First near miss | 5 | |
| 26 | Daredevil | 10 near misses in one ride | 20 | |
| 27 | Full House | Ride with 5 other riders in the globe (New) | 25 | |
| | **Collection** | | | |
| 28 | Garage Fan | Unlock 3 bikes | 10 | |
| 29 | Full Garage | Unlock all 6 bikes | 40 | |
| 30 | Dressed Up | Unlock 5 outfits | 15 | |
| 31 | Neon Nights | Unlock a neon paint | 25 | |
| 32 | World Tour | Unlock all 6 arenas | 40 | |
| | **Crowd and dedication** | | | |
| 33 | Packed House | 100 fans in the stands | 25 | Inc |
| 34 | Sold Out | 500 fans in the stands | 50 | Inc |
| 35 | Regular | Play 10 shows | 10 | Inc |
| 36 | Veteran | Play 100 shows | 40 | Inc |
| | **Just for fun** | | | |
| 37 | Oops | Crash in act 1 | 5 | Hidden |
| 38 | Gravity Wins | Go too slow over the top in free ride | 5 | Hidden |

Total XP: 820 / 1,000.
