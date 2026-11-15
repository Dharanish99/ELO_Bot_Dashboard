import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { v2ws } from '../api/v2ws';
import { useELO } from './ELOContext';
import {
  V2StateMessage,
  V2CommandResult,
  DisplayedFrame,
  V2Target,
} from '../types/v2';

const FRAME_STALE_MS = 3000;
const RENDER_THROTTLE_MS = 125; // ~8 fps

export interface V2ContextType {
  isWsConnected: boolean;
  latestState: V2StateMessage | null;
  displayedFrame: DisplayedFrame | null;
  isFrameStale: boolean;
  selectionPendingId: string | null; // optimistic track_id while awaiting Pi
  commandPending: string | null;
  commandError: string | null;
  clearCommandError: () => void;
  selectByPoint: (x: number, y: number, frameTimestamp: number) => Promise<boolean>;
  sendFollow: () => boolean;
  sendStop: () => boolean;
  sendInteract: () => boolean;
  activateControl: () => void;
  deactivateControl: () => void;
}

const V2Context = createContext<V2ContextType | undefined>(undefined);

export const V2Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { baseUrl } = useELO();

  const [isWsConnected, setIsWsConnected] = useState(false);
  const [latestState, setLatestState] = useState<V2StateMessage | null>(null);
  const [displayedFrame, setDisplayedFrame] = useState<DisplayedFrame | null>(null);
  const [isFrameStale, setIsFrameStale] = useState(false);
  const [selectionPendingId, setSelectionPendingId] = useState<string | null>(null);
  const [commandPending, setCommandPending] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  // Refs for non-render-triggering storage
  const latestFrameRef = useRef<DisplayedFrame | null>(null);
  const frameRenderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingResultRef = useRef<((result: V2CommandResult) => void) | null>(null);
  const isControlActiveRef = useRef<boolean>(false);

  // Connect / reconnect reactively when baseUrl changes
  useEffect(() => {
    if (baseUrl) {
      v2ws.connect(baseUrl);
    }
  }, [baseUrl]);

  // AppState listener for background / foreground lifecycle
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        v2ws.deactivateControl();
      } else if (nextAppState === 'active' && isControlActiveRef.current) {
        v2ws.activateControl();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Frame throttling and staleness detection
  useEffect(() => {
    // Throttled frame render timer — max 8 fps
    frameRenderTimerRef.current = setInterval(() => {
      const f = latestFrameRef.current;
      if (f) {
        setDisplayedFrame(f);
      }
    }, RENDER_THROTTLE_MS);

    // Stale frame detector
    staleTimerRef.current = setInterval(() => {
      const f = latestFrameRef.current;
      if (f) {
        setIsFrameStale(Date.now() - f.capturedAt > FRAME_STALE_MS);
      } else {
        setIsFrameStale(false);
      }
    }, 500);

    // Subscribe to WS events
    const unsub = v2ws.subscribe((event) => {
      if (event.kind === 'connected') {
        setIsWsConnected(true);
        setIsFrameStale(false);
      } else if (event.kind === 'disconnected' || event.kind === 'error') {
        setIsWsConnected(false);
        setIsFrameStale(true); // mark stale on disconnect
        setSelectionPendingId(null);
      } else if (event.kind === 'state') {
        const msg = event.message;
        setLatestState(msg);
        // Build DisplayedFrame if preview is present
        if (msg.preview_jpeg_b64 && msg.camera_preview?.frame_timestamp) {
          const frame: DisplayedFrame = {
            frameTimestamp: msg.camera_preview.frame_timestamp,
            jpegUri: `data:image/jpeg;base64,${msg.preview_jpeg_b64}`,
            targets: msg.targets,
            capturedAt: Date.now(),
          };
          latestFrameRef.current = frame;
        }
      } else if (event.kind === 'command_result') {
        const result = event.message as V2CommandResult;
        if (pendingResultRef.current) {
          pendingResultRef.current(result);
          pendingResultRef.current = null;
        }
        if (!result.success) {
          setCommandError(result.error || result.reason || 'Command rejected by Pi');
        }
      }
    });

    return () => {
      unsub();
      v2ws.disconnect();
      if (frameRenderTimerRef.current) clearInterval(frameRenderTimerRef.current);
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    };
  }, []);

  const clearCommandError = useCallback(() => setCommandError(null), []);

  const waitForCommandResult = (): Promise<V2CommandResult> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingResultRef.current = null;
        resolve({ type: 'command_result', success: false, error: 'Command timed out — Pi did not respond' });
      }, 5000);
      pendingResultRef.current = (result) => {
        clearTimeout(timer);
        resolve(result);
      };
    });

  const selectByPoint = useCallback(async (x: number, y: number, frameTimestamp: number): Promise<boolean> => {
    if (commandPending) return false;
    setCommandPending('Selecting...');
    setCommandError(null);

    // Optimistic: find target at that point from displayed frame
    // In case of overlapping boxes, choose the one with the nearest center
    const frame = latestFrameRef.current;
    let optimisticId: string | null = null;
    let minDistanceSq = Infinity;

    if (frame && frame.frameTimestamp === frameTimestamp) {
      for (const t of frame.targets) {
        const { x: bx, y: by, width: bw, height: bh } = t.bbox;
        const contains = x >= bx && x <= bx + bw && y >= by && y <= by + bh;
        const centerX = bx + bw / 2;
        const centerY = by + bh / 2;
        const distSq = (x - centerX) ** 2 + (y - centerY) ** 2;

        if (contains && distSq < minDistanceSq) {
          minDistanceSq = distSq;
          optimisticId = t.track_id;
        }
      }
      // If tap was just outside border (within tolerance), still pick closest
      if (!optimisticId) {
        for (const t of frame.targets) {
          const { x: bx, y: by, width: bw, height: bh } = t.bbox;
          const tol = 0.04;
          const withinTol = x >= bx - tol && x <= bx + bw + tol && y >= by - tol && y <= by + bh + tol;
          if (withinTol) {
            const centerX = bx + bw / 2;
            const centerY = by + bh / 2;
            const distSq = (x - centerX) ** 2 + (y - centerY) ** 2;
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              optimisticId = t.track_id;
            }
          }
        }
      }
    }

    if (optimisticId) setSelectionPendingId(optimisticId);

    const sent = v2ws.send({ type: 'select_target', x, y, frame_timestamp: frameTimestamp, tolerance: 0.04 });
    if (!sent) {
      setCommandPending(null);
      setCommandError('Not connected to Pi — check network');
      setSelectionPendingId(null);
      return false;
    }

    const result = await waitForCommandResult();
    setCommandPending(null);

    if (result.success) {
      // Pi will confirm selection via next state message's selection.target_id
      return true;
    } else {
      setSelectionPendingId(null);
      setCommandError(result.error || result.reason || 'Selection rejected by Pi — please tap again');
      return false;
    }
  }, [commandPending]);

  // Clear optimistic when Pi state confirms
  useEffect(() => {
    if (latestState && selectionPendingId) {
      if (latestState.selection.target_id === selectionPendingId) {
        setSelectionPendingId(null);
      }
    }
  }, [latestState, selectionPendingId]);

  const sendFollow = useCallback((): boolean => {
    const ok = v2ws.send({ type: 'follow' });
    if (!ok) setCommandError('Not connected to Pi');
    return ok;
  }, []);

  const sendStop = useCallback((): boolean => {
    const ok = v2ws.send({ type: 'stop' });
    if (!ok) setCommandError('Cannot reach Pi — STOP may not have been delivered');
    return ok;
  }, []);

  const sendInteract = useCallback((): boolean => {
    const ok = v2ws.send({ type: 'interact' });
    if (!ok) setCommandError('Not connected to Pi');
    return ok;
  }, []);

  const activateControl = useCallback(() => {
    isControlActiveRef.current = true;
    v2ws.activateControl();
  }, []);

  const deactivateControl = useCallback(() => {
    isControlActiveRef.current = false;
    v2ws.deactivateControl();
  }, []);

  return (
    <V2Context.Provider value={{
      isWsConnected,
      latestState,
      displayedFrame,
      isFrameStale,
      selectionPendingId,
      commandPending,
      commandError,
      clearCommandError,
      selectByPoint,
      sendFollow,
      sendStop,
      sendInteract,
      activateControl,
      deactivateControl,
    }}>
      {children}
    </V2Context.Provider>
  );
};

export const useV2 = (): V2ContextType => {
  const ctx = useContext(V2Context);
  if (!ctx) throw new Error('useV2 must be used within V2Provider');
  return ctx;
};
