import { Platform } from 'react-native';
import Constants from 'expo-constants';

type LiveKitNative = typeof import('@livekit/react-native');

let liveKitNative: LiveKitNative | null = null;

/** LiveKit WebRTC is not present in Expo Go; only load it in a native/dev build. */
export function isLiveKitRuntimeAvailable(): boolean {
  return Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
}

export function getLiveKitNative(): LiveKitNative | null {
  if (!isLiveKitRuntimeAvailable()) return null;
  if (!liveKitNative) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    liveKitNative = require('@livekit/react-native') as LiveKitNative;
  }
  return liveKitNative;
}

if (isLiveKitRuntimeAvailable()) {
  getLiveKitNative()?.registerGlobals();
}
