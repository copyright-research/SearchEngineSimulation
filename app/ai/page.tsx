'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import { RRWebRecorder } from '@/components/RRWebRecorder';
import type { SearchResult } from '@/types/search';
import { useSearchHistory } from '@/lib/use-search-history';
import { getParamCaseInsensitive } from '@/lib/url-utils';

export default function AIModePage() {
  const searchParams = useSearchParams();

  // 为每条消息存储对应的 sources（使用消息 ID 作为 key）
  const [messageSourcesMap, setMessageSourcesMap] = useState<Record<string, SearchResult[]>>({});
  // 为每条消息存储对应的 historyId（使用消息 ID 作为 key）
  const [messageHistoryIdMap, setMessageHistoryIdMap] = useState<Record<string, number>>({});
  // 为每条消息存储反馈状态（使用消息 ID 作为 key）
  const [messageFeedbackMap, setMessageFeedbackMap] = useState<Record<string, 'up' | 'down' | null>>({});
  
  const [filteredSourceNumbers, setFilteredSourceNumbers] = useState<number[] | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null); // 追踪哪个消息的引用被点击了
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoPromptedRef = useRef(false);
  
  // 存储最新的响应头（用于获取 sources）
  const latestResponseHeadersRef = useRef<Headers | null>(null);
  
  // 搜索历史保存和反馈
  const { saveSearchHistory, reportFeedback } = useSearchHistory();

  const ridParam = useMemo(() => getParamCaseInsensitive(searchParams, 'rid'), [searchParams]);
  const searchPageHref = ridParam ? `/?rid=${encodeURIComponent(ridParam)}` : '/';

  // 确保 URL 中有 RID
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const searchParams = new URLSearchParams(window.location.search);
    const hasRid = Array.from(searchParams.keys()).some(key => key.toLowerCase() === 'rid');
    
    if (!hasRid) {
      const newRid = 'auto-' + Math.random().toString(36).substring(2, 9);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('RID', newRid);
      window.history.replaceState({}, '', newUrl.toString());
      console.log('[AI Page] Generated new RID:', newRid);
    }
  }, []);

  // 从文本中提取所有被引用的数字
  const extractCitedNumbers = (text: string): number[] => {
    const citationRegex = /\[(\d+(?:,\s*\d+)*)\]/g;
    const numbers = new Set<number>();
    let match;
    
    while ((match = citationRegex.exec(text)) !== null) {
      const nums = match[1].split(',').map(n => parseInt(n.trim()));
      nums.forEach(n => numbers.add(n));
    }
    
    return Array.from(numbers).sort((a, b) => a - b);
  };

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      fetch: async (url, options) => {
        const response = await fetch(url, options);
        // 保存响应头
        latestResponseHeadersRef.current = response.headers;
        return response;
      },
    }),
    onFinish: async (options) => {
      console.log('Message finished:', options.message);
      
      // 保存AI对话历史
      const message = options.message;
      if (message.role === 'assistant') {
        const textContent = message.parts
          .filter((part) => part.type === 'text')
          .map((part) => ('text' in part ? part.text : ''))
          .join('');
        
        // 从响应头中获取 sources
        let sources: SearchResult[] = [];
        if (latestResponseHeadersRef.current) {
          const searchResultsHeader = latestResponseHeadersRef.current.get('X-Search-Results');
          if (searchResultsHeader) {
            try {
              // 使用 TextDecoder 正确解码 UTF-8
              const binaryString = atob(searchResultsHeader);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const decodedString = new TextDecoder('utf-8').decode(bytes);
              sources = JSON.parse(decodedString);
              
              console.log('Loaded sources from response header:', {
                messageId: message.id,
                sourcesCount: sources.length
              });
            } catch (decodeError) {
              console.error('Failed to decode sources from header:', decodeError);
            }
          }
        }
        
        // 保存到 map 中
        if (sources.length > 0) {
          setMessageSourcesMap(prev => ({
            ...prev,
            [message.id]: sources
          }));
        }
        
        // 获取对应的用户查询 - 优先从 Response Header 获取，因为 messages 状态在闭包中可能是旧的
        let userQuery = '';
        if (latestResponseHeadersRef.current) {
          const originalQueryHeader = latestResponseHeadersRef.current.get('X-Original-Query');
          if (originalQueryHeader) {
            try {
              const binaryString = atob(originalQueryHeader);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              userQuery = new TextDecoder('utf-8').decode(bytes);
            } catch (e) {
              console.error('Failed to decode user query from header:', e);
            }
          }
        }

        // Fallback: 尝试从 messages 中获取 (如果 header 获取失败)
        if (!userQuery) {
          const userMessageIndex = messages.findIndex(m => m.id === message.id) - 1;
          if (userMessageIndex >= 0) {
            const userMessage = messages[userMessageIndex];
            userQuery = userMessage.parts
              .filter((part) => part.type === 'text')
              .map((part) => ('text' in part ? part.text : ''))
              .join('');
          }
        }
          
        if (userQuery) {
          saveSearchHistory(userQuery, 'ai' as const, sources, textContent)
            .then(id => {
              if (id) {
                setMessageHistoryIdMap(prev => ({
                  ...prev,
                  [message.id]: id
                }));
              }
            })
            .catch(err => {
              console.error('Failed to save AI chat history:', err);
            });
        }
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  const [input, setInput] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasAutoPromptedRef.current) return;
    if (messages.length > 0 || status !== 'ready') return;

    // 支持从 URL 注入首个问题，默认参数为 q
    // 同时兼容 query/topic/keyword
    const searchParams = new URLSearchParams(window.location.search);
    const candidateKeys = new Set(['q', 'query', 'topic', 'keyword']);

    let seededQuery = '';
    for (const [key, value] of searchParams.entries()) {
      if (candidateKeys.has(key.toLowerCase())) {
        seededQuery = value.trim();
        break;
      }
    }

    if (!seededQuery) return;
    hasAutoPromptedRef.current = true;

    sendMessage({
      parts: [{ type: 'text', text: seededQuery }],
    });
  }, [messages.length, sendMessage, status]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userInput = input;

    // 重置过滤状态
    setFilteredSourceNumbers(null);
    setActiveMessageId(null);

    // 发送消息给 AI（AI SDK 5 格式）
    // Sources 会在 AI 响应的 data 字段中返回
    sendMessage({
      parts: [{ type: 'text', text: userInput }],
    });
    
    setInput(''); // 清空输入框
  };

  const handleFeedback = async (messageId: string, feedback: 'up' | 'down') => {
    const historyId = messageHistoryIdMap[messageId];
    if (!historyId) {
      console.warn('[AI Page] No historyId found for message feedback:', messageId);
      return;
    }

    const currentFeedback = messageFeedbackMap[messageId];
    const newFeedback = currentFeedback === feedback ? null : feedback;

    setMessageFeedbackMap(prev => ({
      ...prev,
      [messageId]: newFeedback
    }));

    await reportFeedback(historyId, newFeedback);
  };


  // 自动滚动逻辑 - 基于 Stack Overflow dotnetCarpenter 的方案
  // 只有用户在底部时才自动滚动，用户滚上去后停止
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  
  // 检测用户是否在底部（允许 1px 误差）
  const checkIfAtBottom = () => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const currentScroll = window.pageYOffset;
    const isAtBottom = scrollableHeight - currentScroll <= 1;
    setIsUserAtBottom(isAtBottom);
    return isAtBottom;
  };
  
  // 滚动到底部
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const element = messagesEndRef.current;
      const elementRect = element.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.pageYOffset;
      
      window.scrollTo({
        top: absoluteElementTop + 100,
        behavior: 'smooth'
      });
    }
  };
  
  // 监听用户滚动事件
  useEffect(() => {
    const handleScroll = () => {
      checkIfAtBottom();
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 当消息更新时，只有用户在底部才自动滚动
  useEffect(() => {
    if (status === 'streaming' && isUserAtBottom) {
      scrollToBottom();
    }
  }, [messages, status, isUserAtBottom]);

  // Sources 现在直接从 AI 响应的 data 字段中获取，不再需要单独关联

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--google-bg)' }}>
      <div className={`px-4 relative ${messages.length > 0 ? 'max-w-none' : 'container mx-auto'}`}>
        {/* Header - Google 风格 */}
        <header className={`transition-all duration-300 ${messages.length > 0 ? 'pt-4 pb-4' : 'pt-40 pb-8'}`}>
          {messages.length > 0 ? (
            /* 对话模式：Logo 和返回按钮在同一行 */
            <div className="flex items-center gap-8 mb-4" style={{ maxWidth: '1140px' }}>
              {/* Logo - 左侧 */}
              <Link href={searchPageHref} className="flex-shrink-0">
                <h1 className="text-2xl" style={{ 
                  fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                  fontWeight: 400,
                  color: 'var(--google-text)',
                  cursor: 'pointer'
                }}>
                  <span style={{ color: '#4285f4' }}>R</span>
                  <span style={{ color: '#ea4335' }}>e</span>
                  <span style={{ color: '#fbbc04' }}>S</span>
                  <span style={{ color: '#4285f4' }}>e</span>
                  <span style={{ color: '#34a853' }}>a</span>
                  <span style={{ color: '#ea4335' }}>r</span>
                  <span style={{ color: '#4285f4' }}>c</span>
                  <span style={{ color: '#fbbc04' }}>h</span>
                  <span style={{ color: 'var(--google-text)', marginLeft: '8px' }}>AI</span>
                </h1>
              </Link>
              
              {/* 返回搜索按钮 */}
              <Link 
                href={searchPageHref}
                className="text-sm transition-colors"
                style={{ 
                  color: 'var(--google-blue)',
                  fontFamily: 'Roboto, Arial, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                ← Back to Search
              </Link>
            </div>
          ) : (
            /* 首页布局：居中 */
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-3">
                <h1 className="text-5xl" style={{ 
                  fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                  fontWeight: 400,
                  color: 'var(--google-text)'
                }}>
                  <span style={{ color: '#4285f4' }}>R</span>
                  <span style={{ color: '#ea4335' }}>e</span>
                  <span style={{ color: '#fbbc04' }}>S</span>
                  <span style={{ color: '#4285f4' }}>e</span>
                  <span style={{ color: '#34a853' }}>a</span>
                  <span style={{ color: '#ea4335' }}>r</span>
                  <span style={{ color: '#4285f4' }}>c</span>
                  <span style={{ color: '#fbbc04' }}>h</span>
                  <span style={{ color: 'var(--google-text)', marginLeft: '8px' }}>AI</span>
                </h1>
              </div>
              <p className="text-base mb-8" style={{ color: 'var(--google-text-secondary)' }}>
                Ask me anything - I&apos;ll search the web and provide accurate, cited answers
              </p>
            </div>
          )}
        </header>

        {/* Main Chat Area */}
        <main className="pb-32 min-h-[calc(100vh-180px)] flex flex-col">
          {messages.length === 0 ? (
            // 欢迎界面 - Google 风格
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
              {/* 输入框 - 首页居中显示 */}
              <form onSubmit={handleFormSubmit} className="w-full max-w-2xl mb-8">
                <div className="relative group">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={status === 'streaming'}
                    className="w-full px-6 py-4 pr-14 text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      border: '1px solid var(--google-border)',
                      backgroundColor: 'var(--google-bg)',
                      color: 'var(--google-text)',
                      fontFamily: 'Roboto, Arial, sans-serif',
                      fontSize: '16px',
                      borderRadius: '24px',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 6px rgba(32,33,36,.28)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onMouseEnter={(e) => {
                      if (e.currentTarget !== document.activeElement) {
                        e.currentTarget.style.boxShadow = '0 1px 6px rgba(32,33,36,.28)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (e.currentTarget !== document.activeElement) {
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={status === 'streaming' || !input.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: status === 'streaming' || !input.trim() ? 'transparent' : 'var(--google-blue)',
                      color: '#ffffff'
                    }}
                    onMouseEnter={(e) => {
                      if (!(status === 'streaming' || !input.trim())) {
                        e.currentTarget.style.backgroundColor = 'var(--google-blue-dark)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(status === 'streaming' || !input.trim())) {
                        e.currentTarget.style.backgroundColor = 'var(--google-blue)';
                      }
                    }}
                  >
                    {status === 'streaming' ? (
                      <Loader size={20} className="text-blue-600" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
              
              {/* 示例问题 - Google 风格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {[
                  "What's new in Next.js 15?",
                  "How does React Server Components work?",
                  "Best practices for TypeScript in 2024",
                  "Compare Vercel AI SDK vs LangChain"
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setFilteredSourceNumbers(null);
                      setActiveMessageId(null);
                      sendMessage({
                        parts: [{ type: 'text', text: example }],
                      });
                    }}
                    className="p-4 text-left text-sm transition-all"
                    style={{
                      color: 'var(--google-text)',
                      backgroundColor: 'var(--google-bg)',
                      border: '1px solid var(--google-border)',
                      borderRadius: '8px',
                      fontFamily: 'Roboto, Arial, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 6px rgba(32,33,36,.28)';
                      e.currentTarget.style.borderColor = 'var(--google-border-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = 'var(--google-border)';
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // 对话界面 - Google 风格，左对齐
            <div className="w-full flex-grow flex flex-col xl:ml-[182px]">
              {/* 消息列表 */}
              <div className="space-y-8 mb-6 flex-shrink-0 w-full">
                {messages.map((message, index) => {
                  // Extract text content
                  const fullText = message.parts
                    .filter((part) => part.type === 'text')
                    .map((part) => ('text' in part ? part.text : ''))
                    .join('');

                  // Parse related questions if present
                  const parts = fullText.split('__RELATED_QUESTIONS__');
                  const mainContent = parts[0];
                  const relatedQuestions = parts[1] 
                    ? parts[1].split('\n').filter(q => q.trim().length > 0).map(q => q.trim())
                    : [];

                  // Get sources for this message
                  const messageSources = message.role === 'assistant' 
                    ? messageSourcesMap[message.id] || []
                    : [];

                  // Only use animation for completed messages
                  const isStreaming = status === 'streaming' && index === messages.length - 1;
                  
                  return (
                    <div 
                      key={message.id} 
                      className={isStreaming ? '' : 'animate-fade-in'}
                      style={{ 
                        contain: 'layout style paint',
                        paddingBottom: '20px',
                        borderBottom: '1px solid var(--google-border)'
                      }}
                    >
                      {message.role === 'user' ? (
                        // User message - Google style
                        <div className="mb-4">
                          <div className="text-xl" style={{ 
                            color: 'var(--google-text)',
                            fontFamily: 'Roboto, Arial, sans-serif',
                            fontWeight: 400
                          }}>
                            {mainContent}
                          </div>
                        </div>
                      ) : (
                        // AI Answer - Google AI Overview style
                        <div className="flex flex-col lg:flex-row gap-5 items-start">
                          {/* AI Answer Content - Left Side */}
                          <div style={{ flex: '0 0 612px', maxWidth: '612px' }}>
                            {/* Header */}
                            <div 
                              className="flex items-center gap-3 mb-4"
                              style={{
                                padding: '0',
                                backgroundColor: 'transparent'
                              }}
                            >
                              {/* AI 图标 - 使用 Google 的星形图标 */}
                              <svg 
                                className="fWWlmf" 
                                height="24" 
                                viewBox="0 0 24 24" 
                                width="24" 
                                focusable="false" 
                                style={{ color: 'var(--m3c23)' }}
                              >
                                <path 
                                  d="m12 2 2.582 6.953L22 11.618l-5.822 3.93L17.4 22 12 18.278 6.6 22l1.222-6.452L2 11.618l7.418-2.665L12 2z" 
                                  fill="currentColor"
                                />
                              </svg>
                              <div>
                                <h4 
                                  className="Fzsovc" 
                                  style={{ 
                                    fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    lineHeight: '20px',
                                    color: 'var(--m3c9)'
                                  }}
                                >
                                  AI Overview
                                </h4>
                              </div>
                            </div>
                            
                            {/* Content - Reuse Response Component */}
                            <div style={{ color: 'var(--google-text)' }}>
                              <Response
                                onCitationClick={(numbers) => {
                                  console.log('Citation clicked:', numbers, 'for message:', message.id);
                                  console.log('Current message sources:', messageSources);
                                  setActiveMessageId(message.id);
                                  setFilteredSourceNumbers(numbers);
                                }}
                              >
                                {mainContent}
                              </Response>
                              
                              {/* Loading Indicator */}
                              {status === 'streaming' && index === messages.length - 1 && (
                                <span className="inline-flex items-center ml-2 align-middle">
                                  <Loader size={14} className="text-blue-600" />
                                </span>
                              )}

                              {/* Footer with Disclaimer and Feedback Buttons */}
                              {!isStreaming && (
                                <div className="flex items-center justify-between mt-6 pt-2">
                                  <div className="text-[11px] text-[#70757a] font-roboto">
                                    <span>AI responses may include mistakes. </span>
                                    <a href="#" className="underline hover:text-[#4d5156]">Learn more</a>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button 
                                      className={`p-2 rounded-full transition-colors ${messageFeedbackMap[message.id] === 'up' ? 'text-blue-600 bg-blue-50' : 'text-[#70757a] hover:bg-[#f1f3f4]'}`}
                                      aria-label="Good response"
                                      onClick={() => handleFeedback(message.id, 'up')}
                                      title="Good response"
                                    >
                                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={messageFeedbackMap[message.id] === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                    <button 
                                      className={`p-2 rounded-full transition-colors ${messageFeedbackMap[message.id] === 'down' ? 'text-blue-600 bg-blue-50' : 'text-[#70757a] hover:bg-[#f1f3f4]'}`}
                                      aria-label="Bad response"
                                      onClick={() => handleFeedback(message.id, 'down')}
                                      title="Bad response"
                                    >
                                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={messageFeedbackMap[message.id] === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Related Questions */}
                              {relatedQuestions.length > 0 && (
                                <div className="mt-8 pt-4 border-t border-gray-100/50">
                                  <h4 
                                    className="text-sm font-medium mb-3 uppercase tracking-wider"
                                    style={{ 
                                      color: 'var(--google-text-secondary)',
                                      fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                                      fontSize: '11px'
                                    }}
                                  >
                                    Related Questions
                                  </h4>
                                  <div className="flex flex-col gap-2">
                                    {relatedQuestions.map((question, qIdx) => (
                                      <button 
                                        key={qIdx}
                                        onClick={() => {
                                          setFilteredSourceNumbers(null);
                                          setActiveMessageId(null);
                                          sendMessage({
                                            parts: [{ type: 'text', text: question }],
                                          });
                                        }}
                                        className="text-left py-3 px-4 rounded-xl transition-all duration-200 flex items-center group"
                                        style={{
                                          backgroundColor: 'var(--nvzc36, #f7f8fa)',
                                          color: 'var(--google-text)',
                                          fontFamily: 'Roboto, Arial, sans-serif',
                                          fontSize: '14px'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#e8eaed'; // darker gray on hover
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--nvzc36, #f7f8fa)';
                                        }}
                                      >
                                        <span className="flex-grow">{question}</span>
                                        <svg 
                                          className="w-4 h-4 ml-3 text-gray-400 group-hover:text-gray-600 transition-colors" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 该消息的 Sources - Google AI mode 风格 (.HWMcu) */}
                          {messageSources.length > 0 && (
                            <div 
                              className="flex-shrink-0" 
                              style={{ 
                                width: '372px',
                                maxHeight: '600px',
                                position: 'sticky',
                                top: '100px'
                              }}
                            >
                              <div 
                                className="flex flex-col overflow-hidden"
                                style={{
                                  background: 'var(--nvzc36, #f7f8fa)',
                                  borderRadius: '20px',
                                  boxShadow: 'none'
                                }}
                              >
                                {/* Header (.S1iSq) */}
                                <div style={{ padding: '16px 20px 8px' }}>
                                  <div 
                                    className="flex items-center justify-between"
                                    style={{
                                      alignItems: 'center',
                                      flexDirection: 'row',
                                      padding: '0',
                                      justifyContent: 'space-between'
                                    }}
                                  >
                                    <h4 
                                      className="flex items-center gap-2"
                                      style={{
                                        fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                                        fontSize: '16px',
                                        fontWeight: 500,
                                        lineHeight: '24px',
                                        color: 'var(--bbQxAb)'
                                      }}
                                    >
                                      Sources
                                      {(() => {
                                        const isClickFiltered = filteredSourceNumbers && filteredSourceNumbers.length > 0 && activeMessageId === message.id;
                                        
                                        if (isClickFiltered) {
                                          return (
                                            <span className="text-xs" style={{ color: 'var(--google-blue)' }}>
                                              ({filteredSourceNumbers.join(', ')})
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </h4>
                                    {filteredSourceNumbers && filteredSourceNumbers.length > 0 && activeMessageId === message.id && (
                                      <button
                                        onClick={() => {
                                          setFilteredSourceNumbers(null);
                                          setActiveMessageId(null);
                                        }}
                                        className="text-xs transition-colors px-2 py-1 rounded"
                                        style={{
                                          color: 'var(--google-text-secondary)',
                                          fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                                          backgroundColor: 'transparent',
                                          fontSize: '12px'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(60,64,67,0.08)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                        title="Clear filter"
                                      >
                                        Clear filter
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Sources list (.bTFeG) */}
                                <ul 
                                  className="flex flex-col list-none overflow-y-auto relative"
                                  style={{ 
                                    maxHeight: 'calc(85vh - 220px)',
                                    padding: '0',
                                    marginBottom: '12px',
                                    scrollbarColor: 'var(--gS5jXb) transparent',
                                    gap: 0
                                  }}
                                >
                                  {(() => {
                                    // 从 AI 回答中提取所有被引用的数字
                                    const citedNumbersForDisplay = extractCitedNumbers(mainContent);
                                    
                                    // 确定要显示的 sources
                                    let displaySources: SearchResult[];
                                    let sourceNumbers: number[];
                                    
                                    // 如果用户点击了某个引用链接，只显示该引用的来源
                                    if (filteredSourceNumbers && filteredSourceNumbers.length > 0 && activeMessageId === message.id) {
                                      displaySources = messageSources.filter((_, idx) => 
                                        filteredSourceNumbers.includes(idx + 1)
                                      );
                                      sourceNumbers = filteredSourceNumbers;
                                    } 
                                    // 否则，默认只显示被 AI 引用过的来源
                                    else if (citedNumbersForDisplay.length > 0) {
                                      displaySources = messageSources.filter((_, idx) => 
                                        citedNumbersForDisplay.includes(idx + 1)
                                      );
                                      sourceNumbers = citedNumbersForDisplay;
                                    }
                                    // 如果没有引用（理论上不应该发生），显示所有来源
                                    else {
                                      displaySources = messageSources.slice(0, 10);
                                      sourceNumbers = Array.from({ length: displaySources.length }, (_, i) => i + 1);
                                    }
                                    
                                    return displaySources.map((source, sourceIndex) => {
                                      const sourceNumber = sourceNumbers[sourceIndex];
                                      
                                      const getDomain = (url: string) => {
                                        try {
                                          return new URL(url).hostname;
                                        } catch {
                                          return source.displayLink || '';
                                        }
                                      };
                                      const domain = getDomain(source.link);
                                      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

                                      return (
                                        <li 
                                          key={sourceNumber}
                                          className="relative"
                                          style={{
                                            backgroundColor: 'transparent',
                                            borderRadius: 0
                                          }}
                                        >
                                          {/* Separator (.WEy4sd) */}
                                          {sourceIndex > 0 && (
                                            <div 
                                              style={{
                                                borderTop: '1px solid #f0f2f5',
                                                paddingBottom: '10px',
                                                paddingTop: '10px'
                                              }}
                                            />
                                          )}
                                          
                                          {/* Source item (.MFrAxb .BKnikc) */}
                                          <div 
                                            className="relative overflow-hidden"
                                            style={{
                                              padding: sourceIndex === 0 ? '12px 20px' : '0 20px 12px 20px'
                                            }}
                                          >
                                            <a
                                              href={source.link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              data-source-number={sourceNumber}
                                              className="flex relative"
                                              style={{
                                                textDecoration: 'none',
                                                zIndex: 0
                                              }}
                                            >
                                              {/* Content (.T5ny9d) */}
                                              <div 
                                                className="flex flex-col flex-1 relative"
                                                style={{
                                                  minHeight: 0,
                                                  overflow: 'hidden'
                                                }}
                                              >
                                                {/* Title (.Nn35F) */}
                                                <div 
                                                  className="line-clamp-2"
                                                  style={{
                                                    fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                                                    color: 'var(--jINu6c)',
                                                    fontSize: '14px',
                                                    lineHeight: '1.4',
                                                    margin: '0 0 4px',
                                                    fontWeight: 500,
                                                    textDecoration: 'none'
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.textDecoration = 'underline';
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.textDecoration = 'none';
                                                  }}
                                                >
                                                  {source.title}
                                                </div>
                                                
                                                {/* Snippet (.vhJ6Pe) */}
                                                <span 
                                                  className="line-clamp-2"
                                                  style={{
                                                    color: 'var(--IXoxUe)',
                                                    margin: '0 0 8px',
                                                    fontSize: '14px',
                                                    lineHeight: '1.3',
                                                    whiteSpace: 'normal',
                                                    overflow: 'hidden'
                                                  }}
                                                >
                                                  {source.snippet}
                                                </span>
                                                
                                                {/* Domain info (.w8lk7d) */}
                                                <div 
                                                  className="flex items-center"
                                                  style={{
                                                    alignSelf: 'flex-end',
                                                    marginRight: 'auto',
                                                    marginTop: 'auto',
                                                    width: '100%'
                                                  }}
                                                >
                                                  <div className="flex items-center justify-center rounded-full" style={{ width: '16px', height: '16px' }}>
                                                    <div 
                                                      className="flex items-center justify-center rounded-full"
                                                      style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        lineHeight: '100%',
                                                        backgroundColor: 'var(--TSWZIb)',
                                                        flexShrink: 0,
                                                        overflow: 'hidden'
                                                      }}
                                                    >
                                                      <Image
                                                        src={faviconUrl}
                                                        alt=""
                                                        width={16}
                                                        height={16}
                                                        className="rounded"
                                                        unoptimized
                                                        onError={(e) => {
                                                          e.currentTarget.style.display = 'none';
                                                        }}
                                                      />
                                                    </div>
                                                  </div>
                                                  <div 
                                                    className="flex flex-col overflow-hidden text-ellipsis whitespace-nowrap"
                                                    style={{
                                                      color: 'var(--IXoxUe)',
                                                      marginInlineStart: '8px'
                                                    }}
                                                  >
                                                    <span 
                                                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                                                      style={{
                                                        maxWidth: '200px',
                                                        color: 'var(--bbQxAb)',
                                                        fontSize: '12px',
                                                        fontWeight: 400,
                                                        letterSpacing: '0.1px',
                                                        lineHeight: '1.3'
                                                      }}
                                                    >
                                                      {source.displayLink}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </a>
                                          </div>
                                        </li>
                                      );
                                    });
                                  })()}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* 弹性空间 - 推动内容到顶部，底部留白 */}
              <div className="flex-grow" />
              
              {/* 滚动锚点 - 添加底部间距避开固定输入框 */}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </main>

        {/* 输入框 - Fixed at bottom - Google 风格 */}
        {messages.length > 0 && (
          <div 
            className="fixed bottom-0 left-0 right-0 backdrop-blur-sm z-10"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderTop: '1px solid var(--google-border)'
            }}
          >
            <div className="px-4 py-4 xl:ml-[182px]" style={{ maxWidth: '1140px' }}>
              <form onSubmit={handleFormSubmit} className="relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  disabled={status === 'streaming'}
                  className="w-full px-6 py-3 pr-14 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    border: '1px solid var(--google-border)',
                    backgroundColor: 'var(--google-bg)',
                    color: 'var(--google-text)',
                    fontFamily: 'Roboto, Arial, sans-serif',
                    fontSize: '14px',
                    borderRadius: '24px',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 6px rgba(32,33,36,.28)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget !== document.activeElement) {
                      e.currentTarget.style.boxShadow = '0 1px 6px rgba(32,33,36,.28)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (e.currentTarget !== document.activeElement) {
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={status === 'streaming' || !input.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: status === 'streaming' || !input.trim() ? 'transparent' : 'var(--google-blue)',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    if (!(status === 'streaming' || !input.trim())) {
                      e.currentTarget.style.backgroundColor = 'var(--google-blue-dark)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(status === 'streaming' || !input.trim())) {
                      e.currentTarget.style.backgroundColor = 'var(--google-blue)';
                    }
                  }}
                >
                  {status === 'streaming' ? (
                    <Loader size={18} className="text-blue-600" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </form>
              <p 
                className="text-xs text-center mt-2"
                style={{
                  color: 'var(--google-text-secondary)',
                  fontFamily: 'Roboto, Arial, sans-serif'
                }}
              >
                AI responses may include mistakes. Please verify important information.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* rrweb 录制器 */}
      <RRWebRecorder />
    </div>
  );
}
