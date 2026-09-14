import {
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
    return 'http://localhost:8000';
  }
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
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
      throw new ApiError('Connection timed out. Check local IP and WiFi.', 408);
    }
    throw new ApiError(error?.message || 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  /**
   * Health check for connection testing
   */
  async checkHealth(baseUrl: string): Promise<HealthResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/health`, { method: 'GET' });
    if (!res.ok) {
      throw new ApiError(`Health check failed with status ${res.status}`, res.status);
    }
    return res.json();
  },

  /**
   * Fetch current robot operating mode
   */
  async getRobotState(baseUrl: string): Promise<RobotStateResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/state`, { method: 'GET' }, 2000);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch robot state (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Command robot mode switch ('moving' <-> 'interacting')
   */
  async setRobotMode(baseUrl: string, mode: RobotMode): Promise<RobotStateResponse> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || `Failed to change mode (${res.status})`, res.status);
    }
    return res.json();
  },

  /**
   * Active session time info (returns null if 404 or inactive)
   */
  async getCurrentSession(baseUrl: string): Promise<SessionCurrentResponse | null> {
    const root = normalizeBaseUrl(baseUrl);
    const res = await requestWithTimeout(`${root}/api/session/current`, { method: 'GET' }, 2000);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new ApiError(`Failed to fetch current session (${res.status})`, res.status);
    }
    return res.json();
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
      throw new ApiError(errData.error || `Failed to save restrictions (${res.status})`, res.status);
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
};
