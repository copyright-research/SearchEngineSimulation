'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';

interface UseRRWebRecorderOptions {
  enabled: boolean;
  recordingId?: string;
  uploadInterval?: number; // 上传间隔（毫秒），默认 30 秒
  uploadBatchSize?: number; // 批量上传事件数量，默认 100
}

export function useRRWebRecorder({ 
  enabled, 
  recordingId,
  uploadInterval = 30000, // 30 秒
  uploadBatchSize = 100, // 100 个事件
}: UseRRWebRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0); // 已上传事件数
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
  const stopFnRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<eventWithTime[]>([]); // 所有事件
  const lastUploadedIndexRef = useRef(0); // 上次上传到的索引
  const chunkIndexRef = useRef(0); // 当前 chunk 索引
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null); // 定时器
  const sessionIdRef = useRef<string>(''); // 唯一的 session ID

  // 上传增量事件（使用 ref 来避免重复调用）
  const uploadingRef = useRef(false); // 防止并发上传
  
  const uploadChunk = useCallback(async (force = false) => {
    if (!recordingId || !sessionIdRef.current) return;
    
    // 防止并发上传
    if (uploadingRef.current) {
      console.log('[rrweb] Upload already in progress, skipping...');
      return;
    }

    const totalEvents = eventsRef.current.length;
    const lastUploadedIndex = lastUploadedIndexRef.current;
    const newEventsCount = totalEvents - lastUploadedIndex;

    // 检查是否需要上传
    if (!force && newEventsCount < uploadBatchSize) {
      return; // 新事件不足，跳过上传
    }

    if (newEventsCount === 0) {
      return; // 没有新事件
    }

    try {
      uploadingRef.current = true; // 标记正在上传
      setUploadStatus('uploading');

      // 获取新增的事件
      const newEvents = eventsRef.current.slice(lastUploadedIndex);

      console.log(`[rrweb] Uploading chunk ${chunkIndexRef.current} for session ${sessionIdRef.current}: ${newEvents.length} events`);

      const response = await fetch('/api/rrweb/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId,
          sessionId: sessionIdRef.current, // 传递唯一的 sessionId
          events: newEvents,
          chunkIndex: chunkIndexRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[rrweb] Chunk uploaded successfully:`, result);

      // 更新状态
      lastUploadedIndexRef.current = totalEvents;
      chunkIndexRef.current += 1;
      setUploadedCount(totalEvents);
      setUploadStatus('success');

    } catch (error) {
      console.error('[rrweb] Upload error:', error);
      setUploadStatus('error');
      // 不更新 lastUploadedIndex，下次会重试
    } finally {
      uploadingRef.current = false; // 释放锁
    }
  }, [recordingId, uploadBatchSize]);

  // 录制逻辑
  useEffect(() => {
    if (!enabled || !recordingId) {
      return;
    }

    // 生成唯一的 session ID
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionIdRef.current = sessionId;

    console.log(`[rrweb] Starting recording for RID: ${recordingId}, Session: ${sessionId}`);
    
    // 重置状态
    eventsRef.current = [];
    lastUploadedIndexRef.current = 0;
    chunkIndexRef.current = 0;
    setEventsCount(0);
    setUploadedCount(0);
    setUploadStatus('idle');
    
    // 开始录制
    const stopFn = record({
      emit(event) {
        eventsRef.current.push(event);
        
        // 每 10 个事件更新一次 UI
        if (eventsRef.current.length % 10 === 0) {
          setEventsCount(eventsRef.current.length);
        }

        // 检查是否达到批量上传阈值
        const newEventsCount = eventsRef.current.length - lastUploadedIndexRef.current;
        if (newEventsCount >= uploadBatchSize) {
          uploadChunk();
        }
      },
      checkoutEveryNms: 30 * 1000,
      checkoutEveryNth: 200,
    });

    if (stopFn) {
      stopFnRef.current = stopFn;
      setIsRecording(true);
    }

    // 设置定时上传
    uploadIntervalRef.current = setInterval(() => {
      uploadChunk();
    }, uploadInterval);

    // 页面卸载前上传剩余事件
    const handleBeforeUnload = () => {
      // 使用 sendBeacon 或 同步请求（beforeunload 时异步请求可能被取消）
      const remainingEvents = eventsRef.current.slice(lastUploadedIndexRef.current);
      if (remainingEvents.length > 0) {
        // 使用 keepalive 确保请求完成
        navigator.sendBeacon(
          '/api/rrweb/upload',
          new Blob([JSON.stringify({
            recordingId,
            sessionId: sessionIdRef.current,
            events: remainingEvents,
            chunkIndex: chunkIndexRef.current,
          })], { type: 'application/json' })
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('[rrweb] Stopping recording');
      
      // 停止录制
      if (stopFnRef.current) {
        stopFnRef.current();
        stopFnRef.current = null;
      }

      // 清除定时器
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }

      // 移除事件监听
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // 上传最后的事件（只在正常停止时，不在页面卸载时）
      if (eventsRef.current.length > lastUploadedIndexRef.current) {
        uploadChunk(true);
      }

      setIsRecording(false);
    };
  }, [enabled, recordingId, uploadInterval, uploadBatchSize, uploadChunk]);

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

  // 手动触发上传
  const manualUpload = () => {
    uploadChunk(true);
  };

  return {
    isRecording,
    eventsCount,
    uploadedCount,
    uploadStatus,
    downloadRecording,
    clearRecording,
    manualUpload,
  };
}
