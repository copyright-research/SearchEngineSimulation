'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Image from 'next/image';
import Link from 'next/link';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import type { SearchResult } from '@/types/search';

export default function AIModePage() {
  // 为每条消息存储对应的 sources（使用消息 ID 作为 key）
  const [messageSourcesMap, setMessageSourcesMap] = useState<Record<string, SearchResult[]>>({});
  const [currentSources, setCurrentSources] = useState<SearchResult[]>([]);
  const [filteredSourceNumbers, setFilteredSourceNumbers] = useState<number[] | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null); // 追踪哪个消息的引用被点击了
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    }),
    onFinish: async (options) => {
      console.log('Message finished:', options.message);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  const [input, setInput] = useState('');

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userInput = input;

    // 重置过滤状态
    setFilteredSourceNumbers(null);
    setActiveMessageId(null);

    // 发送消息给 AI（AI SDK 5 格式）
    sendMessage({
      parts: [{ type: 'text', text: userInput }],
    });
    
    setInput(''); // 清空输入框

    // 同时获取搜索结果，并在收到后关联到即将生成的 AI 消息
    fetchSourcesForQuery(userInput);
  };

  // 获取搜索结果作为 sources
  const fetchSourcesForQuery = async (query: string) => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          // 设置为当前显示的 sources
          setCurrentSources(data.items);
          
          // 等待下一条 AI 消息生成后，将 sources 关联到该消息
          // 这个会在 useEffect 中处理
        }
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  };

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 当消息更新时滚动到底部（仅在 AI 正在回复时）
  useEffect(() => {
    // 只在 streaming 状态下自动滚动，这样可以让新消息保持在顶部
    if (status === 'streaming') {
      scrollToBottom();
    }
  }, [messages, status]);

  // 当有新的 AI 消息时，关联 sources
  useEffect(() => {
    if (messages.length > 0 && currentSources.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // 只为 assistant 消息关联 sources，且该消息还没有关联过
      if (lastMessage.role === 'assistant' && !messageSourcesMap[lastMessage.id]) {
        setMessageSourcesMap((prev) => ({
          ...prev,
          [lastMessage.id]: currentSources,
        }));
      }
    }
  }, [messages, currentSources, messageSourcesMap]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50">
      {/* 背景装饰 - 复用主页的 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <header className="pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
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
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                AI Mode
              </h1>
            </div>
            <Link 
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Switch to Search
            </Link>
          </div>
        </header>

        {/* Main Chat Area */}
        <main className="py-6 pb-32 min-h-[calc(100vh-180px)] flex flex-col">
          {messages.length === 0 ? (
            // 欢迎界面
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                Ask me anything
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
                I&apos;ll search the web and provide you with accurate, cited answers.
              </p>
              
              {/* 示例问题 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
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
                      fetchSourcesForQuery(example);
                      sendMessage({
                        parts: [{ type: 'text', text: example }],
                      });
                    }}
                    className="p-4 text-left text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // 对话界面 - 使用 flex-grow 让内容从顶部开始，底部留白
            <div className="max-w-6xl mx-auto w-full flex-grow flex flex-col">
              {/* 消息列表 */}
              <div className="space-y-6 mb-6 flex-shrink-0 w-full">
                {messages.map((message, index) => {
                  // 提取文本内容
                  const textContent = message.parts
                    .filter((part) => part.type === 'text')
                    .map((part) => ('text' in part ? part.text : ''))
                    .join('');

                  // 获取该消息对应的 sources
                  const messageSources = message.role === 'assistant' 
                    ? messageSourcesMap[message.id] || []
                    : [];

                  return (
                    <div key={message.id} className="animate-fade-in">
                      {message.role === 'user' ? (
                        // 用户消息
                        <div className="flex justify-end">
                          <div className="max-w-[80%] px-4 py-3 bg-blue-500 text-white rounded-2xl rounded-tr-sm">
                            <p className="text-sm">{textContent}</p>
                          </div>
                        </div>
                      ) : (
                        // AI 回答 - 复用 AIOverview 的样式
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* AI 回答内容 */}
                          <div className="lg:col-span-2">
                            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-lg overflow-hidden">
                              {/* Header */}
                              <div className="flex items-center gap-3 p-4 border-b border-blue-200 dark:border-blue-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Answer</h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Powered by Google AI</p>
                                </div>
                              </div>
                              
                              {/* Content - 复用 Response 组件 */}
                              <div className="p-6">
                                <Response
                                  onCitationClick={(numbers) => {
                                    console.log('Citation clicked:', numbers, 'for message:', message.id);
                                    console.log('Current message sources:', messageSources);
                                    // 更新当前显示的 sources 为该消息的 sources
                                    setActiveMessageId(message.id);
                                    setCurrentSources(messageSources);
                                    setFilteredSourceNumbers(numbers);
                                  }}
                                >
                                  {textContent}
                                </Response>
                                
                                {/* Loading 指示器 */}
                                {status === 'streaming' && index === messages.length - 1 && (
                                  <span className="inline-flex items-center ml-2">
                                    <Loader size={14} className="text-blue-600 dark:text-blue-400" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 该消息的 Sources */}
                          {messageSources.length > 0 && (
                            <div className="lg:col-span-1">
                              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
                                <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                      Sources
                                      {(() => {
                                        const citedNumbers = extractCitedNumbers(textContent);
                                        const isClickFiltered = filteredSourceNumbers && filteredSourceNumbers.length > 0 && activeMessageId === message.id;
                                        
                                        if (isClickFiltered) {
                                          return (
                                            <span className="text-[10px] text-blue-600 dark:text-blue-400">
                                              ({filteredSourceNumbers.join(', ')})
                                            </span>
                                          );
                                        } else if (citedNumbers.length > 0) {
                                          return (
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                              (Cited only)
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
                                        className="text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                                        title="Show cited sources only"
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                                  {(() => {
                                    // 从 AI 回答中提取所有被引用的数字
                                    const citedNumbers = extractCitedNumbers(textContent);
                                    
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
                                    else if (citedNumbers.length > 0) {
                                      displaySources = messageSources.filter((_, idx) => 
                                        citedNumbers.includes(idx + 1)
                                      );
                                      sourceNumbers = citedNumbers;
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
                                        <a
                                          key={sourceNumber}
                                          href={source.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          data-source-number={sourceNumber}
                                          className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                                        >
                                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                                            {sourceNumber}
                                          </span>
                                          <div className="flex-1 min-w-0 flex items-start gap-1.5">
                                            <Image
                                              src={faviconUrl}
                                              alt=""
                                              width={14}
                                              height={14}
                                              className="rounded flex-shrink-0 mt-0.5"
                                              unoptimized
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 line-clamp-2 leading-tight">
                                                {source.title}
                                              </p>
                                              <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate mt-0.5">
                                                {source.displayLink}
                                              </p>
                                            </div>
                                          </div>
                                          <svg className="flex-shrink-0 w-3 h-3 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                      );
                                    });
                                  })()}
                                </div>
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
              
              {/* 滚动锚点 */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* 输入框 - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 z-10">
          <div className="container mx-auto px-4 py-4 max-w-4xl">
            <form onSubmit={handleFormSubmit} className="relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={status === 'streaming'}
                className="w-full px-6 py-4 pr-14 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                autoFocus
              />
              <button
                type="submit"
                disabled={status === 'streaming' || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === 'streaming' ? (
                  <Loader size={20} className="text-white" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              AI responses may include mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

