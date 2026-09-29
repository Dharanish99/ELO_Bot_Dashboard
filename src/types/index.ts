export type RobotMode = 'moving' | 'interacting' | 'stopped' | 'unknown';

export interface RobotStateResponse {
  mode: RobotMode;
  updatedAt: string;
}

export interface SessionCurrentResponse {
  elapsedMinutes: number;
  dailyLimitMinutes: number;
}

// ─── Phase C: ELO Core Pi Integration ───

export interface EloTargetBBox {
  /** Normalized 0.0–1.0 relative to the camera frame width */
  x: number;
  /** Normalized 0.0–1.0 relative to the camera frame height */
  y: number;
  /** Normalized 0.0–1.0 relative to the camera frame width */
  width: number;
  /** Normalized 0.0–1.0 relative to the camera frame height */
  height: number;
}

export type TrackingState = 'tracked' | 'reacquiring' | 'lost';

export interface EloTarget {
  id: string;
  label: string;
  confidence?: number;
  distance?: number;
  /** Normalized bounding box (0.0–1.0). Present when camera detection is active. */
  bbox?: EloTargetBBox;
  /** Current tracking state from the Pi vision system */
  tracking_state?: TrackingState;
}

export interface EloTargetsResponse {
  timestamp: string;
  frame_width: number;
  frame_height: number;
  targets: EloTarget[];
}

export interface EloStatusResponse {
  online: boolean;
  state: RobotMode;
  mode?: string;
  target_id: string | null;
  obstacle: boolean;
  safety_locked?: boolean;
  obstacle_detail?: string;
  ai_connected: boolean;
  audio_ready: boolean;
  audio_status?: string;
  display_connected?: boolean;
  last_updated: string;
  last_error?: string | null;
}

/**
 * Canonical Pi Audio States:
 * IDLE       — Interaction session exists, but microphone is NOT recording. (UI: READY TO LISTEN)
 * RECORDING  — Push-to-talk recording is capturing audio. (UI: LISTENING TO YOU...)
 * PROCESSING — Recording stopped; Pi sent audio_end to AI backend. (UI: THINKING...)
 * SPEAKING   — Pi is playing response audio. (UI: ELO IS SPEAKING...)
 * OFF        — No interaction session.
 */
export type CanonicalAudioState = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'SPEAKING' | 'OFF';

/** Voice UI state machine states */
export type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking' | 'error';

/** Audio subsystem status response from GET /audio/status */
export interface AudioStatusResponse {
  ready?: boolean;
  active?: boolean;
  status?: CanonicalAudioState | string;
  state?: string;
  audio_status?: string;
  recording?: boolean;
  processing?: boolean;
  speaking?: boolean;
}

export interface CameraStatus {
  available: boolean;
  streaming: boolean;
  width: number;
  height: number;
  fps: number;
  format: string;
  local_only: boolean;
}

/** UI state for target selection — staged is local-only, locked is Pi-confirmed */
export type TargetLockState = 'none' | 'staged' | 'locking' | 'locked' | 'lost' | 'reacquiring';

/** Camera stream connection state */
export type CameraConnectionState = 'connecting' | 'live' | 'degraded' | 'unavailable' | 'offline';

export interface CommandResponse {
  success: boolean;
  state?: RobotMode;
  target_id?: string | null;
  error?: string | { code: string; message: string };
}

export interface TranscriptItem {
  speaker: 'child' | 'elo';
  text: string;
  timestamp: string;
}

export interface SessionReportSummary {
  id: string;
  date: string; // ISO 8601
  durationMinutes: number;
  distanceFollowedMeters: number | null;
  obstaclesAvoided: number;
  questionsAsked: number;
  vocabularyLearned: string[];
  moodCheckIn: string | null;
  breathingExerciseCompleted: boolean;
}

export interface SessionReportDetail extends SessionReportSummary {
  transcript: TranscriptItem[];
}

export interface RestrictionsResponse {
  dailyLimitMinutes: number;
}

export interface PrivacyResponse {
  enabled: boolean;
}

export interface HealthResponse {
  status: string;
  serverTime?: string;
}

/** Alias for SessionReportDetail — used in detail screens */
export type SessionReport = SessionReportDetail;

export type RootTabParamList = {
  Home: undefined;
  Reports: undefined;
  Limits: undefined;
  Settings: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Control: undefined;
  Voice: undefined;
};

export type ReportsStackParamList = {
  ReportsList: undefined;
  ReportDetail: { reportId: string; reportTitle?: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  PiConnection: undefined;
  Diagnostics: undefined;
  AppPreferences: undefined;
  AboutElo: undefined;
  HelpSupport: undefined;
};
