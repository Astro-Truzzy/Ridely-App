import fs from 'fs';
import { withAndroidManifest } from 'expo/config-plugins';

// Separate Google Maps API keys for Android and iOS (native map tiles).
// For Directions/Places/Geocoding from the app, use either key or a third key in .env.
const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || '';
const iosMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || '';

// .env is excluded from EAS uploads (.easignore), so a production build without the key
// in the EAS "production" environment would ship grey map tiles. Fail the build instead.
if (
  process.env.EAS_BUILD === 'true' &&
  process.env.EAS_BUILD_PROFILE === 'production' &&
  process.env.EAS_BUILD_PLATFORM === 'android' &&
  !androidMapsKey
) {
  throw new Error(
    'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY is missing from the EAS production environment. ' +
      'Run `node scripts/sync-eas-env.mjs` before building.',
  );
}

// FCM config for push notifications. On EAS, upload it as a file env var named
// GOOGLE_SERVICES_JSON; locally, drop google-services.json in the project root.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

// @livekit/react-native-webrtc's manifest declares a mediaProjection foreground service
// for screen sharing. Ridely only uses audio calls, and shipping that service forces a
// Play Console foreground-service declaration we can't justify — strip it at merge time.
const withoutMediaProjectionService = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application?.[0];
    if (app) {
      app.service = (app.service ?? []).filter(
        (s) => s.$['android:name'] !== 'com.oney.WebRTCModule.MediaProjectionService',
      );
      app.service.push({
        $: {
          'android:name': 'com.oney.WebRTCModule.MediaProjectionService',
          'tools:node': 'remove',
        },
      });
    }
    return cfg;
  });

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
    // Do not add 'react-native-maps' to plugins. v1.27.2 ships a config plugin, but its
    // Android handler *removes* com.google.android.geo.API_KEY from the manifest unless
    // passed androidGoogleMapsApiKey — listing it bare would silently break map tiles.
    // The keys below are the supported path: prebuild writes them straight into
    // AndroidManifest.xml and Info.plist.
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      'expo-dev-client',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Ridely to use your location to set pickup points and share live delivery progress.',
          isAndroidBackgroundLocationEnabled: false,
          isIosBackgroundLocationEnabled: false,
        },
      ],
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
      'expo-sharing',
      withoutMediaProjectionService,
    ],
    experiments: { typedRoutes: true },
    android: {
      package: 'com.deliveryapp.ridely',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0B1040',
      },
      ...(googleServicesFile ? { googleServicesFile } : {}),
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      ],
      // Added by the webrtc config plugin; Ridely has no overlay UI and Play flags it.
      blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
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
        ITSAppUsesNonExemptEncryption: false,
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
