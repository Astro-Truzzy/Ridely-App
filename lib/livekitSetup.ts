import { Platform } from 'react-native';

/**
 * Required once before any LiveKit usage. Skipped on web (voice calls are native-only).
 */
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native');
  registerGlobals();
}
