import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';
import { CameraConnectionState } from '../types';

const FRAME_INTERVAL_MS = 100; // ~10 FPS
const ERROR_RETRY_INTERVAL_MS = 350; // ~350ms on error
const WATCHDOG_TIMEOUT_MS = 2500; // safety fallback if image never fires onLoad/onError

export interface UseCameraStreamResult {
  cameraState: CameraConnectionState;
  frameUrl: string | null;
  lastGoodFrameUrl: string | null;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  onFrameLoaded: () => void;
  onFrameError: (error: any) => void;
  retry: () => void;
}

/**
 * Sequential, non-overlapping frame-polling camera hook for React Native.
 * Canonical transport: GET /camera/frame?ts={cacheBust}
 *
 * Enforces:
 * 1. Sequential requests (request frame -> load/error -> wait 100ms -> next request)
 * 2. Never clears the last good frame on transient failures
 * 3. LIVE state is only set AFTER the first frame actually renders
 * 4. Automatic suspension when isActive is false
 */
export function useCameraStream(
  baseUrl: string,
  isActive: boolean
): UseCameraStreamResult {
  const [cameraState, setCameraState] = useState<CameraConnectionState>('connecting');
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [lastGoodFrameUrl, setLastGoodFrameUrl] = useState<string | null>(null);
  const [frameWidth, setFrameWidth] = useState<number>(640);
  const [frameHeight, setFrameHeight] = useState<number>(480);
  const [fps, setFps] = useState<number>(0);

  const mountedRef = useRef(true);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  const isDownloadingRef = useRef(false);
  const nextFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFrameUrlRef = useRef<string | null>(null);

  // FPS calculation
  const frameTimestampsRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    if (nextFrameTimerRef.current) {
      clearTimeout(nextFrameTimerRef.current);
      nextFrameTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const requestNextFrame = useCallback(() => {
    if (!mountedRef.current || !activeRef.current) {
      isDownloadingRef.current = false;
      return;
    }

    clearTimers();
    isDownloadingRef.current = true;

    // Cache-busting URL
    const nextUrl = api.getCameraFrameUrl(baseUrl);
    currentFrameUrlRef.current = nextUrl;
    setFrameUrl(nextUrl);

    // Watchdog timer: in case native image decoder never triggers onLoad or onError
    watchdogTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || !activeRef.current) return;
      if (__DEV__) {
        console.warn('[ELO-CAMERA] watchdog timeout waiting for frame load');
      }
      setCameraState((prev) => (prev === 'live' ? 'degraded' : prev));
      isDownloadingRef.current = false;
      requestNextFrame();
    }, WATCHDOG_TIMEOUT_MS);
  }, [baseUrl, clearTimers]);

  const onFrameLoaded = useCallback(() => {
    if (!mountedRef.current) return;

    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }

    const now = Date.now();
    frameTimestampsRef.current.push(now);

    // Keep only timestamps from the last 2 seconds
    frameTimestampsRef.current = frameTimestampsRef.current.filter((t) => now - t <= 2000);
    const calculatedFps =
      frameTimestampsRef.current.length > 1
        ? Number(
            (
              (frameTimestampsRef.current.length - 1) /
              ((now - frameTimestampsRef.current[0]) / 1000)
            ).toFixed(1)
          )
        : 8.5;
    setFps(calculatedFps);

    if (__DEV__) {
      console.log('[ELO-CAMERA] frame loaded');
    }

    // Only set LIVE after a frame actually renders!
    setCameraState('live');
    if (currentFrameUrlRef.current) {
      setLastGoodFrameUrl(currentFrameUrlRef.current);
    }

    isDownloadingRef.current = false;

    // Wait ~100ms before requesting next frame (targets 8–10 FPS)
    if (activeRef.current) {
      nextFrameTimerRef.current = setTimeout(() => {
        requestNextFrame();
      }, FRAME_INTERVAL_MS);
    }
  }, [requestNextFrame]);

  const onFrameError = useCallback(
    (error: any) => {
      if (!mountedRef.current) return;

      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }

      if (__DEV__) {
        console.warn('[ELO-CAMERA] frame error', error);
      }

      // Mark degraded if previously live; keep last good frame in view
      setCameraState((prev) => (prev === 'live' ? 'degraded' : prev));
      isDownloadingRef.current = false;

      // Retry after backoff
      if (activeRef.current) {
        nextFrameTimerRef.current = setTimeout(() => {
          requestNextFrame();
        }, ERROR_RETRY_INTERVAL_MS);
      }
    },
    [requestNextFrame]
  );

  const initCamera = useCallback(async () => {
    if (!mountedRef.current || !activeRef.current) return;

    clearTimers();
    isDownloadingRef.current = false;
    setCameraState('connecting');

    try {
      const status = await api.getCameraStatus(baseUrl);
      if (!mountedRef.current || !activeRef.current) return;

      if (status.available) {
        setFrameWidth(status.width || 640);
        setFrameHeight(status.height || 480);
        // Start sequential frame polling
        requestNextFrame();
      } else {
        setCameraState('unavailable');
      }
    } catch {
      if (!mountedRef.current || !activeRef.current) return;
      try {
        await api.checkHealth(baseUrl);
        if (mountedRef.current && activeRef.current) {
          setCameraState('unavailable');
        }
      } catch {
        if (mountedRef.current && activeRef.current) {
          setCameraState('offline');
        }
      }
    }
  }, [baseUrl, clearTimers, requestNextFrame]);

  const retry = useCallback(() => {
    initCamera();
  }, [initCamera]);

  useEffect(() => {
    mountedRef.current = true;
    activeRef.current = isActive;

    if (isActive) {
      initCamera();
    } else {
      clearTimers();
      isDownloadingRef.current = false;
      setCameraState('connecting');
      setFrameUrl(null);
      setFps(0);
      frameTimestampsRef.current = [];
    }

    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [isActive, baseUrl, initCamera, clearTimers]);

  return {
    cameraState,
    frameUrl,
    lastGoodFrameUrl,
    frameWidth,
    frameHeight,
    fps,
    onFrameLoaded,
    onFrameError,
    retry,
  };
}
