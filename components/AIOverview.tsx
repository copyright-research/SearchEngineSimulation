'use client';

import { useEffect, useState, useRef } from 'react';
import { Response } from '@/components/ai-elements/response';
import type { SearchResult } from '@/types/search';

interface AIOverviewProps {
  query: string;
  results: SearchResult[];
}

export default function AIOverview({ query, results }: AIOverviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (results.length === 0) return;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const generateOverview = async () => {
      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);
      setCompletion('');

      try {
        const response = await fetch('/api/overview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            results: results.slice(0, 5),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to generate overview');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No reader available');
        }

        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          setCompletion(accumulatedText);
        }

        setIsLoading(false);
      } catch (err) {
        // 忽略取消请求的错误
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
      }
    };

    generateOverview();

    // 清理函数：组件卸载或 query 变化时取消请求
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, results]); // 依赖 query 和 results

  if (error) {
    return null; // 静默失败，不影响搜索体验
  }

  if (!isLoading && !completion) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto mb-6">
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl border border-blue-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blue-200 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                {isLoading ? (
                  <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </div>
              {isLoading && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 animate-ping opacity-75"></div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI Overview</h3>
              <p className="text-xs text-gray-500">
                {isLoading ? 'Generating summary...' : 'Powered by AI'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-6">
            {isLoading && !completion && (
              <div className="space-y-3">
                <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 bg-[length:200%_100%] animate-shimmer rounded"></div>
                <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 bg-[length:200%_100%] animate-shimmer rounded w-5/6"></div>
                <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 bg-[length:200%_100%] animate-shimmer rounded w-4/6"></div>
              </div>
            )}
            
            {completion && (
              <div className="text-gray-700 leading-relaxed">
                <Response>{completion}</Response>
                {isLoading && (
                  <span className="inline-block w-1 h-4 ml-1 bg-blue-600 animate-pulse align-middle"></span>
                )}
              </div>
            )}

            {/* Disclaimer */}
            {!isLoading && completion && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  AI-generated summary based on search results. Please verify important information.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
