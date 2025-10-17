'use client';

import { useState, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import type { eventWithTime } from '@rrweb/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RRWebAnalyzer } from '@/lib/rrweb-analyzer';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

// 注册 AG Grid 模块
ModuleRegistry.registerModules([AllCommunityModule]);

export const dynamic = 'force-dynamic';

interface RecordingInfo {
  recordingId: string;
  sessionId: string;
  chunksCount: number;
  hasMerged: boolean;
  firstChunkTime?: string;
  lastChunkTime?: string;
}

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
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<RecordingInfo | null>(null);
  const [recordingData, setRecordingData] = useState<RecordingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string>('');
  const [leftWidth, setLeftWidth] = useState(50); // 左侧宽度百分比
  const [isResizing, setIsResizing] = useState(false);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<InstanceType<typeof rrwebPlayer> | null>(null);
  const router = useRouter();

  // 加载录制列表
  useEffect(() => {
    loadRecordingsList();
  }, []);

  const loadRecordingsList = async () => {
    try {
      setLoadingList(true);
      const response = await fetch('/api/rrweb/list');
      
      if (!response.ok) {
        throw new Error('Failed to fetch recordings list');
      }

      const data = await response.json();
      setRecordings(data.recordings || []);
    } catch (err) {
      console.error('[rrweb] List error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recordings');
    } finally {
      setLoadingList(false);
    }
  };

  // 加载选中的录制
  const loadRecording = async (recording: RecordingInfo) => {
    setLoading(true);
    setError(null);
    setSelectedRecording(recording);
    setRecordingData(null);

    try {
      const response = await fetch(
        `/api/rrweb/upload?recordingId=${encodeURIComponent(recording.recordingId)}&sessionId=${encodeURIComponent(recording.sessionId)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch recording');
      }

      const result = await response.json();
      let allEvents: eventWithTime[] = [];

      if (result.type === 'merged') {
        const mergedResponse = await fetch(result.url);
        const mergedData = await mergedResponse.json();
        allEvents = mergedData.events;
      } else if (result.type === 'chunks') {
        const chunkPromises = result.urls.map(async (url: string) => {
          const chunkResponse = await fetch(url);
          const chunkData = await chunkResponse.json();
          return chunkData.events as eventWithTime[];
        });
        const chunksArrays = await Promise.all(chunkPromises);
        allEvents = chunksArrays.flat();
      }

      const data: RecordingData = {
        recordingId: recording.recordingId,
        timestamp: new Date().toISOString(),
        events: allEvents,
      };

      setRecordingData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recording');
      console.error('[rrweb] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化播放器
  useEffect(() => {
    if (!recordingData || !playerContainerRef.current) return;

    const container = playerContainerRef.current;

    if (playerInstanceRef.current) {
      container.innerHTML = '';
    }

    try {
      const viewport = recordingData.metadata?.viewport || { width: 1280, height: 720 };
      const aspectRatio = viewport.width / viewport.height;
      const maxWidth = 1400;
      const playerWidth = Math.min(viewport.width, maxWidth);
      const playerHeight = playerWidth / aspectRatio;

      playerInstanceRef.current = new rrwebPlayer({
        target: container,
        props: {
          events: recordingData.events,
          width: playerWidth,
          height: playerHeight,
          autoPlay: false,
          speedOption: [0.5, 1, 2, 4, 8],
          skipInactive: true,
          showController: true,
          mouseTail: {
            duration: 500,
            lineCap: 'round',
            lineWidth: 2,
            strokeStyle: 'red',
          },
          insertStyleRules: [
            'iframe { transform: none !important; }',
            '.replayer-wrapper { overflow: hidden !important; }',
          ],
        },
      });

      console.log('[rrweb] Player initialized');
    } catch (err) {
      setError('Failed to initialize player');
      console.error('[rrweb] Player error:', err);
    }

    return () => {
      if (playerInstanceRef.current && container) {
        container.innerHTML = '';
        playerInstanceRef.current = null;
      }
    };
  }, [recordingData]);

  // 分析录制
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
    a.download = `rrweb-analysis-${selectedRecording?.recordingId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 退出登录
  const handleSignOut = async () => {
    try {
      await fetch('/api/replay/auth', { method: 'DELETE' });
      router.push('/replay/login');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  // 处理拖拽调整宽度
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const containerWidth = window.innerWidth;
      const newLeftWidth = (e.clientX / containerWidth) * 100;
      
      // 限制在 20% 到 80% 之间
      if (newLeftWidth >= 20 && newLeftWidth <= 80) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // AG Grid 列定义
  const columnDefs: ColDef<RecordingInfo>[] = [
    {
      headerName: 'Recording ID',
      field: 'recordingId',
      flex: 2,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Session ID',
      field: 'sessionId',
      flex: 2,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: ICellRendererParams<RecordingInfo>) => {
        const SessionIdCell = () => (
          <span className="font-mono text-xs">{params.value}</span>
        );
        return <SessionIdCell />;
      },
    },
    {
      headerName: 'Chunks',
      field: 'chunksCount',
      width: 100,
      cellRenderer: (params: ICellRendererParams<RecordingInfo>) => {
        const ChunksCell = () => (
          <span className="text-center block">{params.value}</span>
        );
        return <ChunksCell />;
      },
    },
    {
      headerName: 'Status',
      field: 'hasMerged',
      width: 120,
      cellRenderer: (params: ICellRendererParams<RecordingInfo>) => {
        const StatusCell = () => {
          const merged = params.value;
          if (merged) {
            return (
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                Merged
              </span>
            );
          }
          return (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
              Chunks
            </span>
          );
        };
        return <StatusCell />;
      },
    },
    {
      headerName: 'Created',
      field: 'firstChunkTime',
      flex: 1,
      sort: 'desc',
      cellRenderer: (params: ICellRendererParams<RecordingInfo>) => {
        const DateCell = () => {
          if (!params.value) return <>-</>;
          return <>{new Date(params.value).toLocaleString()}</>;
        };
        return <DateCell />;
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
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
                rrweb Replay Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {selectedRecording && (
                <>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">RID:</span> {selectedRecording.recordingId}
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
                </>
              )}
              <button
                onClick={handleSignOut}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors flex items-center gap-1"
                title="Sign Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: Left (Table) + Right (Player) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Recordings List */}
        <div 
          className="border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800"
          style={{ width: `${leftWidth}%` }}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Recordings {!loadingList && `(${recordings.length})`}
              </h2>
              <button
                onClick={loadRecordingsList}
                disabled={loadingList}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors"
              >
                {loadingList ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="flex-1 ag-theme-alpine">
            <AgGridReact
              rowData={recordings}
              columnDefs={columnDefs}
              defaultColDef={{
                sortable: true,
                resizable: true,
              }}
              rowSelection="single"
              onRowClicked={(event) => {
                if (event.data) {
                  loadRecording(event.data);
                }
              }}
              animateRows={true}
              domLayout="normal"
            />
          </div>
        </div>

        {/* Resizable Divider */}
        <div
          className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 cursor-col-resize transition-colors relative group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8z"/>
              <path d="M3 4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 4z"/>
              <path d="M3 12a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 12z"/>
            </svg>
          </div>
        </div>

        {/* Right: Player */}
        <div 
          className="flex flex-col bg-gray-50 dark:bg-gray-900 overflow-auto"
          style={{ width: `${100 - leftWidth}%` }}
        >
          {!selectedRecording && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a recording from the left to replay
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">Loading recording...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                {error}
              </div>
            </div>
          )}

          {recordingData && (
            <div className="p-6 space-y-4">
              <div
                ref={playerContainerRef}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
              />
            </div>
          )}
        </div>
      </div>

      {/* Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Recording Analysis
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadAnalysis}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => setShowAnalysis(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto flex-1">
              <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-4 rounded">
                {analysisReport}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
