'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import SearchResults from '@/components/SearchResults';
import AIOverview from '@/components/AIOverview';
import type { GoogleSearchResponse, SearchResult } from '@/types/search';
import { RRWebRecorder } from '@/components/RRWebRecorder';
import { useSearchHistory } from '@/lib/use-search-history';

function HomeContent() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<{
    searchTime?: number;
    totalResults?: string;
  }>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  
  // 从 URL 参数读取是否显示 AI Overview，默认显示
  const [showAIOverview, setShowAIOverview] = useState(true);
  
  // 搜索历史保存
  const { saveSearchHistory } = useSearchHistory();
  
  useEffect(() => {
    // 大小写不敏感获取 ai 参数
    let aiParam: string | null = null;
    for (const [key, value] of searchParams.entries()) {
      if (key.toLowerCase() === 'ai') {
        aiParam = value;
        break;
      }
    }
    // ai=0 或 ai=false 时隐藏，其他情况（包括未设置）都显示
    if (aiParam === '0' || aiParam === 'false') {
      setShowAIOverview(false);
    } else {
      setShowAIOverview(true);
    }
  }, [searchParams]);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentQuery(query);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data: GoogleSearchResponse = await response.json();
      
      const searchResults = data.items || [];
      setResults(searchResults);
      setSearchInfo({
        searchTime: data.searchInformation?.searchTime,
        totalResults: data.searchInformation?.formattedTotalResults,
      });

      // 保存搜索历史（异步，不阻塞UI）
      if (searchResults.length > 0) {
        const mode = showAIOverview ? 'search_with_overview' : 'search';
        saveSearchHistory(query, mode, searchResults).catch(err => {
          console.error('Failed to save search history:', err);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed, please try again later');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50">
      {/* 背景装饰 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <main className="container mx-auto px-4 relative">
        {/* Header */}
        <header className={`transition-all duration-500 ${hasSearched ? 'pt-8 pb-6' : 'pt-32 pb-12'}`}>
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <h1 className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 transition-all duration-500 ${hasSearched ? 'text-3xl' : 'text-6xl'}`}>
                ReSearch
              </h1>
              {!hasSearched && (
                <a
                  href="/ai"
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105"
                >
                  Try AI Mode
                </a>
              )}
            </div>
            {!hasSearched && (
              <p className="mt-4 text-gray-600 text-lg animate-fade-in">
                Fast, accurate, and elegant search experience
              </p>
            )}
          </div>
          
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </header>

        {/* AI Overview */}
        {showAIOverview && hasSearched && !isLoading && !error && results.length > 0 && (
          <AIOverview 
            query={currentQuery} 
            results={results}
            onAIResponseComplete={(aiResponse) => {
              // 当AI回答完成时，保存带有AI回答的搜索历史
              saveSearchHistory(currentQuery, 'search_with_overview', results, aiResponse).catch(err => {
                console.error('Failed to save AI response:', err);
              });
            }}
          />
        )}

        {/* Search Results */}
        {hasSearched && (
          <SearchResults
            results={results}
            searchTime={searchInfo.searchTime}
            totalResults={searchInfo.totalResults}
            isLoading={isLoading}
            error={error || undefined}
          />
        )}

        {/* Footer */}
        {!hasSearched && (
          <footer className="absolute bottom-8 left-0 right-0 text-center text-sm text-gray-500">
            <p>
              Tip: Press <kbd className="px-2 py-1 bg-white/80 backdrop-blur-sm rounded border border-gray-300 shadow-sm text-xs font-mono">/</kbd> to focus search
            </p>
          </footer>
        )}
      </main>
      
      {/* rrweb 录屏 */}
      <RRWebRecorder />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}