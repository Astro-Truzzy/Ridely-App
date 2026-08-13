import { isRunningInExpoGo } from 'expo';
import { NativeModules } from 'react-native';
import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/** True only when this binary was built with the Sentry native module linked. */
const hasNativeSentry = !isRunningInExpoGo() && !!NativeModules.RNSentry;

let initialized = false;

export function initSentry(): void {
  if (initialized || !dsn) return;

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    enableNative: hasNativeSentry,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    profilesSampleRate: hasNativeSentry ? (__DEV__ ? 1.0 : 0.2) : 0,
    // Error replays always; continuous session replay only in production (dev floods Metro)
    replaysOnErrorSampleRate: hasNativeSentry ? 1.0 : 0,
    replaysSessionSampleRate: hasNativeSentry && !__DEV__ ? 0.1 : 0,
    enableLogs: process.env.EXPO_PUBLIC_SENTRY_DEBUG === '1',
    integrations: hasNativeSentry
      ? [
          Sentry.mobileReplayIntegration({
            maskAllText: true,
            maskAllImages: true,
          }),
        ]
      : [],
    enableNativeFramesTracking: hasNativeSentry,
    // Opt-in verbose logs: EXPO_PUBLIC_SENTRY_DEBUG=1
    debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG === '1',
    environment: __DEV__ ? 'development' : 'production',
  });

  if (__DEV__ && !hasNativeSentry) {
    console.log(
      '[Sentry] JS-only mode (native module missing). Rebuild with `npx expo run:android` for crashes/replay.',
    );
  }

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) {
    console.error(error);
    return;
  }
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
