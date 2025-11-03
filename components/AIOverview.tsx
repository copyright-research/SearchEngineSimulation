'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import type { SearchResult } from '@/types/search';

interface AIOverviewProps {
  query: string;
  results: SearchResult[];
  onAIResponseComplete?: (response: string) => void;
}

export default function AIOverview({ query, results, onAIResponseComplete }: AIOverviewProps) {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSources, setShowSources] = useState(true); // 默认展开
  const [filteredSourceNumbers, setFilteredSourceNumbers] = useState<number[] | null>(null);
  const [citedSourceNumbers, setCitedSourceNumbers] = useState<Set<number>>(new Set());
  const [sourcesMaxHeight, setSourcesMaxHeight] = useState<string>('600px');
  const [enhancedResults, setEnhancedResults] = useState<SearchResult[]>(results); // 混合搜索结果
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 实时提取已引用的来源编号
  useEffect(() => {
    if (!completion) {
      setCitedSourceNumbers(new Set());
      return;
    }

    // 匹配所有引用 [1], [1, 2], [1, 2, 3] 等
    const citationRegex = /\[(\d+(?:,\s*\d+)*)\]/g;
    const cited = new Set<number>();
    let match;

    while ((match = citationRegex.exec(completion)) !== null) {
      const numbers = match[1].split(',').map(n => parseInt(n.trim()));
      numbers.forEach(num => {
        if (num >= 1 && num <= 10) {
          cited.add(num);
        }
      });
    }

    setCitedSourceNumbers(cited);
  }, [completion]);

  // 动态计算 Sources 的最大高度
  useEffect(() => {
    const updateSourcesHeight = () => {
      if (contentRef.current) {
        const contentHeight = contentRef.current.offsetHeight;
        // Sources 高度不超过内容高度，最小 200px，最大 800px
        const maxHeight = Math.min(Math.max(contentHeight, 200), 800);
        setSourcesMaxHeight(`${maxHeight}px`);
      }
    };

    // 初始计算
    updateSourcesHeight();

    // 监听内容变化
    const observer = new ResizeObserver(updateSourcesHeight);
    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    return () => observer.disconnect();
  }, [completion, isLoading]);

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

        // 从响应头获取混合搜索结果
        const searchResultsHeader = response.headers.get('X-Search-Results');
        if (searchResultsHeader) {
          try {
            // 使用 TextDecoder 正确解码 UTF-8
            const binaryString = atob(searchResultsHeader);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const decodedString = new TextDecoder('utf-8').decode(bytes);
            const decodedResults = JSON.parse(decodedString);
            
            if (decodedResults && decodedResults.length > 0) {
              setEnhancedResults(decodedResults);
              console.log('Loaded enhanced results from response header:', decodedResults.length);
            }
          } catch (decodeError) {
            console.warn('Failed to decode search results from header:', decodeError);
          }
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // 使用 AI SDK 的流式读取
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullResponse = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value, { stream: true });
          fullResponse += text;
          setCompletion(prev => prev + text);
        }

        setIsLoading(false);
        console.log('Overview generation completed');
        
        // 通知父组件AI回答已完成
        if (onAIResponseComplete && fullResponse) {
          onAIResponseComplete(fullResponse);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                {isLoading ? 'Generating summary...' : 'Powered by Groq AI'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
                  {!isLoading && completion && (
                    <div className="flex items-center gap-2">
                      {filteredSourceNumbers && (
                        <button
                          onClick={() => {
                            setFilteredSourceNumbers(null);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition-all duration-200"
                          aria-label="Clear filter"
                        >
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear Filter
                          </span>
                        </button>
                      )}
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
                    </div>
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
          {isLoading && !completion ? (
            <div className="p-6 space-y-3">
              <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 bg-[length:200%_100%] animate-shimmer rounded"></div>
              <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 bg-[length:200%_100%] animate-shimmer rounded w-5/6"></div>
              <div className="h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 bg-[length:200%_100%] animate-shimmer rounded w-4/6"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 items-start">
              {/* 左侧：AI 生成的内容 (2/3 宽度) */}
              <div ref={contentRef} className="lg:col-span-2">
                <Response 
                  onCitationClick={(numbers) => {
                    // 自动展开 Sources 并筛选显示
                    setShowSources(true);
                    setFilteredSourceNumbers(numbers);
                    
                    // 滚动到第一个来源
                    setTimeout(() => {
                      if (numbers.length > 0) {
                        const firstSource = document.querySelector(`[data-source-number="${numbers[0]}"]`);
                        firstSource?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
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
              </div>

              {/* 右侧：Sources (1/3 宽度，可滚动) */}
              {showSources && !isLoading && results.length > 0 && (
                <div className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Sources
                        {filteredSourceNumbers && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-normal">
                            (Filtered)
                          </span>
                        )}
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {filteredSourceNumbers 
                          ? filteredSourceNumbers.length 
                          : citedSourceNumbers.size}
                      </span>
                    </div>
                    <div className="overflow-y-auto overflow-x-hidden pr-1 space-y-2 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-800 scrollbar-track-transparent" style={{ maxHeight: sourcesMaxHeight }}>
                      {enhancedResults.slice(0, 10)
                        .map((result, index) => ({ result, originalIndex: index + 1 }))
                        .filter(({ originalIndex }) => {
                          // 如果有筛选条件，只显示筛选的来源
                          if (filteredSourceNumbers) {
                            return filteredSourceNumbers.includes(originalIndex);
                          }
                          // 否则只显示已被引用的来源
                          return citedSourceNumbers.has(originalIndex);
                        })
                        .map(({ result, originalIndex }) => {
                        // 提取域名用于获取 favicon
                        const getDomain = (url: string) => {
                          try {
                            const urlObj = new URL(url);
                            return urlObj.hostname;
                          } catch {
                            return result.displayLink || '';
                          }
                        };
                        const domain = getDomain(result.link);
                        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

                        return (
                          <a
                            key={originalIndex}
                            href={result.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-source-number={originalIndex}
                            className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900/60 border border-blue-100/50 dark:border-blue-900/50 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all duration-200 group block animate-fade-in"
                          >
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                              {originalIndex}
                            </span>
                            <div className="flex-1 min-w-0 flex items-start gap-2">
                              {/* 网站图标 */}
                              <Image
                                src={faviconUrl}
                                alt=""
                                width={16}
                                height={16}
                                className="rounded flex-shrink-0 mt-0.5"
                                unoptimized
                                onError={(e) => {
                                  // 如果图标加载失败，隐藏图标
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 line-clamp-2 leading-tight">
                                  {result.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate">
                                    {result.displayLink}
                                  </p>
                                  {/* 来源标签 */}
                                  {result.searchSource && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                      result.searchSource === 'tavily' 
                                        ? 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' 
                                        : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                                    }`}>
                                      {result.searchSource === 'tavily' ? '🎯 Tavily' : '🔍 Google'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <svg className="flex-shrink-0 w-3 h-3 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
