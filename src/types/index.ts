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

export interface EloTarget {
  id: string;
  label: string;
  confidence?: number;
  distance?: number;
}

export interface EloStatusResponse {
  online: boolean;
  state: RobotMode;
  target_id: string | null;
  obstacle: boolean;
  obstacle_detail?: string;
  ai_connected: boolean;
  audio_ready: boolean;
  last_updated: string;
}

export interface EloTargetsResponse {
  targets: EloTarget[];
}

export interface CommandResponse {
  success: boolean;
  state?: RobotMode;
  target_id?: string;
  error?: string;
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

export type RootTabParamList = {
  Home: undefined;
  Reports: undefined;
  Restrictions: undefined;
  Settings: undefined;
};

export type ReportsStackParamList = {
  ReportsList: undefined;
  ReportDetail: { reportId: string; reportTitle?: string };
};
