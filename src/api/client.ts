import {
  CommandResponse,
  EloStatusResponse,
  EloTarget,
  HealthResponse,
  PrivacyResponse,
  RestrictionsResponse,
  RobotMode,
  RobotStateResponse,
  SessionCurrentResponse,
  SessionReportDetail,
  SessionReportSummary,
} from '../types';

const REQUEST_TIMEOUT_MS = 3500;

// Configurable Raspberry Pi Core URL via Expo environment variable
// Set EXPO_PUBLIC_ELO_CORE_URL in .env (e.g., http://192.168.1.100:8090)
export const DEFAULT_ELO_CORE_URL =
  process.env.EXPO_PUBLIC_ELO_CORE_URL || 'http://192.168.1.100:8090';

export class ApiError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Normalizes user-inputted base URL to ensure proper protocol and no trailing slash.
 */
export function normalizeBaseUrl(url: string): string {
  let cleaned = (url || '').trim();
  if (!cleaned) {
    return DEFAULT_ELO_CORE_URL;
  }
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
}

/**
 * Normalizes case/naming differences in robot modes.
 */
export function normalizeRobotMode(rawMode?: string): RobotMode {
  if (!rawMode) return 'stopped';
  const lower = String(rawMode).toLowerCase();
  if (lower === 'follow' || lower === 'moving') return 'moving';
  if (lower === 'interact' || lower === 'interacting') return 'interacting';
  if (lower === 'stop' || lower === 'stopped') return 'stopped';
  return 'unknown';
}

/**
 * Normalizes status payloads from Raspberry Pi ELO Core GET /status.
 */
export function normalizeStatusResponse(data: any): EloStatusResponse {
  const rawState = data?.state ?? data?.mode ?? data?.robot_state ?? data?.current_mode;
  return {
    online: data?.online !== undefined ? !!data.online : true,
    state: normalizeRobotMode(rawState),
    target_id: data?.target_id ?? (typeof data?.target === 'string' ? data.target : data?.target?.id) ?? null,
    obstacle: !!(data?.obstacle ?? data?.obstacle_detected),
    obstacle_detail: data?.obstacle_detail || (data?.obstacle ? 'Obstacle detected' : undefined),
    ai_connected: data?.ai_connected ?? (data?.ai_status === 'connected' || data?.ai_status === true || false),
    audio_ready: data?.audio_ready ?? (data?.audio_status === 'ready' || data?.audio_status === true || false),
    last_updated: data?.last_updated || data?.timestamp || new Date().toISOString(),
  };
}

/**
 * Normalizes targets from Raspberry Pi ELO Core GET /targets.
 */
export function normalizeTargets(data: any): EloTarget[] {
  const rawList = Array.isArray(data) ? data : (Array.isArray(data?.targets) ? data.targets : []);
  return rawList.map((t: any, index: number) => {
    const id = String(t.id ?? t.target_id ?? index + 1);
    const label = t.label ?? t.name ?? `Person ${id}`;
    return {
      id,
      label,
      confidence: typeof t.confidence === 'number' ? t.confidence : undefined,
      distance: typeof t.distance === 'number' ? t.distance : undefined,
    };
  });
}

async function requestWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    return res;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiError('Connection timed out. Check Raspberry Pi IP and network.', 408);
    }
    throw new ApiError(error?.message || 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  /**
   * Health check for Raspberry Pi ELO Core (GET /health)
   */
  async checkHealth(baseUrl: string): Promise<HealthResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/health`, { method: 'GET' }, 2500);
    if (!res.ok) {
      throw new ApiError(`Health check failed with status ${res.status}`, res.status);
    }
    const data = await res.json().catch(() => ({ status: 'ok' }));
    return data;
  },

  /**
   * Fetch current robot operating mode (maps to Pi Core /status)
   */
  async getRobotState(baseUrl: string): Promise<RobotStateResponse> {
    const status = await this.getEloStatus(baseUrl);
    return {
      mode: status.state,
      updatedAt: status.last_updated,
    };
  },

  /**
   * Command robot mode switch (maps to Pi Core POST /mode)
   */
  async setRobotMode(baseUrl: string, mode: RobotMode): Promise<RobotStateResponse> {
    const piMode = mode === 'moving' ? 'FOLLOW' : mode === 'interacting' ? 'INTERACT' : 'STOP';
    const res = await this.setEloMode(baseUrl, piMode);
    return {
      mode: res.state || mode,
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Active session time info (returns null if 404 or inactive)
   */
  async getCurrentSession(baseUrl: string): Promise<SessionCurrentResponse | null> {
    const root = normalizeBaseUrl(baseUrl);
    try {
      const res = await requestWithTimeout(`${root}/api/session/current`, { method: 'GET' }, 2000);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new ApiError(`Failed to fetch current session (${res.status})`, res.status);
      }
      return res.json();
    } catch {
      return null;
    }
  },

  /**
   * Recent session reports summary list
   */
  async getSessionReports(baseUrl: string, limit: number = 10): Promise<SessionReportSummary[]> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/reports?limit=${limit}`, { method: 'GET' });
    if (!res.ok) {
      throw new ApiError(`Failed to fetch reports (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Full session report detail including transcript
   */
  async getSessionReportDetail(baseUrl: string, reportId: string): Promise<SessionReportDetail> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/reports/${encodeURIComponent(reportId)}`, {
      method: 'GET',
    });
    if (!res.ok) {
      throw new ApiError(`Failed to fetch report detail (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Daily interaction time restrictions
   */
  async getRestrictions(baseUrl: string): Promise<RestrictionsResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/restrictions`, { method: 'GET' });
    if (!res.ok) {
      throw new ApiError(`Failed to fetch restrictions (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Set daily interaction limit in minutes
   */
  async setRestrictions(baseUrl: string, dailyLimitMinutes: number): Promise<RestrictionsResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/restrictions`, {
      method: 'POST',
      body: JSON.stringify({ dailyLimitMinutes }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || errData.detail || `Failed to save restrictions (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Exclude current session from report
   */
  async setPrivacyVisibility(baseUrl: string, enabled: boolean): Promise<PrivacyResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/privacy/visibility`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      throw new ApiError(`Failed to update report privacy (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Mute robot microphone
   */
  async setPrivacyMute(baseUrl: string, enabled: boolean): Promise<PrivacyResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/privacy/mute`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      throw new ApiError(`Failed to update microphone mute (${res.status})`, res.status);
    }
    return res.json();
  },

  // ─── Raspberry Pi ELO Core Endpoints (Port 8090) ───

  /**
   * Full ELO status from Pi Core: online, state, target, obstacle, AI, audio (GET /status)
   */
  async getEloStatus(baseUrl: string): Promise<EloStatusResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/status`, { method: 'GET' }, 2500);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch ELO status (${res.status})`, res.status);
    }
    const data = await res.json();
    return normalizeStatusResponse(data);
  },

  /**
   * List of detected/trackable targets from Pi vision system (GET /targets)
   */
  async getTargets(baseUrl: string): Promise<EloTarget[]> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/targets`, { method: 'GET' }, 2500);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch targets (${res.status})`, res.status);
    }
    const data = await res.json();
    return normalizeTargets(data);
  },

  /**
   * Parent explicitly selects a tracking target (POST /target)
   */
  async selectTarget(baseUrl: string, targetId: string): Promise<CommandResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/target`, {
      method: 'POST',
      body: JSON.stringify({ target_id: targetId }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || errData.detail || `Target selection failed (${res.status})`, res.status);
    }
    const data = await res.json().catch(() => ({ success: true }));
    return {
      success: data.success !== false,
      target_id: data.target_id || targetId,
      ...data,
    };
  },

  /**
   * Request mode change: FOLLOW, INTERACT, or STOP (POST /mode)
   * Pi validates command and returns confirmed state.
   */
  async setEloMode(baseUrl: string, mode: 'FOLLOW' | 'INTERACT' | 'STOP'): Promise<CommandResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || errData.detail || `Mode command failed (${res.status})`, res.status);
    }
    const data = await res.json().catch(() => ({ success: true }));
    const normalizedState = data.state
      ? normalizeRobotMode(data.state)
      : (mode === 'FOLLOW' ? 'moving' : mode === 'INTERACT' ? 'interacting' : 'stopped');
    return {
      success: data.success !== false,
      state: normalizedState,
      ...data,
    };
  },

  /**
   * Emergency stop — highest priority safety command from dashboard (POST /stop)
   */
  async emergencyStop(baseUrl: string): Promise<CommandResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || errData.detail || `Stop command failed (${res.status})`, res.status);
    }
    const data = await res.json().catch(() => ({ success: true }));
    return {
      success: data.success !== false,
      state: 'stopped',
      ...data,
    };
  },

  /**
   * Audio subsystem status on Pi Core (GET /audio/status)
   */
  async getAudioStatus(baseUrl: string): Promise<{ ready: boolean; active?: boolean }> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/audio/status`, { method: 'GET' }, 2000);
    if (!res.ok) {
      throw new ApiError(`Audio status check failed (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Start audio playback/recording on Pi Core (POST /audio/start)
   */
  async startAudio(baseUrl: string): Promise<CommandResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/audio/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || `Audio start failed (${res.status})`, res.status);
    }
    return res.json().catch(() => ({ success: true }));
  },

  /**
   * Stop audio playback/recording on Pi Core (POST /audio/stop)
   */
  async stopAudio(baseUrl: string): Promise<CommandResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/audio/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || `Audio stop failed (${res.status})`, res.status);
    }
    return res.json().catch(() => ({ success: true }));
  },

  /**
   * Start active interaction session on Pi Core (POST /interaction/start)
   */
  async startInteraction(baseUrl: string): Promise<CommandResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/interaction/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || `Interaction start failed (${res.status})`, res.status);
    }
    return res.json().catch(() => ({ success: true }));
  },

  /**
   * End active interaction session on Pi Core (POST /interaction/end)
   */
  async endInteraction(baseUrl: string): Promise<CommandResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/interaction/end`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || `Interaction end failed (${res.status})`, res.status);
    }
    return res.json().catch(() => ({ success: true }));
  },
};
