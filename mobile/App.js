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
    const app = AppState.addEventListener('change', s => {
      if (s === 'active') {
        if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        call('window.__appResume&&window.__appResume()');
      } else call('window.__appPause&&window.__appPause()');
    });
    return () => {
      back.remove();
      app.remove();
    };
  }, []);

  const onMessage = e => {
    let m = {};
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch (err) {}
    if (m.type === 'exit') BackHandler.exitApp();
    if (!PlayGames) return;
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
          onLoadEnd={() => {
            SplashScreen.hideAsync().catch(() => {});
            if (PlayGames) {
              call('window.__playGames=true;window.__pgReady&&window.__pgReady()');
              PlayGames.signIn().catch(() => {});
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
