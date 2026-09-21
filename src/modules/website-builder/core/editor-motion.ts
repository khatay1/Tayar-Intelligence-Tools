import type { ElementAnimation, ElementAnimationEasing } from './types';

const ELEMENT_ANIMATIONS: readonly ElementAnimation[] = [
  'none', 'fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
  'zoom-in', 'zoom-out', 'slide-up', 'slide-down', 'slide-left',
  'slide-right', 'blur-in', 'flip-in', 'bounce-in',
];

export function normalizeElementAnimation(value: unknown): ElementAnimation {
  return typeof value === 'string' && ELEMENT_ANIMATIONS.includes(value as ElementAnimation)
    ? value as ElementAnimation
    : 'none';
}

export function elementAnimationTransform(animation: ElementAnimation, distance: number): string {
  if (animation === 'fade-up' || animation === 'slide-up') return `translate3d(0,${distance}px,0)`;
  if (animation === 'fade-down' || animation === 'slide-down') return `translate3d(0,-${distance}px,0)`;
  if (animation === 'fade-left' || animation === 'slide-left') return `translate3d(${distance}px,0,0)`;
  if (animation === 'fade-right' || animation === 'slide-right') return `translate3d(-${distance}px,0,0)`;
  if (animation === 'zoom-in') return 'scale(.86)';
  if (animation === 'zoom-out') return 'scale(1.14)';
  if (animation === 'flip-in') return 'perspective(900px) rotateX(-18deg)';
  if (animation === 'bounce-in') return 'translate3d(0,24px,0) scale(.94)';
  return 'none';
}

export function elementAnimationEasing(value: unknown): string {
  const easing = value as ElementAnimationEasing | undefined;
  if (easing === 'linear') return 'linear';
  if (easing === 'ease') return 'ease';
  if (easing === 'spring') return 'cubic-bezier(.34,1.56,.64,1)';
  return 'cubic-bezier(.22,1,.36,1)';
}

