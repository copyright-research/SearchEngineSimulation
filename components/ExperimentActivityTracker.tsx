'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getParamCaseInsensitive } from '@/lib/url-utils';
import { clampNonNegativeInt } from '@/lib/experiment-qualification';

const TRACKABLE_PATHS = new Set(['/', '/ai', '/verify']);
const HEARTBEAT_INTERVAL_MS = 5_000;
const MEANINGFUL_MOUSEMOVE_DISTANCE_PX = 20;
const MEANINGFUL_MOUSEMOVE_INTERVAL_MS = 400;

interface StoredSnapshot {
  clientSessionId: string;
  visibleTimeMs: number;
  clickCount: number;
  scrollCount: number;
  mousemoveCount: number;
}

function getSnapshotStorageKey(rid: string) {
  return `experiment-activity:${rid}:snapshot`;
}

function loadSnapshot(rid: string): StoredSnapshot {
  const fallback: StoredSnapshot = {
    clientSessionId: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    visibleTimeMs: 0,
    clickCount: 0,
    scrollCount: 0,
    mousemoveCount: 0,
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.sessionStorage.getItem(getSnapshotStorageKey(rid));
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (!parsed.clientSessionId || typeof parsed.clientSessionId !== 'string') {
      return fallback;
    }

    return {
      clientSessionId: parsed.clientSessionId,
      visibleTimeMs: clampNonNegativeInt(parsed.visibleTimeMs),
      clickCount: clampNonNegativeInt(parsed.clickCount),
      scrollCount: clampNonNegativeInt(parsed.scrollCount),
      mousemoveCount: clampNonNegativeInt(parsed.mousemoveCount),
    };
  } catch {
    return fallback;
  }
}

function saveSnapshot(rid: string, snapshot: StoredSnapshot) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      getSnapshotStorageKey(rid),
      JSON.stringify(snapshot)
    );
  } catch {
    // Ignore storage failures; the server copy is still authoritative.
  }
}

export function ExperimentActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rid = getParamCaseInsensitive(searchParams, 'rid');
  const shouldTrack = Boolean(rid && pathname && TRACKABLE_PATHS.has(pathname));

  const ridRef = useRef<string | null>(null);
  const pagePathRef = useRef<string>('/');
  const clientSessionIdRef = useRef<string | null>(null);
  const visibleTimeMsRef = useRef(0);
  const clickCountRef = useRef(0);
  const scrollCountRef = useRef(0);
  const mousemoveCountRef = useRef(0);
  const lastVisibleAtRef = useRef<number | null>(null);
  const lastMousePointRef = useRef<{ x: number; y: number } | null>(null);
  const lastMeaningfulMousemoveAtRef = useRef<number>(0);

  useEffect(() => {
    if (!shouldTrack || !rid || !pathname) {
      ridRef.current = null;
      clientSessionIdRef.current = null;
      return;
    }

    const stored = loadSnapshot(rid);
    ridRef.current = rid;
    pagePathRef.current = pathname;
    clientSessionIdRef.current = stored.clientSessionId;
    visibleTimeMsRef.current = stored.visibleTimeMs;
    clickCountRef.current = stored.clickCount;
    scrollCountRef.current = stored.scrollCount;
    mousemoveCountRef.current = stored.mousemoveCount;
    lastMousePointRef.current = null;
    lastMeaningfulMousemoveAtRef.current = 0;
    lastVisibleAtRef.current = document.hidden ? null : Date.now();

    const buildSnapshot = () => ({
      clientSessionId: clientSessionIdRef.current || stored.clientSessionId,
      visibleTimeMs: visibleTimeMsRef.current,
      clickCount: clickCountRef.current,
      scrollCount: scrollCountRef.current,
      mousemoveCount: mousemoveCountRef.current,
    });

    const persistSnapshot = () => {
      if (!ridRef.current) return;
      saveSnapshot(ridRef.current, buildSnapshot());
    };

    const accumulateVisibleTime = () => {
      if (document.hidden) {
        lastVisibleAtRef.current = null;
        return;
      }

      const now = Date.now();
      if (lastVisibleAtRef.current !== null) {
        visibleTimeMsRef.current += now - lastVisibleAtRef.current;
      }
      lastVisibleAtRef.current = now;
    };

    const postSnapshot = async (useBeacon: boolean) => {
      if (!ridRef.current || !clientSessionIdRef.current) return;

      accumulateVisibleTime();
      persistSnapshot();

      const payload = JSON.stringify({
        rid: ridRef.current,
        clientSessionId: clientSessionIdRef.current,
        pagePath: pagePathRef.current,
        visibleTimeMs: visibleTimeMsRef.current,
        clickCount: clickCountRef.current,
        scrollCount: scrollCountRef.current,
        mousemoveCount: mousemoveCountRef.current,
        lastSeenAt: new Date().toISOString(),
      });

      if (useBeacon && typeof navigator.sendBeacon === 'function') {
        const sent = navigator.sendBeacon(
          '/api/experiment/activity',
          new Blob([payload], { type: 'application/json' })
        );

        if (sent) {
          return;
        }
      }

      try {
        await fetch('/api/experiment/activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
          keepalive: useBeacon,
        });
      } catch (error) {
        console.error('[experiment] Failed to send activity snapshot:', error);
      }
    };

    const handleClick = () => {
      clickCountRef.current += 1;
    };

    const handleScroll = () => {
      scrollCountRef.current += 1;
    };

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now();
      const prev = lastMousePointRef.current;
      lastMousePointRef.current = { x: event.clientX, y: event.clientY };

      if (!prev) return;

      const distance = Math.hypot(event.clientX - prev.x, event.clientY - prev.y);
      if (distance < MEANINGFUL_MOUSEMOVE_DISTANCE_PX) return;
      if (now - lastMeaningfulMousemoveAtRef.current < MEANINGFUL_MOUSEMOVE_INTERVAL_MS) return;

      mousemoveCountRef.current += 1;
      lastMeaningfulMousemoveAtRef.current = now;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void postSnapshot(true);
        return;
      }

      lastVisibleAtRef.current = Date.now();
    };

    const handlePageHide = () => {
      void postSnapshot(true);
    };

    const heartbeatId = window.setInterval(() => {
      void postSnapshot(false);
    }, HEARTBEAT_INTERVAL_MS);

    document.addEventListener('click', handleClick, true);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      void postSnapshot(true);
      window.clearInterval(heartbeatId);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [pathname, rid, shouldTrack]);

  return null;
}
