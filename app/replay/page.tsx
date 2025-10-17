'use client';

import { useState, useRef, useEffect } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import type { eventWithTime } from '@rrweb/types';
import Link from 'next/link';
import { RRWebAnalyzer } from '@/lib/rrweb-analyzer';

interface RecordingData {
  recordingId: string;
  timestamp: string;
  events: eventWithTime[];
  metadata?: {
    url: string;
    userAgent: string;
    screen: { width: number; height: number };
    viewport: { width: number; height: number };
  };
}

export default function ReplayPage() {
  const [recordingData, setRecordingData] = useState<RecordingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string>('');
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);

  // 加载录制文件
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as RecordingData;
        setRecordingData(data);
        setError(null);
        console.log(`[rrweb] Loaded ${data.events.length} events`);
      } catch (err) {
        setError('Failed to parse recording file');
        console.error('[rrweb] Parse error:', err);
      }
    };
    reader.readAsText(file);
  };

  // 初始化 rrweb-player (更好的 UI 和自动处理缩放)
  useEffect(() => {
    if (!recordingData || !playerContainerRef.current) return;

    // 清理旧的 player
    if (playerInstanceRef.current) {
      try {
        // rrweb-player 会自动清理
        playerContainerRef.current.innerHTML = '';
      } catch (err) {
        console.error('[rrweb] Cleanup error:', err);
      }
    }

    try {
      // 计算合适的播放器尺寸
      const viewport = recordingData.metadata?.viewport;
      let playerWidth = 1024;
      let playerHeight = 768;

      if (viewport) {
        // 使用录制时的视口比例
        const aspectRatio = viewport.width / viewport.height;
        playerWidth = Math.min(viewport.width, 1400); // 最大 1400px
        playerHeight = playerWidth / aspectRatio;
      }

      // 使用 rrweb-player 创建播放器
      const player = new rrwebPlayer({
        target: playerContainerRef.current,
        props: {
          events: recordingData.events,
          width: playerWidth,
          height: playerHeight,
          autoPlay: false,
          showController: true,
          speedOption: [0.5, 1, 2, 4, 8],
          // 传递给底层 Replayer 的选项
          skipInactive: true,
          showWarning: false,
          mouseTail: {
            duration: 500,
            lineCap: 'round',
            lineWidth: 2,
            strokeStyle: 'red',
          },
          // 重要：使用 insertStyleRules 修复 iframe 样式问题
          insertStyleRules: [
            'iframe { transform: none !important; }',
            '.replayer-wrapper { overflow: hidden !important; }',
          ],
        },
      });

      playerInstanceRef.current = player;
      console.log('[rrweb] Player initialized with size:', playerWidth, 'x', playerHeight);
    } catch (err) {
      setError('Failed to initialize player');
      console.error('[rrweb] Player error:', err);
    }

    return () => {
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current = null;
        } catch (err) {
          console.error('[rrweb] Cleanup error:', err);
        }
      }
    };
  }, [recordingData]);

  // 分析录制内容
  const handleAnalyze = () => {
    if (!recordingData) return;

    const analyzer = new RRWebAnalyzer(recordingData.events);
    const analysis = analyzer.analyze();
    const report = analyzer.generateReport(analysis);
    
    setAnalysisReport(report);
    setShowAnalysis(true);
  };

  // 下载分析报告
  const downloadAnalysis = () => {
    if (!analysisReport) return;

    const blob = new Blob([analysisReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rrweb-analysis-${recordingData?.recordingId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                rrweb Replay
              </h1>
            </div>

            {recordingData && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">RID:</span> {recordingData.recordingId}
                </div>
                <button
                  onClick={handleAnalyze}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Analyze
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!recordingData ? (
          // 文件上传区域
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Load Recording
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Select a rrweb recording JSON file to replay the session.
              </p>

              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-12 h-12 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    JSON file from rrweb recording
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".json"
                  onChange={handleFileUpload}
                />
              </label>

              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          // 回放区域
          <div className="space-y-4">
            {/* 元数据信息 */}
            {recordingData.metadata && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Recording Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    <div className="font-medium">Recorded</div>
                    <div>{new Date(recordingData.timestamp).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-medium">Events</div>
                    <div>{recordingData.events.length.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-medium">Original Viewport</div>
                    <div>{recordingData.metadata.viewport.width} × {recordingData.metadata.viewport.height}</div>
                  </div>
                  <div>
                    <div className="font-medium">Screen</div>
                    <div>{recordingData.metadata.screen.width} × {recordingData.metadata.screen.height}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 回放容器 - 使用 rrweb-player */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Session Replay
                </h3>
                <button
                  onClick={() => {
                    setRecordingData(null);
                    setError(null);
                    setShowAnalysis(false);
                  }}
                  className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
                >
                  Load Another
                </button>
              </div>
              
              {/* rrweb-player 会在这里渲染 */}
              <div 
                ref={playerContainerRef} 
                className="flex justify-center"
              />
            </div>

            {/* 分析报告 */}
            {showAnalysis && analysisReport && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    📊 Analysis Report
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadAnalysis}
                      className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Download Report
                    </button>
                    <button
                      onClick={() => setShowAnalysis(false)}
                      className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
                  {analysisReport}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
