module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // other plugins you might have (keep them here)
      // Ensure react-native-reanimated/plugin is LAST
      'react-native-reanimated/plugin',
    ],
  };
};
