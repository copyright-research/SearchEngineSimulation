'use client';

import { useRRWebRecorder } from '@/lib/use-rrweb-recorder';
import { useEffect, useState } from 'react';

export function RRWebRecorder() {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  // 从 URL 参数中获取 RID
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const rid = params.get('RID');

    if (rid) {
      setRecordingId(rid);
      setEnabled(true);
      console.log(`[rrweb] Recording enabled with RID: ${rid}`);
    }
  }, []);

  const { isRecording, eventsCount, downloadRecording, clearRecording } = useRRWebRecorder({
    enabled,
    recordingId: recordingId || undefined,
  });

  // 如果没有启用录制，不显示任何 UI
  if (!enabled || !recordingId) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <div className="bg-gray-900/95 backdrop-blur-sm text-white rounded-lg shadow-2xl border border-gray-700 p-3 min-w-[200px]">
        {/* 状态指示器 */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs font-medium">
            {isRecording ? 'Recording' : 'Stopped'}
          </span>
        </div>

        {/* 录制信息 */}
        <div className="text-[10px] text-gray-400 space-y-0.5 mb-3">
          <div>RID: {recordingId}</div>
          <div>Events: {eventsCount.toLocaleString()}</div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={downloadRecording}
            disabled={eventsCount === 0}
            className="w-full px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>

          <button
            onClick={clearRecording}
            disabled={eventsCount === 0}
            className="w-full px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

