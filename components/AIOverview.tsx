'use client';

import { useEffect, useState, useRef } from 'react';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import type { SearchResult } from '@/types/search';

interface AIOverviewProps {
  query: string;
  results: SearchResult[];
}

export default function AIOverview({ query, results }: AIOverviewProps) {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 验证数据有效性
    if (!query || !query.trim() || results.length === 0) {
      console.log('Skipping overview: invalid data', { query: !!query, resultsCount: results.length });
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const generateOverview = async () => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);
      setCompletion('');

      try {
        // 准备请求数据
        const requestData = {
          query: query.trim(),
          results: results
        };

        console.log('Sending overview request:', { 
          query: requestData.query, 
          resultsCount: requestData.results.length 
        });

        const response = await fetch('/api/overview', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify(requestData),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Overview API error:', response.status, errorText);
          throw new Error(`Failed to generate overview: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // 使用 AI SDK 的流式读取
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value, { stream: true });
          setCompletion(prev => prev + text);
        }

        setIsLoading(false);
        console.log('Overview generation completed');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Overview request aborted');
          return;
        }
        console.error('Overview generation error:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
      }
    };

    generateOverview();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, results]);

  if (error || (!isLoading && !completion)) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 animate-fade-in">
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blue-200 dark:border-blue-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                {isLoading ? (
                  <Loader size={20} className="text-white" />
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </div>
              {isLoading && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 animate-ping opacity-30"></div>
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">AI Overview</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {isLoading ? 'Generating summary...' : 'Powered by Gemini 2.5 Flash'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isLoading && completion && (
              <button
                onClick={() => setShowSources(!showSources)}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200"
                aria-label="Toggle sources"
              >
                {showSources ? (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    Hide
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Sources
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-lg transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-300 ${
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
        </div>

        {/* Content */}
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-6">
            {isLoading && !completion ? (
              <div className="space-y-3">
                <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 bg-[length:200%_100%] animate-shimmer rounded"></div>
                <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 bg-[length:200%_100%] animate-shimmer rounded w-5/6"></div>
                <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 bg-[length:200%_100%] animate-shimmer rounded w-4/6"></div>
              </div>
            ) : (
              <>
                <Response 
                  onCitationClick={(num) => {
                    // 自动展开 Sources 并滚动到对应的来源
                    setShowSources(true);
                    setTimeout(() => {
                      const sourceElement = document.querySelector(`[data-source-number="${num}"]`);
                      sourceElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      // 高亮效果
                      sourceElement?.classList.add('ring-2', 'ring-blue-500');
                      setTimeout(() => {
                        sourceElement?.classList.remove('ring-2', 'ring-blue-500');
                      }, 2000);
                    }, 100);
                  }}
                >
                  {completion}
                </Response>
                {isLoading && (
                  <span className="inline-flex items-center ml-2 align-middle">
                    <Loader size={14} className="text-blue-600 dark:text-blue-400" />
                  </span>
                )}

                {/* Add disclaimer if not already in completion */}
                {!isLoading && !completion.includes('AI responses may include mistakes') && (
                  <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
                    AI responses may include mistakes.
                  </p>
                )}

                {/* Sources Section */}
                {showSources && !isLoading && results.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-800 animate-fade-in">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Sources ({Math.min(results.length, 10)})
                    </h4>
                    <div className="space-y-2">
                      {results.slice(0, 10).map((result, index) => (
                        <a
                          key={index}
                          href={result.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-source-number={index + 1}
                          className="flex items-start gap-3 p-3 rounded-lg bg-white/60 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900/60 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 group"
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 line-clamp-1">
                              {result.title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
                              {result.displayLink}
                            </p>
                          </div>
                          <svg className="flex-shrink-0 w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
