/**
 * ELO Design System — Nothing-Inspired Dark Monochrome + ELO Identity
 *
 * Design philosophy: "Subtract, don't add."
 * Monochromatic canvas. Color is an event, not decoration.
 * Typography creates hierarchy. Three layers max per component.
 *
 * ELO Identity Colors (derived from the physical robot):
 *   eyeCyan   — the glowing cyan display eyes
 *   wheelAmber — the bold yellow wheel hubs
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

  // The ONLY danger accent — used exclusively for danger/mute/stop state
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

  // ─── ELO Identity Colors ───
  // Pulled directly from the physical robot.
  // Use ONLY for ELO-identity elements — never as decoration.

  /** Cyan eye glow — used for INTERACTING state and "ELO is thinking/speaking" */
  eyeCyan: '#4DD9F5',
  eyeCyanMuted: 'rgba(77, 217, 245, 0.12)',
  eyeCyanBorder: 'rgba(77, 217, 245, 0.3)',

  /** Amber wheel color — used for FOLLOWING state and target lock confirmation */
  wheelAmber: '#F5C400',
  wheelAmberMuted: 'rgba(245, 196, 0, 0.12)',
  wheelAmberBorder: 'rgba(245, 196, 0, 0.3)',

  // Phase C: semantic state accents (used sparingly per design philosophy)
  stateMoving: '#F5C400',       // Following → amber (wheels moving)
  stateInteracting: '#4DD9F5',  // Interacting → cyan (eyes active)
  stateStopped: '#555555',
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
  pill: 9999,
};
