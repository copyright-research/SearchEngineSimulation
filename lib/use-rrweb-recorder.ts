'use client';

import { useEffect, useRef, useState } from 'react';
import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';

interface UseRRWebRecorderOptions {
  enabled: boolean;
  recordingId?: string;
}

export function useRRWebRecorder({ enabled, recordingId }: UseRRWebRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);
  const stopFnRef = useRef<(() => void) | null>(null);
  // 使用 ref 存储事件，避免频繁重渲染
  const eventsRef = useRef<eventWithTime[]>([]);

  useEffect(() => {
    if (!enabled || !recordingId) {
      return;
    }

    console.log(`[rrweb] Starting recording for RID: ${recordingId}`);
    
    // 清空之前的事件
    eventsRef.current = [];
    setEventsCount(0);
    
    // 开始录制
    const stopFn = record({
      emit(event) {
        // 使用 ref 收集事件，避免触发重渲染
        eventsRef.current.push(event);
        // 每 10 个事件更新一次计数（降低更新频率）
        if (eventsRef.current.length % 10 === 0) {
          setEventsCount(eventsRef.current.length);
        }
      },
      // 可选配置
      checkoutEveryNms: 30 * 1000, // 每 30 秒创建一个完整快照
      checkoutEveryNth: 200, // 每 200 个事件创建一个完整快照
    });

    if (stopFn) {
      stopFnRef.current = stopFn;
      setIsRecording(true);
    }

    return () => {
      console.log('[rrweb] Stopping recording');
      if (stopFnRef.current) {
        stopFnRef.current();
        stopFnRef.current = null;
      }
      setIsRecording(false);
    };
  }, [enabled, recordingId]);

  // 下载录制数据
  const downloadRecording = () => {
    const currentEvents = eventsRef.current;
    if (currentEvents.length === 0) {
      console.warn('[rrweb] No events to download');
      return;
    }

    // 更新最终计数
    setEventsCount(currentEvents.length);

    const data = {
      recordingId,
      timestamp: new Date().toISOString(),
      events: currentEvents,
      metadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        screen: {
          width: window.screen.width,
          height: window.screen.height,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rrweb-recording-${recordingId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[rrweb] Downloaded ${currentEvents.length} events`);
  };

  // 清空录制数据
  const clearRecording = () => {
    eventsRef.current = [];
    setEventsCount(0);
  };

  return {
    isRecording,
    eventsCount,
    downloadRecording,
    clearRecording,
  };
}
