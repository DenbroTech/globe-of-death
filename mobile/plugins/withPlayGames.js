/* Adds the Play Games application ID to the Android manifest (required by Play Games Services).
   Reads it from playGames.config.js; does nothing while it's empty. */
const { withAndroidManifest, withStringsXml, AndroidConfig } = require('expo/config-plugins');
const { appId } = require('../playGames.config.js');

module.exports = function withPlayGames(config) {
  if (!appId) return config;
  config = withStringsXml(config, c => {
    c.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'game_services_project_id', translatable: 'false' }, _: String(appId) }],
      c.modResults,
    );
    return c;
  });
  config = withAndroidManifest(config, c => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.android.gms.games.APP_ID', '@string/game_services_project_id');
    return c;
  });
  return config;
};
