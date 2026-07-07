import {
  FadeInUp,
  FadeInDown,
  FadeIn,
  SlideInRight,
  ZoomIn,
} from 'react-native-reanimated';

const SPRING_CONFIG = { damping: 18, stiffness: 120 };
const STAGGER_MS = 55;
const MAX_STAGGER_ITEMS = 8;

/**
 * Premium enter: fade-in-up with spring. Use when animations are enabled.
 */
export function cardEnterSpring() {
  return FadeInUp.springify()
    .damping(SPRING_CONFIG.damping)
    .stiffness(SPRING_CONFIG.stiffness)
    .duration(400);
}

/**
 * Staggered enter for list items. Index 0 = 0ms delay, 1 = 70ms, etc.
 */
export function staggeredCardEnter(index: number) {
  const delayIndex = Math.min(index, MAX_STAGGER_ITEMS);
  return FadeInUp.springify()
    .damping(SPRING_CONFIG.damping)
    .stiffness(SPRING_CONFIG.stiffness)
    .delay(delayIndex * STAGGER_MS)
    .duration(340);
}

/**
 * Slightly slower, softer enter for hero/header blocks.
 */
export function heroEnter() {
  return FadeInDown.springify()
    .damping(20)
    .stiffness(100)
    .duration(450);
}

/**
 * Quick fade for overlays or secondary content.
 */
export function fadeEnter() {
  return FadeIn.duration(300);
}

/**
 * Slide from right (e.g. list rows, settings items).
 */
export function slideInRightEnter(index: number) {
  const delayIndex = Math.min(index, MAX_STAGGER_ITEMS);
  return SlideInRight.springify()
    .damping(SPRING_CONFIG.damping)
    .stiffness(SPRING_CONFIG.stiffness)
    .delay(delayIndex * 45)
    .duration(320);
}

/**
 * Light zoom for modals or emphasis cards.
 */
export function zoomInEnter() {
  return ZoomIn.springify()
    .damping(16)
    .stiffness(140)
    .duration(350);
}
