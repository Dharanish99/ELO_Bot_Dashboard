/**
 * ELO Design System — Nothing-Inspired Dark Monochrome
 *
 * Design philosophy: "Subtract, don't add."
 * Monochromatic canvas. Color is an event, not decoration.
 * Typography creates hierarchy. Three layers max per component.
 */

export const colors = {
  // Canvas
  background: '#000000',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  surfacePressed: '#222222',

  // Typography
  textPrimary: '#F5F5F5',
  textSecondary: '#888888',
  textMuted: '#555555',
  textInverse: '#000000',

  // Borders & dividers
  border: '#222222',
  borderLight: '#1A1A1A',
  borderStrong: '#333333',

  // The ONLY accent color — used exclusively for danger/mute state
  accent: '#FF3B30',
  accentMuted: 'rgba(255, 59, 48, 0.15)',

  // Functional dots (tiny, contextual use only)
  dotOnline: '#34C759',
  dotOffline: '#FF3B30',
  dotSyncing: '#888888',

  // Progress / success (very subdued)
  progressTrack: '#1A1A1A',
  progressFill: '#555555',
  progressNearLimit: '#888888',
  progressExceeded: '#FF3B30',

  // Shadows (minimal on dark theme)
  shadow: 'rgba(0, 0, 0, 0.5)',

  // Phase C: semantic state accents (used sparingly per design philosophy)
  stateMoving: '#4A9EFF',
  stateInteracting: '#A78BFA',
  stateStopped: '#888888',
  stateUnknown: '#FFB020',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
