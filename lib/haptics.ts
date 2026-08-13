import * as Haptics from 'expo-haptics';

/**
 * Thin, crash-safe wrappers around expo-haptics. Haptics are best-effort feedback;
 * failures (unsupported device, web) are swallowed so callers never need try/catch.
 */

/** Light tap — use for selection changes, toggles, minor confirmations. */
export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium tap — use for primary button presses (accept, confirm, pay). */
export function tapMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success notification — use when an action completes successfully. */
export function notifySuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning notification — use for reversible/destructive prompts (cancel, reject). */
export function notifyWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error notification — use when an action fails. */
export function notifyError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
