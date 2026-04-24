'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import AIOverviewLoading from '@/components/AIOverviewLoading';
import type { SearchResult } from '@/types/search';
import { useDebugDepsDeep } from '@/lib/use-debug-deps';
import { useSearchHistory } from '@/lib/use-search-history';

interface AIOverviewProps {
  query: string;
  results: SearchResult[];
  onAIResponseComplete?: (response: string, overviewResults?: SearchResult[]) => void;
  historyId?: number | null;
}

export default function AIOverview({ query, results, onAIResponseComplete, historyId }: AIOverviewProps) {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSources, setShowSources] = useState(true); // 默认展开
  const [filteredSourceNumbers, setFilteredSourceNumbers] = useState<number[] | null>(null);
  const [enhancedResults, setEnhancedResults] = useState<SearchResult[]>(results); // 混合搜索结果
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [shouldShowExpandButton, setShouldShowExpandButton] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false); // Sources 展开状态
  const [userFeedback, setUserFeedback] = useState<'up' | 'down' | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isRequestInProgressRef = useRef(false);
  const onAIResponseCompleteRef = useRef<AIOverviewProps['onAIResponseComplete']>(onAIResponseComplete);
  const COLLAPSED_HEIGHT = 300; // 折叠时的最大高度（像素）

  const { reportFeedback } = useSearchHistory();

  // 保持回调引用最新，避免流结束时使用到旧闭包（例如旧的 historyId）
  useEffect(() => {
    onAIResponseCompleteRef.current = onAIResponseComplete;
  }, [onAIResponseComplete]);

  // 🔍 Debug: 追踪依赖项变化
  useDebugDepsDeep('AIOverview', { query, results });

  // 生成 results 的指纹，用于依赖项比较
  // 这样可以避免因为 results 引用变化（即使内容没变）导致的 useEffect 重复执行
  const resultsFingerprint = useMemo(() => {
    if (!results || results.length === 0) return '';
    return results.map(r => r.link).join('|');
  }, [results]);

    // 实时提取已引用的来源编号
  useEffect(() => {
    if (!completion) {
      return;
    }

    // 匹配所有引用 [1], [1, 2], [1, 2, 3] 和 【1】, 【1, 2】 等
    const citationRegex = /[\[【](\d+(?:,\s*\d+)*)[\]】]/g;
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

    // setCitedSourceNumbers(cited);
  }, [completion]);

  // 动态计算 Sources 的最大高度和检查是否需要展开按钮
  useEffect(() => {
    const updateSourcesHeight = () => {
      if (contentRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        // Sources 高度不超过内容高度，最小 200px，最大 800px
        // const maxHeight = Math.min(Math.max(contentHeight, 200), 800);
        // setSourcesMaxHeight(`${maxHeight}px`);
        
        // 检查内容是否超过折叠高度
        if (contentHeight > COLLAPSED_HEIGHT) {
          setShouldShowExpandButton(true);
        } else {
          setShouldShowExpandButton(false);
          setIsContentExpanded(false);
        }
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
  }, [completion, isLoading, COLLAPSED_HEIGHT]);

  useEffect(() => {
    // 验证数据有效性
    if (!query || !query.trim() || results.length === 0) {
      console.log('[AIOverview] Skipping overview: invalid data', { query: !!query, resultsCount: results.length });
      return;
    }

    // 如果已有请求正在进行中，跳过（防止 React Strict Mode 的第二次 mount）
    if (isRequestInProgressRef.current) {
      console.log('[AIOverview] 🚫 Skipping: request already in progress (likely Strict Mode re-mount)');
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      console.log('[AIOverview] Aborting previous request');
      abortControllerRef.current.abort();
    }

    const generateOverview = async () => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      isRequestInProgressRef.current = true;

      setIsLoading(true);
      setError(null);
      setCompletion('');
      setUserFeedback(null); // Reset feedback on new generation
      setEnhancedResults(results);

      try {
        let resultsUsedForCitations: SearchResult[] = results.slice(0, 10);

        // 准备请求数据
        const requestData = {
          query: query.trim(),
          results: results
        };

        console.log('[AIOverview] 🚀 Sending overview request:', { 
          query: requestData.query, 
          resultsCount: requestData.results.length,
          timestamp: new Date().toISOString()
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
          console.error('[AIOverview] ❌ API error:', response.status, errorText);
          throw new Error(`Failed to generate overview: ${response.status}`);
        }

        console.log('[AIOverview] ✅ Response received, starting stream...');

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
            const decodedResults = JSON.parse(decodedString) as SearchResult[];
            
            if (Array.isArray(decodedResults) && decodedResults.length > 0) {
              resultsUsedForCitations = decodedResults;
              setEnhancedResults(decodedResults);
              console.log('[AIOverview] 📚 Loaded enhanced results from response header:', decodedResults.length);
            }
          } catch (decodeError) {
            console.warn('[AIOverview] ⚠️ Failed to decode search results from header:', decodeError);
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
        isRequestInProgressRef.current = false;
        console.log('[AIOverview] ✨ Overview generation completed');
        
        // 通知父组件AI回答已完成
        if (onAIResponseCompleteRef.current && fullResponse) {
          onAIResponseCompleteRef.current(fullResponse, resultsUsedForCitations);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[AIOverview] 🛑 Overview request aborted');
          isRequestInProgressRef.current = false;
          return;
        }
        console.error('[AIOverview] ❌ Overview generation error:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
        isRequestInProgressRef.current = false;
      }
    };

    console.log('[AIOverview] 🔄 useEffect triggered - calling generateOverview()');
    generateOverview();

    return () => {
      if (abortControllerRef.current) {
        console.log('[AIOverview] 🧹 Cleanup: aborting request');
        abortControllerRef.current.abort();
      }
      // 重置进行中标志，允许下次 mount 时重新请求（处理 Strict Mode）
      isRequestInProgressRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, resultsFingerprint]);

  const handleFeedback = async (feedback: 'up' | 'down') => {
    if (!historyId) return;
    
    // Toggle feedback if clicking same button
    const newFeedback = userFeedback === feedback ? null : feedback;
    setUserFeedback(newFeedback);
    
    await reportFeedback(historyId, newFeedback);
  };

  if (error || (!isLoading && !completion)) {
    return null;
  }

  return (
    <div className="w-full mb-6 animate-fade-in" style={{ maxWidth: '1100px' }}>
      <div 
        className="overflow-visible transition-all duration-200"
        style={{
          backgroundColor: 'transparent',
          borderBottom: '1px solid var(--google-border)',
          paddingBottom: '20px'
        }}
      >
        {/* Header - 完全匹配 Google 的 AI Overview 样式 */}
        <div 
          className="flex items-center justify-between"
          style={{
            maxHeight: '32px',
            padding: '16px 0',
            borderBottom: '1px solid var(--google-border-light)',
            backgroundColor: 'transparent'
          }}
        >
          <div className="flex items-center gap-4" style={{ flexGrow: 1, paddingLeft: '16px' }}>
            {/* AI 图标 - 使用 Google 的星形图标 */}
            <svg 
              className="fWWlmf" 
              height="24" 
              width="24" 
              aria-hidden="true" 
              viewBox="0 0 471 471" 
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <path 
                fill="var(--m3c23)" 
                d="M235.5 471C235.5 438.423 229.22 407.807 216.66 379.155C204.492 350.503 187.811 325.579 166.616 304.384C145.421 283.189 120.498 266.508 91.845 254.34C63.1925 241.78 32.5775 235.5 0 235.5C32.5775 235.5 63.1925 229.416 91.845 217.249C120.498 204.689 145.421 187.811 166.616 166.616C187.811 145.421 204.492 120.497 216.66 91.845C229.22 63.1925 235.5 32.5775 235.5 0C235.5 32.5775 241.584 63.1925 253.751 91.845C266.311 120.497 283.189 145.421 304.384 166.616C325.579 187.811 350.503 204.689 379.155 217.249C407.807 229.416 438.423 235.5 471 235.5C438.423 235.5 407.807 241.78 379.155 254.34C350.503 266.508 325.579 283.189 304.384 304.384C283.189 325.579 266.311 350.503 253.751 379.155C241.584 407.807 235.5 438.423 235.5 471Z"
              />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* 标题 - 使用 Fzsovc 样式 */}
              <div 
                className="Fzsovc"
                style={{ 
                  fontWeight: 500,
                  color: 'var(--google-text)',
                  fontSize: '14px',
                  fontFamily: "'Google Sans', Roboto, Arial, sans-serif"
                }}
              >
                AI Overview
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2" style={{ paddingRight: '16px' }}>
                  {!isLoading && completion && (
                    <div className="flex items-center gap-2">
                      {filteredSourceNumbers && (
                      <button
                        onClick={() => {
                          setFilteredSourceNumbers(null);
                        }}
                        className="px-3 py-1 text-xs font-medium rounded transition-all duration-200"
                        style={{
                          color: 'var(--google-text-secondary)',
                          backgroundColor: 'transparent',
                          fontFamily: "'Google Sans', Roboto, Arial, sans-serif"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(60,64,67,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
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
                        className="px-3 py-1 text-xs font-medium rounded transition-all duration-200"
                        style={{
                          color: 'var(--google-blue)',
                          backgroundColor: 'transparent',
                          fontFamily: "'Google Sans', Roboto, Arial, sans-serif"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(26,115,232,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
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
              className="p-2 rounded transition-colors"
              style={{
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(60,64,67,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                style={{ color: 'var(--google-text-secondary)' }}
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
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`} style={{ backgroundColor: 'transparent' }}>
          {isLoading && !completion ? (
            <AIOverviewLoading embedded stage="generating" sourceCount={enhancedResults.length || results.length} />
          ) : (
            <>
              <div 
                className="relative"
                style={{
                  maxHeight: !isContentExpanded && shouldShowExpandButton ? `${COLLAPSED_HEIGHT + 40}px` : 'none',
                  overflow: 'hidden'
                }}
              >
                <div className="flex flex-col lg:flex-row gap-5 p-5 items-start">
                  {/* 左侧：AI 生成的内容 - 与 Search Results 一致 */}
                  <div style={{ color: 'var(--google-text)', flex: '0 0 612px', maxWidth: '612px' }}>
                    <div ref={contentRef}>
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

                      {/* Footer with Disclaimer and Feedback Buttons */}
                      {!isLoading && completion && (
                        <div className="flex items-center justify-between mt-6 pt-2">
                          <div className="text-[11px] text-[#70757a] font-roboto">
                            <span>AI responses may include mistakes. </span>
                            <a href="#" className="underline hover:text-[#4d5156]">Learn more</a>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              className={`p-2 rounded-full transition-colors ${userFeedback === 'up' ? 'text-blue-600 bg-blue-50' : 'text-[#70757a] hover:bg-[#f1f3f4]'}`}
                              aria-label="Good response"
                              onClick={() => handleFeedback('up')}
                              title="Good response"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={userFeedback === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button 
                              className={`p-2 rounded-full transition-colors ${userFeedback === 'down' ? 'text-blue-600 bg-blue-50' : 'text-[#70757a] hover:bg-[#f1f3f4]'}`}
                              aria-label="Bad response"
                              onClick={() => handleFeedback('down')}
                              title="Bad response"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={userFeedback === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

              {/* 右侧：Sources - Content 宽度的 1/3 */}
              {showSources && !isLoading && results.length > 0 && (
                <div className="lg:sticky lg:top-4 lg:self-start flex-shrink-0 w-full lg:w-[300px]" style={{ maxWidth: '100%' }}>
                  <div className="rounded-2xl bg-[#eff3f8] p-4 flex flex-col gap-4">
                    <div
                      className="flex flex-col"
                      style={
                        // 如果处于“Show All”模式，增加最大高度与滚动
                        isSourcesExpanded
                          ? {
                              maxHeight: 420,
                              overflowY: 'auto'
                            }
                          : undefined
                      }
                    >
                      {enhancedResults
                        .map((result, index) => ({ result, originalIndex: index + 1 }))
                        .filter(({ originalIndex }) => {
                          // 如果有筛选条件，只显示筛选的来源
                          if (filteredSourceNumbers) {
                            return filteredSourceNumbers.includes(originalIndex);
                          }
                          // 如果没有筛选，显示前3个或全部（如果展开）
                          if (!isSourcesExpanded) {
                            // 如果没有被引用筛选，且处于折叠状态，只显示前3个
                            // 但如果当前是被引用的过滤状态，应该显示所有符合过滤条件的
                            return true;
                          }
                          return true;
                        })
                        // 如果没有过滤，且未展开，只取前3个
                        .filter((_, idx) => filteredSourceNumbers || isSourcesExpanded || idx < 3)
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
                          <div key={originalIndex} className="py-3 border-b border-gray-200 last:border-0 first:pt-0">
                            <a
                              href={result.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-source-number={originalIndex}
                              className="block group"
                            >
                              <h3 className="text-sm font-medium text-[#1f1f1f] mb-1 line-clamp-2 group-hover:text-blue-800 group-hover:underline decoration-blue-800">
                                {result.title}
                              </h3>
                              <div className="text-xs text-[#444746] mb-2 line-clamp-2 leading-relaxed">
                                {result.snippet}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Image
                                  src={faviconUrl}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="rounded-full flex-shrink-0"
                                  unoptimized
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <span className="text-xs text-[#1f1f1f] font-medium truncate max-w-[150px]">
                                  {result.displayLink || domain}
                                </span>
                                {/* 来源项的三个点菜单 (占位) */}
                                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                  </svg>
                                </div>
                              </div>
                            </a>
                          </div>
                        );
                      })}
                    </div>

                    {!filteredSourceNumbers && enhancedResults.length > 3 && (
                      <button
                        onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                        className="w-full py-2 rounded-full bg-[#e2e7eb] text-sm font-medium text-[#1f1f1f] hover:bg-[#d3d3d3] transition-colors mt-2"
                      >
                        {isSourcesExpanded ? 'Collapse' : 'Show All'}
                      </button>
                    )}
                  </div>
                </div>
              )}
                </div>
                
                {/* 渐变遮罩 - 覆盖整个 AI Overview 底部 */}
                {!isContentExpanded && shouldShowExpandButton && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                    style={{
                      background: 'linear-gradient(to top, var(--google-bg), transparent)',
                      zIndex: 10
                    }}
                  />
                )}
              </div>
              
              {/* Show More / Show Less 按钮 - 在整个 AI Overview 的底部 */}
              {shouldShowExpandButton && !isLoading && (
                <div className="flex justify-center" style={{ paddingTop: '16px', paddingBottom: '16px', backgroundColor: 'transparent' }}>
                  <button
                    onClick={() => setIsContentExpanded(!isContentExpanded)}
                    className="inline-flex items-center justify-center relative"
                    style={{
                      height: '48px',
                      width: '100%',
                      maxWidth: '632px',
                      backgroundColor: '#fff',
                      color: 'var(--google-text)',
                      fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
                      fontSize: '14px',
                      fontWeight: '500',
                      lineHeight: '20px',
                      border: '1px solid transparent',
                      borderRadius: '999rem',
                      padding: '11px 15px',
                      cursor: 'pointer',
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      textTransform: 'none',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      const after = document.createElement('div');
                      after.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(11,87,208,.0784313725);
                        border-radius: inherit;
                        z-index: -1;
                        pointer-events: none;
                      `;
                      after.className = 'hover-overlay';
                      e.currentTarget.appendChild(after);
                    }}
                    onMouseLeave={(e) => {
                      const overlay = e.currentTarget.querySelector('.hover-overlay');
                      if (overlay) {
                        overlay.remove();
                      }
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                      <span>{isContentExpanded ? 'Show less' : 'Show more'}</span>
                      <svg 
                        focusable="false" 
                        aria-hidden="true" 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24"
                        style={{ 
                          width: '20px', 
                          height: '20px',
                          fill: 'currentColor',
                          transform: isContentExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 200ms ease'
                        }}
                      >
                        <path d="M5.41 7.59L4 9l8 8 8-8-1.41-1.41L12 14.17" />
                      </svg>
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
