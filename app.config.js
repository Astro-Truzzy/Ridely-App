// Separate Google Maps API keys for Android and iOS (native map tiles).
// For Directions/Places/Geocoding from the app, use either key or a third key in .env.
const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || '';
const iosMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || '';

export default {
  expo: {
    name: 'Ridely',
    slug: 'Ridely',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'Ridely',
    userInterfaceStyle: 'automatic',
    // react-native-maps v1.20.x does not expose an Expo config plugin.
    // Keep native Google Maps keys below; do not add react-native-maps to plugins.
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
    ],
    experiments: { typedRoutes: true },
    android: {
      package: 'com.deliveryapp.ridely',
      config: {
        googleMaps: { apiKey: androidMapsKey },
      },
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.deliveryapp.ridely',
      config: {
        googleMapsApiKey: iosMapsKey,
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    extra: {
      router: {},
      eas: { projectId: 'f6270d95-21c0-4912-9e17-db7b676f0a7a' },
    },
  },
};
