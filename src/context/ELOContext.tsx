import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, normalizeBaseUrl } from '../api/client';
import {
  EloStatusResponse,
  EloTarget,
  RobotMode,
  SessionCurrentResponse,
} from '../types';

const STORAGE_KEY_BASE_URL = '@elo_backend_base_url';
const DEFAULT_BASE_URL = 'http://localhost:8000';
const POLLING_INTERVAL_MS = 1500;
const FAILURE_THRESHOLD = 3;

export interface ELOContextType {
  // Connection & Base URL
  baseUrl: string;
  setBaseUrl: (url: string) => Promise<void>;
  isConnected: boolean;
  consecutiveFailures: number;
  isUnreachable: boolean;
  lastSuccessfulPoll: Date | null;
  retryConnection: () => Promise<void>;
  testConnectionUrl: (url: string) => Promise<{ success: boolean; latencyMs?: number; error?: string }>;

  // Robot Mode (Legacy / compatibility)
  robotMode: RobotMode;
  modeUpdatedAt: string | null;
  isModeChanging: boolean;
  toggleRobotMode: () => Promise<void>;

  // Privacy Controls
  excludeFromReport: boolean;
  isMuted: boolean;
  isTogglingVisibility: boolean;
  isTogglingMute: boolean;
  setExcludeFromReport: (enabled: boolean) => Promise<void>;
  setMuteMicrophone: (enabled: boolean) => Promise<void>;

  // Session Info
  currentSession: SessionCurrentResponse | null;

  // Restrictions
  dailyLimitMinutes: number;
  setDailyLimit: (minutes: number) => Promise<boolean>;
  refreshRestrictions: () => Promise<void>;

  // Status flags
  isInitialLoading: boolean;

  // ─── Phase C: ELO Core State & Commands ───
  eloOnline: boolean;
  eloState: RobotMode;
  selectedTargetId: string | null;
  targets: EloTarget[];
  obstacleDetected: boolean;
  obstacleDetail: string | null;
  aiConnected: boolean;
  audioReady: boolean;
  commandPending: string | null;
  commandError: string | null;
  clearCommandError: () => void;
  selectTarget: (targetId: string) => Promise<boolean>;
  requestFollow: () => Promise<boolean>;
  requestInteract: () => Promise<boolean>;
  requestStop: () => Promise<boolean>;
}

const ELOContext = createContext<ELOContextType | undefined>(undefined);

export const ELOProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseUrl, setBaseUrlState] = useState<string>(DEFAULT_BASE_URL);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Connection health
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [lastSuccessfulPoll, setLastSuccessfulPoll] = useState<Date | null>(null);

  // Robot live state
  const [robotMode, setRobotMode] = useState<RobotMode>('moving');
  const [modeUpdatedAt, setModeUpdatedAt] = useState<string | null>(null);
  const [isModeChanging, setIsModeChanging] = useState<boolean>(false);

  // Phase C: ELO Core states
  const [eloOnline, setEloOnline] = useState<boolean>(false);
  const [eloState, setEloState] = useState<RobotMode>('stopped');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [targets, setTargets] = useState<EloTarget[]>([]);
  const [obstacleDetected, setObstacleDetected] = useState<boolean>(false);
  const [obstacleDetail, setObstacleDetail] = useState<string | null>(null);
  const [aiConnected, setAiConnected] = useState<boolean>(false);
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [commandPending, setCommandPending] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  // Privacy states
  const [excludeFromReport, setExcludeFromReportState] = useState<boolean>(false);
  const [isMuted, setIsMutedState] = useState<boolean>(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState<boolean>(false);
  const [isTogglingMute, setIsTogglingMute] = useState<boolean>(false);

  // Session & restrictions
  const [currentSession, setCurrentSession] = useState<SessionCurrentResponse | null>(null);
  const [dailyLimitMinutes, setDailyLimitMinutesState] = useState<number>(45);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingBusyRef = useRef<boolean>(false);

  // 1. Load saved Base URL on startup
  useEffect(() => {
    async function loadSavedUrl() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_BASE_URL);
        if (saved) {
          setBaseUrlState(normalizeBaseUrl(saved));
        }
      } catch (err) {
        console.warn('Failed to load saved base URL from AsyncStorage', err);
      } finally {
        setIsInitialLoading(false);
      }
    }
    loadSavedUrl();
  }, []);

  // 2. Base URL update handler
  const setBaseUrl = useCallback(async (newUrl: string) => {
    const cleaned = normalizeBaseUrl(newUrl);
    setBaseUrlState(cleaned);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_BASE_URL, cleaned);
    } catch (err) {
      console.warn('Failed to persist base URL', err);
    }
    // Reset failure counter and trigger poll
    setConsecutiveFailures(0);
  }, []);

  // 3. Poll robot state and current session
  const performPoll = useCallback(async () => {
    if (isPollingBusyRef.current) return;
    isPollingBusyRef.current = true;

    try {
      // Poll robot mode (legacy endpoint)
      try {
        const stateData = await api.getRobotState(baseUrl);
        setRobotMode(stateData.mode);
        setModeUpdatedAt(stateData.updatedAt);
      } catch {
        // Allowed if Pi only implements /api/elo
      }

      // Phase C: Poll ELO Core status & targets
      try {
        const eloStatus = await api.getEloStatus(baseUrl);
        setEloOnline(eloStatus.online);
        setEloState(eloStatus.state);
        setRobotMode(eloStatus.state);
        setSelectedTargetId(eloStatus.target_id);
        setObstacleDetected(eloStatus.obstacle);
        setObstacleDetail(eloStatus.obstacle_detail || null);
        setAiConnected(eloStatus.ai_connected);
        setAudioReady(eloStatus.audio_ready);
      } catch {
        setEloOnline(false);
      }

      try {
        const targetsList = await api.getTargets(baseUrl);
        setTargets(targetsList);
      } catch {
        // Non-critical
      }

      // Poll current session (graceful 404 handler in client)
      try {
        const sessionData = await api.getCurrentSession(baseUrl);
        setCurrentSession(sessionData);
        if (sessionData?.dailyLimitMinutes) {
          setDailyLimitMinutesState(sessionData.dailyLimitMinutes);
        }
      } catch {
        // If session endpoint fails or 404, we don't break polling
        setCurrentSession(null);
      }

      // Success marks connection healthy
      setIsConnected(true);
      setConsecutiveFailures(0);
      setLastSuccessfulPoll(new Date());
    } catch (err) {
      setConsecutiveFailures((prev) => {
        const next = prev + 1;
        if (next >= FAILURE_THRESHOLD) {
          setIsConnected(false);
          setEloOnline(false);
        }
        return next;
      });
    } finally {
      isPollingBusyRef.current = false;
    }
  }, [baseUrl]);

  // Setup periodic polling
  useEffect(() => {
    // Initial immediate poll
    performPoll();

    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    pollingTimerRef.current = setInterval(() => {
      performPoll();
    }, POLLING_INTERVAL_MS);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [performPoll]);

  // 4. Retry connection manual trigger
  const retryConnection = useCallback(async () => {
    setConsecutiveFailures(0);
    await performPoll();
  }, [performPoll]);

  // 5. Toggle Robot Mode ('moving' <-> 'interacting')
  const toggleRobotMode = useCallback(async () => {
    if (isModeChanging) return;
    const targetMode: RobotMode = robotMode === 'moving' ? 'interacting' : 'moving';
    setIsModeChanging(true);

    try {
      const response = await api.setRobotMode(baseUrl, targetMode);
      // Wait for confirmed response from backend
      if (response && response.mode) {
        setRobotMode(response.mode);
        setModeUpdatedAt(new Date().toISOString());
        setIsConnected(true);
        setConsecutiveFailures(0);
      }
    } catch (error: any) {
      console.warn('Mode switch command failed:', error.message);
      // Increment failure count if it was a network error
      setConsecutiveFailures((prev) => prev + 1);
      throw error;
    } finally {
      setIsModeChanging(false);
    }
  }, [baseUrl, robotMode, isModeChanging]);

  // 6. Privacy: Exclude current session from report
  const setExcludeFromReport = useCallback(
    async (enabled: boolean) => {
      setIsTogglingVisibility(true);
      try {
        const res = await api.setPrivacyVisibility(baseUrl, enabled);
        setExcludeFromReportState(res.enabled);
      } catch (err: any) {
        console.warn('Privacy visibility change failed:', err.message);
        throw err;
      } finally {
        setIsTogglingVisibility(false);
      }
    },
    [baseUrl]
  );

  // 7. Privacy: Mute microphone
  const setMuteMicrophone = useCallback(
    async (enabled: boolean) => {
      setIsTogglingMute(true);
      try {
        const res = await api.setPrivacyMute(baseUrl, enabled);
        setIsMutedState(res.enabled);
      } catch (err: any) {
        console.warn('Microphone mute change failed:', err.message);
        throw err;
      } finally {
        setIsTogglingMute(false);
      }
    },
    [baseUrl]
  );

  // 8. Restrictions: Fetch and update
  const refreshRestrictions = useCallback(async () => {
    try {
      const res = await api.getRestrictions(baseUrl);
      setDailyLimitMinutesState(res.dailyLimitMinutes);
    } catch (err) {
      console.warn('Could not fetch restrictions', err);
    }
  }, [baseUrl]);

  const setDailyLimit = useCallback(
    async (minutes: number): Promise<boolean> => {
      try {
        const res = await api.setRestrictions(baseUrl, minutes);
        setDailyLimitMinutesState(res.dailyLimitMinutes);
        return true;
      } catch (err) {
        console.warn('Failed to set restrictions', err);
        return false;
      }
    },
    [baseUrl]
  );

  // 9. Test connection URL
  const testConnectionUrl = useCallback(
    async (targetUrl: string): Promise<{ success: boolean; latencyMs?: number; error?: string }> => {
      const start = Date.now();
      try {
        const res = await api.checkHealth(targetUrl);
        const latency = Date.now() - start;
        if (res.status === 'ok') {
          return { success: true, latencyMs: latency };
        }
        return { success: false, error: `Health status: ${res.status}` };
      } catch (err: any) {
        return { success: false, error: err.message || 'Cannot reach server' };
      }
    },
    []
  );

  // ─── Phase C: Command Methods ───

  const clearCommandError = useCallback(() => {
    setCommandError(null);
  }, []);

  const selectTarget = useCallback(
    async (targetId: string): Promise<boolean> => {
      setCommandPending('Selecting target...');
      setCommandError(null);
      try {
        const res = await api.selectTarget(baseUrl, targetId);
        if (res.success) {
          setSelectedTargetId(res.target_id || targetId);
          return true;
        } else {
          setCommandError(res.error || 'Failed to select target');
          return false;
        }
      } catch (err: any) {
        setCommandError(err.message || 'Network error selecting target');
        return false;
      } finally {
        setCommandPending(null);
      }
    },
    [baseUrl]
  );

  const requestFollow = useCallback(async (): Promise<boolean> => {
    if (!selectedTargetId) {
      setCommandError('No target selected. Select a target first.');
      return false;
    }
    setCommandPending('Requesting Follow...');
    setCommandError(null);
    try {
      const res = await api.setEloMode(baseUrl, 'FOLLOW');
      if (res.success && res.state) {
        setEloState(res.state);
        setRobotMode(res.state);
        return true;
      } else {
        setCommandError(res.error || 'Follow command rejected');
        return false;
      }
    } catch (err: any) {
      setCommandError(err.message || 'Failed to start following');
      return false;
    } finally {
      setCommandPending(null);
    }
  }, [baseUrl, selectedTargetId]);

  const requestInteract = useCallback(async (): Promise<boolean> => {
    setCommandPending('Requesting Interact...');
    setCommandError(null);
    try {
      const res = await api.setEloMode(baseUrl, 'INTERACT');
      if (res.success && res.state) {
        setEloState(res.state);
        setRobotMode(res.state);
        return true;
      } else {
        setCommandError(res.error || 'Interact command rejected');
        return false;
      }
    } catch (err: any) {
      setCommandError(err.message || 'Failed to switch to interact');
      return false;
    } finally {
      setCommandPending(null);
    }
  }, [baseUrl]);

  const requestStop = useCallback(async (): Promise<boolean> => {
    setCommandPending('Stopping...');
    setCommandError(null);
    try {
      const res = await api.emergencyStop(baseUrl);
      if (res.success) {
        setEloState(res.state || 'stopped');
        setRobotMode(res.state || 'stopped');
        return true;
      } else {
        setCommandError(res.error || 'Stop command rejected');
        return false;
      }
    } catch (err: any) {
      setCommandError(err.message || 'Failed to stop robot');
      return false;
    } finally {
      setCommandPending(null);
    }
  }, [baseUrl]);

  const isUnreachable = consecutiveFailures >= FAILURE_THRESHOLD;

  return (
    <ELOContext.Provider
      value={{
        baseUrl,
        setBaseUrl,
        isConnected,
        consecutiveFailures,
        isUnreachable,
        lastSuccessfulPoll,
        retryConnection,
        testConnectionUrl,
        robotMode,
        modeUpdatedAt,
        isModeChanging,
        toggleRobotMode,
        excludeFromReport,
        isMuted,
        isTogglingVisibility,
        isTogglingMute,
        setExcludeFromReport,
        setMuteMicrophone,
        currentSession,
        dailyLimitMinutes,
        setDailyLimit,
        refreshRestrictions,
        isInitialLoading,
        eloOnline,
        eloState,
        selectedTargetId,
        targets,
        obstacleDetected,
        obstacleDetail,
        aiConnected,
        audioReady,
        commandPending,
        commandError,
        clearCommandError,
        selectTarget,
        requestFollow,
        requestInteract,
        requestStop,
      }}
    >
      {children}
    </ELOContext.Provider>
  );
};

export const useELO = (): ELOContextType => {
  const context = useContext(ELOContext);
  if (!context) {
    throw new Error('useELO must be used within an ELOProvider');
  }
  return context;
};
