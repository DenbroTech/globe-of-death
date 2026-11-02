package expo.modules.playgames

import android.app.Activity
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/* Google Play Games Services v2: sign-in, leaderboards and achievements for Globe Riders.
   Every call resolves true/false instead of throwing, so the game never breaks if Play Games is
   unavailable (no Play Store, not signed in, IDs not set up yet). */
class PlayGamesModule : Module() {
  private var sdkReady = false

  private fun activity(): Activity? = appContext.currentActivity

  private fun ready(a: Activity): Boolean {
    if (!sdkReady) {
      try {
        PlayGamesSdk.initialize(a.applicationContext)
        sdkReady = true
      } catch (e: Exception) {
        return false
      }
    }
    return true
  }

  private fun show(a: Activity, task: com.google.android.gms.tasks.Task<android.content.Intent>, promise: Promise) {
    task
      .addOnSuccessListener { intent ->
        a.runOnUiThread { a.startActivityForResult(intent, 9004) }
        promise.resolve(true)
      }
      .addOnFailureListener { promise.resolve(false) }
  }

  override fun definition() = ModuleDefinition {
    Name("PlayGames")

    // signs in silently if the player already uses Play Games, otherwise shows the Play Games prompt
    AsyncFunction("signIn") { promise: Promise ->
      val a = activity()
      if (a == null || !ready(a)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val client = PlayGames.getGamesSignInClient(a)
      client.isAuthenticated().addOnCompleteListener { t ->
        if (t.isSuccessful && t.result.isAuthenticated()) {
          promise.resolve(true)
        } else {
          client.signIn().addOnCompleteListener { s ->
            promise.resolve(s.isSuccessful && s.result.isAuthenticated())
          }
        }
      }
    }

    AsyncFunction("submitScore") { leaderboardId: String, score: Double, promise: Promise ->
      val a = activity()
      if (a == null || !ready(a)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      PlayGames.getLeaderboardsClient(a).submitScore(leaderboardId, score.toLong())
      promise.resolve(true)
    }

    AsyncFunction("showLeaderboards") { promise: Promise ->
      val a = activity()
      if (a == null || !ready(a)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      show(a, PlayGames.getLeaderboardsClient(a).getAllLeaderboardsIntent(), promise)
    }

    AsyncFunction("showLeaderboard") { leaderboardId: String, promise: Promise ->
      val a = activity()
      if (a == null || !ready(a)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      show(a, PlayGames.getLeaderboardsClient(a).getLeaderboardIntent(leaderboardId), promise)
    }

    AsyncFunction("unlockAchievement") { achievementId: String, promise: Promise ->
      val a = activity()
      if (a == null || !ready(a)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      PlayGames.getAchievementsClient(a).unlock(achievementId)
      promise.resolve(true)
    }

    AsyncFunction("setAchievementSteps") { achievementId: String, steps: Int, promise: Promise ->
      val a = activity()
      if (a == null || !ready(a)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      PlayGames.getAchievementsClient(a).setSteps(achievementId, steps)
      promise.resolve(true)
    }

    AsyncFunction("showAchievements") { promise: Promise ->
      val a = activity()
      if (a == null || !ready(a)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      show(a, PlayGames.getAchievementsClient(a).getAchievementsIntent(), promise)
    }
  }
}
