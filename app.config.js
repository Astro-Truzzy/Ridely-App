// Separate Google Maps API keys for Android and iOS (native map tiles).
// For Directions/Places/Geocoding from the app, use either key or a third key in .env.
const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || '';
const iosMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || '';

export default {
  expo: {
    name: 'Ridely',
    slug: 'ridely',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'Ridely',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#174AFF',
    },
    // react-native-maps v1.20.x does not expose an Expo config plugin.
    // Keep native Google Maps keys below; do not add react-native-maps to plugins.
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      'expo-dev-client',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Ridely to access your photos to share pictures.',
          cameraPermission: 'Allow Ridely to use your camera to take pictures.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/notification-icon.png',
          color: '#174AFF',
          sounds: [],
          mode: 'production',
        },
      ],
      [
        '@livekit/react-native-expo-plugin',
        {
          android: { audioType: 'communication' },
          ios: { enableMultitaskingCameraAccess: false },
        },
      ],
      [
        '@config-plugins/react-native-webrtc',
        {
          cameraPermission: 'Ridely does not use the camera for calls.',
          microphonePermission: 'Allow Ridely to use your microphone for voice calls with your rider or customer.',
        },
      ],
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: process.env.SENTRY_ORG || 'williams-group',
          project: process.env.SENTRY_PROJECT || 'android',
          disableAutoUpload: process.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true',
        },
      ],
    ],
    experiments: { typedRoutes: true },
    android: {
      package: 'com.deliveryapp.ridely',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0B1040',
      },
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      ],
      config: {
        googleMaps: { apiKey: androidMapsKey },
      },
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.deliveryapp.ridely',
      infoPlist: {
        NSMicrophoneUsageDescription:
          'Allow Ridely to use your microphone for voice calls with your rider or customer.',
        UIBackgroundModes: ['audio'],
      },
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
