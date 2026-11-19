import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { requireOptionalNativeModule } from 'expo';
import PG_CONFIG from './playGames.config.js';
import ADS from './ads.config.js';
import STORE from './store.config.js';

/* AdMob and Google Play Billing are native modules that don't exist in Expo Go: load them defensively, so the
   app still opens there (just without ads and purchases). */
let Ads = null,
  IAP = null;
try {
  Ads = require('react-native-google-mobile-ads');
} catch (e) {}
try {
  IAP = require('expo-iap');
} catch (e) {}

/* Google Play Games (leaderboards): native module in modules/play-games, switched on once the IDs are
   filled in playGames.config.js */
const PlayGames = PG_CONFIG.appId ? requireOptionalNativeModule('PlayGames') : null;

/* Globe Riders app shell: the whole game is one HTML file (built from the web project with
   `npm run mobile:sync` in the repo root) shown full screen in a WebView.
   Native bits: immersive mode, screen kept awake, Android back button and pausing when the app goes
   to the background (both handled inside the game via window.__nativeBack / __appPause / __appResume). */
SplashScreen.preventAutoHideAsync().catch(() => {});

const BG = '#07060a';

function Game() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const web = useRef(null);
  const [uri, setUri] = useState(null);
  const call = js => web.current && web.current.injectJavaScript(`try{${js}}catch(e){};true;`);
  // things to tell the game once its page has loaded (purchase state can arrive before it has)
  const loaded = useRef(false);
  const later = useRef({});
  const tell = (key, js) => {
    later.current[key] = js;
    if (loaded.current) call(js);
  };

  /* ---------- the "Full game" purchase (one-off, Google Play Billing via expo-iap) ---------- */
  const full = useRef(false);
  const setFull = v => {
    full.current = !!v;
    tell('full', `window.__setFull&&window.__setFull(${!!v})`);
  };
  const owned = list => (list || []).filter(p => p.productId === STORE.fullGame && p.purchaseState === 'purchased');
  // ask Google Play what this account owns; finish any purchase that was never acknowledged (else Google
  // refunds it after 3 days)
  const checkOwned = async (quiet = true) => {
    if (!IAP) return;
    try {
      const mine = owned(await IAP.getAvailablePurchases());
      for (const p of mine) await IAP.finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
      setFull(mine.length > 0);
      if (!quiet) call(`window.__buyResult&&window.__buyResult(${mine.length ? "''" : "'none'"})`);
    } catch (e) {
      if (!quiet) call("window.__buyResult&&window.__buyResult('error')");
    }
  };
  const sendPrice = async () => {
    if (!IAP) return;
    try {
      const [p] = await IAP.fetchProducts({ skus: [STORE.fullGame], type: 'in-app' });
      if (p && p.displayPrice) tell('price', `window.__price&&window.__price(${JSON.stringify(p.displayPrice)})`);
    } catch (e) {}
  };

  /* ---------- ads (free game only): AdMob interstitials between acts ----------
     Nothing starts until the game reports the player's age group (its one-time neutral age question):
       child: child-directed, under age of consent, rated G, non-personalised, no consent form
       teen:  under age of consent, rated PG, non-personalised
       adult: Google's consent form (UMP) where the law requires one, rated PG */
  const ad = useRef({ started: false, unit: null, loaded: false, showing: false });
  const adDone = () => {
    ad.current.showing = false;
    call('window.__adDone&&window.__adDone()');
  };
  const startAds = async group => {
    const A = ad.current;
    if (!Ads || A.started || full.current) return;
    A.started = true;
    const { default: mobileAds, AdsConsent, InterstitialAd, AdEventType, MaxAdContentRating, TestIds } = Ads;
    const child = group === 'child',
      teen = group === 'teen';
    try {
      await mobileAds().setRequestConfiguration({
        tagForChildDirectedTreatment: child,
        tagForUnderAgeOfConsent: child || teen,
        maxAdContentRating: child ? MaxAdContentRating.G : MaxAdContentRating.PG,
      });
      let canRequest = true;
      if (!child) {
        try {
          const info = await AdsConsent.gatherConsent({ tagForUnderAgeOfConsent: teen });
          canRequest = info.canRequestAds;
        } catch (e) {}
      }
      if (!canRequest) return;
      await mobileAds().initialize();
      const unit = __DEV__ ? TestIds.INTERSTITIAL : ADS.interstitial;
      const make = () => {
        const it = InterstitialAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: child || teen });
        it.addAdEventListener(AdEventType.LOADED, () => (A.loaded = true));
        it.addAdEventListener(AdEventType.CLOSED, () => {
          A.loaded = false;
          adDone();
          it.load();
        });
        it.addAdEventListener(AdEventType.ERROR, () => {
          A.loaded = false;
          if (A.showing) adDone();
          setTimeout(() => !full.current && it.load(), 60000); // try again in a minute
        });
        it.load();
        return it;
      };
      A.unit = make();
    } catch (e) {}
  };
  const showAd = () => {
    const A = ad.current;
    if (full.current || !A.unit || !A.loaded) return adDone();
    A.showing = true;
    A.unit.show().catch(adDone);
  };

  useEffect(() => {
    Asset.fromModule(require('./assets/game.html'))
      .downloadAsync()
      .then(a => setUri(a.localUri || a.uri))
      .catch(() => {});
    if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      call('window.__nativeBack&&window.__nativeBack()');
      return true;
    });
    // purchases: connect, check what this account owns (also catches refunds), listen for new purchases
    let subs = [];
    if (IAP) {
      IAP.initConnection()
        .then(() => {
          checkOwned();
          sendPrice();
        })
        .catch(() => {});
      subs = [
        IAP.purchaseUpdatedListener(async p => {
          if (p.productId !== STORE.fullGame) return;
          if (p.purchaseState === 'purchased') {
            await IAP.finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
            setFull(true);
          } else if (p.purchaseState === 'pending') call("window.__buyResult&&window.__buyResult('pending')");
        }),
        IAP.purchaseErrorListener(e => {
          if (e && e.code !== 'user-cancelled') call("window.__buyResult&&window.__buyResult('error')");
        }),
      ];
    }
    const app = AppState.addEventListener('change', s => {
      if (s === 'active') {
        if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        call('window.__appResume&&window.__appResume()');
      } else call('window.__appPause&&window.__appPause()');
    });
    return () => {
      back.remove();
      app.remove();
      subs.forEach(x => x && x.remove && x.remove());
      if (IAP) IAP.endConnection().catch(() => {});
    };
  }, []);

  const onMessage = e => {
    let m = {};
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch (err) {}
    if (m.type === 'exit') BackHandler.exitApp();
    // ads
    if (m.type === 'age') startAds(m.group);
    if (m.type === 'ad') showAd();
    if (m.type === 'privacy' && Ads) Ads.AdsConsent.showPrivacyOptionsForm().catch(() => {});
    // the full-game purchase
    if (m.type === 'price') sendPrice();
    if (m.type === 'restore') checkOwned(false);
    if (m.type === 'buy') {
      if (!IAP) call("window.__buyResult&&window.__buyResult('error')");
      else
        IAP.requestPurchase({ request: { google: { skus: [STORE.fullGame] } }, type: 'in-app' }).catch(e => {
          if (!e || e.code !== 'user-cancelled') call("window.__buyResult&&window.__buyResult('error')");
        });
    }
    if (!PlayGames) return;
    if (m.type === 'ach') {
      const id = (PG_CONFIG.achievements || {})[m.key];
      if (id) PlayGames.unlockAchievement(id).catch(() => {});
    }
    if (m.type === 'achievements')
      PlayGames.signIn()
        .then(ok => ok && PlayGames.showAchievements())
        .catch(() => {});
    if (m.type === 'score') {
      const id = PG_CONFIG.leaderboards[m.board];
      if (id && m.value > 0) PlayGames.submitScore(id, Math.floor(m.value)).catch(() => {});
    }
    if (m.type === 'leaderboards')
      PlayGames.signIn()
        .then(ok => ok && PlayGames.showLeaderboards())
        .catch(() => {});
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar hidden style="light" />
      {uri && (
        <WebView
          ref={web}
          source={{ uri }}
          style={styles.web}
          originWhitelist={['*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          overScrollMode="never"
          bounces={false}
          scrollEnabled={false}
          androidLayerType="hardware"
          textZoom={100}
          webviewDebuggingEnabled
          onMessage={onMessage}
          // the WebView's renderer was killed in the background (black screen): load the game again
          onRenderProcessGone={() => web.current && web.current.reload()}
          onContentProcessDidTerminate={() => web.current && web.current.reload()}
          onLoadEnd={() => {
            SplashScreen.hideAsync().catch(() => {});
            loaded.current = true;
            Object.values(later.current).forEach(call); // purchase state / price that arrived early
            if (PlayGames) {
              call('window.__playGames=true');
              // once signed in, the game re-sends every achievement it has earned (window.__pgReady)
              PlayGames.signIn()
                .then(ok => ok && call('window.__pgReady&&window.__pgReady()'))
                .catch(() => {});
            }
          }}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Game />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
});
