import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, normalizeBaseUrl, DEFAULT_ELO_CORE_URL } from '../api/client';
import {
  EloStatusResponse,
  EloTarget,
  RobotMode,
  SessionCurrentResponse,
  TargetLockState,
} from '../types';

const STORAGE_KEY_BASE_URL = '@elo_core_base_url';
const POLLING_INTERVAL_MS = 1500;
const TARGET_POLLING_FAST_MS = 400;
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
  /** Elapsed minutes in the current session (from /api/session/current) */
  sessionElapsedMinutes: number | null;
  /** Raw audio_status string from Pi /status (e.g. 'LISTENING', 'THINKING', 'SPEAKING', 'IDLE') */
  audioStatus: string | null;
  /** Round-trip ping in ms from last successful poll */
  pingMs: number | null;

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
  safetyLocked: boolean;
  aiConnected: boolean;
  audioReady: boolean;
  displayConnected: boolean;
  commandPending: string | null;
  commandError: string | null;
  clearCommandError: () => void;

  // Legacy select (direct API call — used by list-based fallback)
  selectTarget: (targetId: string) => Promise<boolean>;

  // ─── Phase D: Target Lock Flow ───
  /** Local-only staging: marks a target as "selected but not yet confirmed" */
  stagedTargetId: string | null;
  stageTarget: (targetId: string) => void;
  clearStagedTarget: () => void;

  /** Pi-confirmed lock state */
  lockedTargetId: string | null;
  targetLockState: TargetLockState;
  lockTarget: (targetId: string) => Promise<boolean>;
  clearTargetLock: () => void;

  // Commands
  requestFollow: () => Promise<boolean>;
  requestInteract: () => Promise<boolean>;
  requestStop: () => Promise<boolean>;

  // Camera lifecycle control — enables fast target polling
  setCameraActive: (active: boolean) => void;
  isCameraActive: boolean;
}

const ELOContext = createContext<ELOContextType | undefined>(undefined);

export const ELOProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseUrl, setBaseUrlState] = useState<string>(DEFAULT_ELO_CORE_URL);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Connection health
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [lastSuccessfulPoll, setLastSuccessfulPoll] = useState<Date | null>(null);

  // Robot live state
  const [robotMode, setRobotMode] = useState<RobotMode>('stopped');
  const [modeUpdatedAt, setModeUpdatedAt] = useState<string | null>(null);
  const [isModeChanging, setIsModeChanging] = useState<boolean>(false);

  // Phase C: ELO Core states
  const [eloOnline, setEloOnline] = useState<boolean>(false);
  const [eloState, setEloState] = useState<RobotMode>('stopped');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [targets, setTargets] = useState<EloTarget[]>([]);
  const [obstacleDetected, setObstacleDetected] = useState<boolean>(false);
  const [obstacleDetail, setObstacleDetail] = useState<string | null>(null);
  const [safetyLocked, setSafetyLocked] = useState<boolean>(false);
  const [aiConnected, setAiConnected] = useState<boolean>(false);
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [displayConnected, setDisplayConnected] = useState<boolean>(false);
  const [commandPending, setCommandPending] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  // Privacy states
  const [excludeFromReport, setExcludeFromReportState] = useState<boolean>(false);
  const [isMuted, setIsMutedState] = useState<boolean>(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState<boolean>(false);
  const [isTogglingMute, setIsTogglingMute] = useState<boolean>(false);

  // Session & restrictions
  const [currentSession, setCurrentSession] = useState<SessionCurrentResponse | null>(null);
  const [dailyLimitMinutes, setDailyLimitMinutesState] = useState<number>(45);

  // Phase D: Target lock flow
  const [stagedTargetId, setStagedTargetId] = useState<string | null>(null);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [targetLockState, setTargetLockState] = useState<TargetLockState>('none');

  // Active target continuity refs
  const stagedTargetIdRef = useRef<string | null>(null);
  const lockedTargetIdRef = useRef<string | null>(null);
  const cachedSelectedTargetRef = useRef<EloTarget | null>(null);
  const lastSeenTimestampRef = useRef<number | null>(null);
  const targetsRef = useRef<EloTarget[]>([]);

  // Phase D: Camera lifecycle
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetPollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingBusyRef = useRef<boolean>(false);
  const isTargetPollingBusyRef = useRef<boolean>(false);

  // Sync refs with state
  useEffect(() => {
    stagedTargetIdRef.current = stagedTargetId;
  }, [stagedTargetId]);

  useEffect(() => {
    lockedTargetIdRef.current = lockedTargetId;
  }, [lockedTargetId]);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  // 1. Load saved Base URL on startup with migration from legacy storage
  useEffect(() => {
    async function loadSavedUrl() {
      try {
        let saved = await AsyncStorage.getItem(STORAGE_KEY_BASE_URL);
        if (!saved) {
          const oldSaved = await AsyncStorage.getItem('@elo_backend_base_url');
          if (oldSaved && !oldSaved.includes('localhost:8000')) {
            saved = oldSaved;
          }
        }
        if (saved && !saved.includes('localhost:8000')) {
          setBaseUrlState(normalizeBaseUrl(saved));
        } else if (process.env.EXPO_PUBLIC_ELO_CORE_URL) {
          setBaseUrlState(normalizeBaseUrl(process.env.EXPO_PUBLIC_ELO_CORE_URL));
        } else {
          setBaseUrlState(DEFAULT_ELO_CORE_URL);
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
    setConsecutiveFailures(0);
  }, []);

  // 3. Poll robot state from Raspberry Pi ELO Core (GET /status)
  const performPoll = useCallback(async () => {
    if (isPollingBusyRef.current) return;
    isPollingBusyRef.current = true;

    try {
      const eloStatus = await api.getEloStatus(baseUrl);

      setEloOnline(eloStatus.online);
      setEloState(eloStatus.state);
      setRobotMode(eloStatus.state);

      // Normalize server target_id
      const serverTargetId = eloStatus.target_id == null ? null : String(eloStatus.target_id);
      if (serverTargetId) {
        setSelectedTargetId(serverTargetId);
        setLockedTargetId(serverTargetId);
        setStagedTargetId(serverTargetId);
        setTargetLockState('locked');
      }
      // Never do: if (!targets.includes(status.target_id)) setSelectedTarget(null)

      setObstacleDetected(eloStatus.obstacle);
      setSafetyLocked(eloStatus.safety_locked ?? false);
      setObstacleDetail(eloStatus.obstacle_detail || null);
      setAiConnected(eloStatus.ai_connected);
      setAudioReady(eloStatus.audio_ready);
      setAudioStatus((eloStatus as any).audio_status ?? null);
      setDisplayConnected(eloStatus.display_connected ?? false);
      setModeUpdatedAt(eloStatus.last_updated);

      const pollEnd = Date.now();
      // Store ping (rough — includes processing, but useful for diagnostics)
      setPingMs(null); // Will be set via testConnectionUrl result

      setIsConnected(true);
      setConsecutiveFailures(0);
      setLastSuccessfulPoll(new Date());

      // Optional session info
      try {
        const sessionData = await api.getCurrentSession(baseUrl);
        if (sessionData) {
          setCurrentSession(sessionData);
          if (sessionData.dailyLimitMinutes) {
            setDailyLimitMinutesState(sessionData.dailyLimitMinutes);
          }
        }
      } catch {
        // Graceful ignore
      }
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

  // 4. Separate fast target poll (used when camera view is active)
  const performTargetPoll = useCallback(async () => {
    if (isTargetPollingBusyRef.current) return;
    isTargetPollingBusyRef.current = true;
    try {
      const targetsList = await api.getTargets(baseUrl);

      // Normalize all target IDs immediately
      const normalizedTargets = targetsList.map((t) => ({
        ...t,
        id: String(t.id),
      }));

      if (__DEV__) {
        console.log(`[ELO-TARGET] targets count: ${normalizedTargets.length}`);
      }

      const activeId = lockedTargetIdRef.current || stagedTargetIdRef.current;

      if (activeId) {
        const found = normalizedTargets.find((t) => String(t.id) === String(activeId));

        if (found) {
          lastSeenTimestampRef.current = Date.now();
          cachedSelectedTargetRef.current = found;

          // Reacquired — transition back to tracked/locked
          setTargetLockState((prev) => {
            if (prev === 'lost' || prev === 'reacquiring') {
              return lockedTargetIdRef.current ? 'locked' : 'staged';
            }
            return prev;
          });
        } else {
          // Target temporarily absent from vision frame — maintain grace window (~1.5–2.0s)
          const now = Date.now();
          const lastSeen = lastSeenTimestampRef.current || now;
          const elapsed = now - lastSeen;

          if (elapsed < 2000) {
            setTargetLockState('reacquiring');
          } else {
            setTargetLockState('lost');
          }

          // Preserve last known target in list for UI continuity (marked as reacquiring)
          if (cachedSelectedTargetRef.current) {
            const preserved: EloTarget = {
              ...cachedSelectedTargetRef.current,
              tracking_state: 'reacquiring',
            };
            normalizedTargets.push(preserved);
          }
        }
      }

      setTargets(normalizedTargets);
    } catch {
      // Non-critical network jitter
    } finally {
      isTargetPollingBusyRef.current = false;
    }
  }, [baseUrl]);

  // Setup periodic status polling (1500ms)
  useEffect(() => {
    performPoll();

    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    pollingTimerRef.current = setInterval(performPoll, POLLING_INTERVAL_MS);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [performPoll]);

  // Setup fast target polling (400ms) — only when camera is active
  useEffect(() => {
    if (targetPollingTimerRef.current) {
      clearInterval(targetPollingTimerRef.current);
      targetPollingTimerRef.current = null;
    }

    if (isCameraActive) {
      performTargetPoll(); // immediate
      targetPollingTimerRef.current = setInterval(performTargetPoll, TARGET_POLLING_FAST_MS);
    }

    return () => {
      if (targetPollingTimerRef.current) {
        clearInterval(targetPollingTimerRef.current);
        targetPollingTimerRef.current = null;
      }
    };
  }, [isCameraActive, performTargetPoll]);

  // 5. Retry connection manual trigger
  const retryConnection = useCallback(async () => {
    setConsecutiveFailures(0);
    await performPoll();
  }, [performPoll]);

  // 6. Toggle Robot Mode ('moving' <-> 'interacting')
  const toggleRobotMode = useCallback(async () => {
    if (isModeChanging) return;
    const targetMode: RobotMode = robotMode === 'moving' ? 'interacting' : 'moving';
    setIsModeChanging(true);

    try {
      const piMode = targetMode === 'moving' ? 'FOLLOW' : 'INTERACT';
      const response = await api.setEloMode(baseUrl, piMode);
      if (response && response.success) {
        const nextMode = response.state || targetMode;
        setRobotMode(nextMode);
        setEloState(nextMode);
        setModeUpdatedAt(new Date().toISOString());
        setIsConnected(true);
        setConsecutiveFailures(0);
      }
    } catch (error: any) {
      console.warn('Mode switch command failed:', error.message);
      setConsecutiveFailures((prev) => prev + 1);
      throw error;
    } finally {
      setIsModeChanging(false);
    }
  }, [baseUrl, robotMode, isModeChanging]);

  // 7. Privacy: Exclude current session from report
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

  // 8. Privacy: Mute microphone
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

  // 9. Restrictions: Fetch and update
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

  // 10. Test connection URL
  const testConnectionUrl = useCallback(
    async (targetUrl: string): Promise<{ success: boolean; latencyMs?: number; error?: string }> => {
      const start = Date.now();
      try {
        await api.checkHealth(targetUrl);
        const latency = Date.now() - start;
        return { success: true, latencyMs: latency };
      } catch (err: any) {
        return { success: false, error: err.message || 'Cannot reach Raspberry Pi Core' };
      }
    },
    []
  );

  // ─── Phase C: Command Methods ───

  const clearCommandError = useCallback(() => {
    setCommandError(null);
  }, []);

  // Legacy: direct target select without staged/lock flow
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
          const errMsg = typeof res.error === 'string' ? res.error : 'Target selection rejected by robot';
          setCommandError(errMsg);
          return false;
        }
      } catch (err: any) {
        setCommandError(err.message || 'Failed to select target on Raspberry Pi');
        return false;
      } finally {
        setCommandPending(null);
      }
    },
    [baseUrl]
  );

  // ─── Phase D: Target Lock Flow ───

  /** Stage a target locally — normalized ID, preserves last known target */
  const stageTarget = useCallback((targetId: string) => {
    const normalizedId = String(targetId);
    if (__DEV__) {
      console.log(`[ELO-TARGET] selected id: ${normalizedId}`);
    }
    setStagedTargetId(normalizedId);
    stagedTargetIdRef.current = normalizedId;
    setSelectedTargetId(normalizedId);
    setTargetLockState('staged');
    lastSeenTimestampRef.current = Date.now();

    const found = targetsRef.current.find((t) => String(t.id) === normalizedId);
    if (found) {
      cachedSelectedTargetRef.current = found;
    }
    setCommandError(null);
  }, []);

  const clearStagedTarget = useCallback(() => {
    setStagedTargetId(null);
    stagedTargetIdRef.current = null;
    if (targetLockState === 'staged') {
      setTargetLockState('none');
    }
  }, [targetLockState]);

  /** Lock a target — calls POST /target, on success authoritative confirmation */
  const lockTarget = useCallback(
    async (targetId: string): Promise<boolean> => {
      const normalizedId = String(targetId);
      setTargetLockState('locking');
      setCommandError(null);
      try {
        const res = await api.selectTarget(baseUrl, normalizedId);
        if (res.success) {
          const confirmedId = String(res.target_id ?? normalizedId);
          if (__DEV__) {
            console.log(`[ELO-TARGET] lock success: ${confirmedId}`);
          }
          setLockedTargetId(confirmedId);
          lockedTargetIdRef.current = confirmedId;
          setSelectedTargetId(confirmedId);
          setStagedTargetId(confirmedId);
          stagedTargetIdRef.current = confirmedId;
          setTargetLockState('locked');
          lastSeenTimestampRef.current = Date.now();
          return true;
        } else {
          if (__DEV__) {
            console.warn('[ELO-TARGET] lock failure', res.error);
          }
          const errMsg = typeof res.error === 'string' ? res.error : 'Target lock rejected by robot';
          setCommandError(errMsg);
          setTargetLockState('staged');
          return false;
        }
      } catch (err: any) {
        if (__DEV__) {
          console.warn('[ELO-TARGET] lock failure', err.message);
        }
        setCommandError(err.message || 'Failed to lock target on Raspberry Pi');
        setTargetLockState('staged');
        return false;
      }
    },
    [baseUrl]
  );

  const clearTargetLock = useCallback(() => {
    setLockedTargetId(null);
    lockedTargetIdRef.current = null;
    setStagedTargetId(null);
    stagedTargetIdRef.current = null;
    setSelectedTargetId(null);
    cachedSelectedTargetRef.current = null;
    lastSeenTimestampRef.current = null;
    setTargetLockState('none');
    setCommandError(null);
  }, []);

  const requestFollow = useCallback(async (): Promise<boolean> => {
    if (targetLockState !== 'locked') {
      setCommandError('Select and lock a target first.');
      return false;
    }
    setCommandPending('Requesting Follow...');
    setCommandError(null);
    try {
      const res = await api.setEloMode(baseUrl, 'FOLLOW');
      if (res.success) {
        const state = res.state || 'moving';
        setEloState(state);
        setRobotMode(state);
        return true;
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : 'Follow command rejected by robot';
        setCommandError(errMsg);
        return false;
      }
    } catch (err: any) {
      setCommandError(err.message || 'Failed to send Follow command to Raspberry Pi');
      return false;
    } finally {
      setCommandPending(null);
    }
  }, [baseUrl, targetLockState]);

  const requestInteract = useCallback(async (): Promise<boolean> => {
    setCommandPending('Requesting Interact...');
    setCommandError(null);
    try {
      // Attempt POST /interaction/start as defined by Pi Core contract
      let res: any;
      try {
        res = await api.startInteraction(baseUrl);
      } catch {
        res = await api.setEloMode(baseUrl, 'INTERACT');
      }
      if (res && res.success !== false) {
        const state = res.state || 'interacting';
        setEloState(state);
        setRobotMode(state);
        return true;
      } else {
        const errMsg = typeof res?.error === 'string' ? res.error : 'Interact command rejected by robot';
        setCommandError(errMsg);
        return false;
      }
    } catch (err: any) {
      setCommandError(err.message || 'Failed to send Interact command to Raspberry Pi');
      return false;
    } finally {
      setCommandPending(null);
    }
  }, [baseUrl]);

  const requestStop = useCallback(async (): Promise<boolean> => {
    setCommandPending('Stopping...');
    setCommandError(null);
    try {
      api.endInteraction(baseUrl).catch(() => {});
      const res = await api.emergencyStop(baseUrl);
      if (res.success) {
        const state = res.state || 'stopped';
        setEloState(state);
        setRobotMode(state);
        return true;
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : 'Stop command rejected by robot';
        setCommandError(errMsg);
        return false;
      }
    } catch (err: any) {
      // Even if the network fails, reflect stopped state locally
      setEloState('stopped');
      setRobotMode('stopped');
      setCommandError(err.message || 'Stop command failed — ELO may already be stopped');
      return false;
    } finally {
      setCommandPending(null);
    }
  }, [baseUrl]);

  const setCameraActive = useCallback((active: boolean) => {
    setIsCameraActive(active);
  }, []);

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
        sessionElapsedMinutes: currentSession?.elapsedMinutes ?? null,
        audioStatus,
        pingMs,
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
        safetyLocked,
        aiConnected,
        audioReady,
        displayConnected,
        commandPending,
        commandError,
        clearCommandError,
        selectTarget,
        // Phase D
        stagedTargetId,
        stageTarget,
        clearStagedTarget,
        lockedTargetId,
        targetLockState,
        lockTarget,
        clearTargetLock,
        requestFollow,
        requestInteract,
        requestStop,
        setCameraActive,
        isCameraActive,
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
