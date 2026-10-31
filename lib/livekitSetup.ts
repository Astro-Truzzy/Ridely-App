import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

type LiveKitNative = typeof import('@livekit/react-native');

let liveKitNative: LiveKitNative | null = null;

/**
 * Whether the WebRTC native module is in this binary.
 *
 * Do not answer this by requiring '@livekit/react-native-webrtc': its entry point throws
 * at module scope when the native module is missing, and dev builds surface that throw as
 * a red box even though the require sits inside a try/catch. Probe the same thing the
 * library's entry point checks instead.
 */
function hasWebRTCNativeModule(): boolean {
  try {
    return NativeModules.WebRTCModule != null;
  } catch {
    return false;
  }
}

/** LiveKit WebRTC is not present in Expo Go; only load it in a native/dev build. */
export function isLiveKitRuntimeAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  // Expo Go does not ship the WebRTC native module.
  if (Constants.appOwnership === 'expo') return false;
  // appOwnership can be undefined in newer SDKs; executionEnvironment is the modern signal.
  if (Constants.executionEnvironment === 'storeClient') return false;
  return hasWebRTCNativeModule();
}

export function getLiveKitNative(): LiveKitNative | null {
  if (!isLiveKitRuntimeAvailable()) return null;
  if (!liveKitNative) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      liveKitNative = require('@livekit/react-native') as LiveKitNative;
    } catch {
      liveKitNative = null;
      return null;
    }
  }
  return liveKitNative;
}

try {
  if (isLiveKitRuntimeAvailable()) {
    getLiveKitNative()?.registerGlobals?.();
  }
} catch {
  // LiveKit native module not available (e.g. Expo Go) — skip registration.
}
