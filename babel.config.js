module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // other plugins you might have (keep them here)
      // Reanimated 4.x: use worklets plugin (must be last)
      'react-native-worklets/plugin',
    ],
  };
};
