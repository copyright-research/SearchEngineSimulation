'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';

interface UseRRWebRecorderOptions {
  enabled: boolean;
  recordingId?: string;
  uploadInterval?: number; // 定时上传间隔（毫秒），默认 30 秒
  debounceMs?: number; // 防抖延迟（毫秒），默认 2 秒
}

export function useRRWebRecorder({ 
  enabled, 
  recordingId,
  uploadInterval = 30000, // 30 秒
  debounceMs = 3000, // 3 秒防抖
}: UseRRWebRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0); // 已上传事件数
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
  const stopFnRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<eventWithTime[]>([]); // 所有事件
  const lastUploadedIndexRef = useRef(0); // 上次上传到的索引
  const chunkIndexRef = useRef(0); // 当前 chunk 索引
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null); // 定时上传定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null); // 防抖定时器
  const sessionIdRef = useRef<string>(''); // 唯一的 session ID

  // 上传增量事件
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

    // 如果没有新事件或者新事件数为 0，跳过
    if (newEventsCount <= 0) {
      console.log('[rrweb] No new events to upload, skipping...');
      return;
    }

    try {
      uploadingRef.current = true; // 标记正在上传
      setUploadStatus('uploading');

      // 获取新增的事件
      const newEvents = eventsRef.current.slice(lastUploadedIndex);

      // 二次检查：确保新事件数组不为空
      if (!Array.isArray(newEvents) || newEvents.length === 0) {
        console.warn('[rrweb] New events array is empty, aborting upload');
        return;
      }

      console.log(`[rrweb] Uploading chunk ${chunkIndexRef.current} for session ${sessionIdRef.current}: ${newEvents.length} events (force: ${force})`);

      const response = await fetch('/api/rrweb/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId,
          sessionId: sessionIdRef.current,
          events: newEvents,
          chunkIndex: chunkIndexRef.current,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Upload failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
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
  }, [recordingId]);

  // 防抖上传：每次有新事件时触发，但会等待一段时间没有新事件后才真正上传
  const debouncedUpload = useCallback(() => {
    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      uploadChunk(false);
    }, debounceMs);
  }, [uploadChunk, debounceMs]);

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
    
    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      // 记录页面可见性变化事件（作为自定义事件）
      eventsRef.current.push({
        type: 6, // Plugin 事件
        data: {
          plugin: 'page-visibility',
          payload: {
            type: 'visibilitychange',
            hidden: isHidden,
          },
        },
        timestamp: Date.now(),
      } as eventWithTime);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 开始录制
    const stopFn = record({
      emit(event) {
        eventsRef.current.push(event);
        
        // 每 10 个事件更新一次 UI
        if (eventsRef.current.length % 10 === 0) {
          setEventsCount(eventsRef.current.length);
        }

        // 每次有新事件时触发防抖上传
        debouncedUpload();
      },
      checkoutEveryNms: 30 * 1000,
      checkoutEveryNth: 200,
      // 阻止录制带有 rr-block 类的元素（如录屏监控 UI 本身）
      blockClass: 'rr-block',
      // 可选：阻止录制输入框的内容（保护隐私）
      // maskTextClass: 'rr-mask',
      // maskAllInputs: true,
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

      // 清除防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // 移除事件监听
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // 上传最后的事件（只在正常停止时，不在页面卸载时）
      if (eventsRef.current.length > lastUploadedIndexRef.current) {
        uploadChunk(true);
      }

      setIsRecording(false);
    };
  }, [enabled, recordingId, uploadInterval, uploadChunk, debouncedUpload]);

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
