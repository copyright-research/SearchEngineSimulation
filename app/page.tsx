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
  const [currentPage, setCurrentPage] = useState(1);
  
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

  const handleSearch = async (query: string, page: number = 1) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentQuery(query);
    setCurrentPage(page);

    try {
      // Google API 使用 start 参数分页，每页 10 条结果
      const start = (page - 1) * 10 + 1;
      const url = `/api/search?q=${encodeURIComponent(query)}${start > 1 ? `&start=${start}` : ''}`;
      const response = await fetch(url);
      
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

      // 保存搜索历史（异步，不阻塞UI）- 只在第一页保存
      if (searchResults.length > 0 && page === 1) {
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

  const handlePageChange = (page: number) => {
    if (currentQuery) {
      handleSearch(currentQuery, page);
      // 滚动到顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--google-bg)' }}>
      <main className={`px-4 relative ${hasSearched ? 'max-w-none' : 'container mx-auto'}`}>
        {/* Header */}
        <header className={`transition-all duration-300 ${hasSearched ? 'pt-4 pb-4' : 'pt-40 pb-8'}`}>
          {hasSearched ? (
            /* Google 搜索结果页面布局：Logo 和 SearchBar 在同一行 */
            <div className="flex items-center gap-8 mb-4" style={{ maxWidth: '1140px' }}>
              {/* Logo - 左侧 */}
              <a href="/" className="flex-shrink-0">
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
                </h1>
              </a>
              
              {/* SearchBar - 右侧，占据剩余空间 */}
              <div className="flex-1" style={{ maxWidth: '692px' }}>
                <SearchBar onSearch={handleSearch} isLoading={isLoading} />
              </div>
            </div>
          ) : (
            /* 首页布局：居中 */
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-3">
                {/* Google-style logo */}
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
                </h1>
                <a
                  href="/ai"
                  className="px-4 py-2 text-sm font-medium rounded transition-colors"
                  style={{
                    backgroundColor: 'var(--google-blue)',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--google-blue-dark)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--google-blue)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Try AI Mode
                </a>
              </div>
              
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            </div>
          )}
        </header>

        {/* 内容区域 - 与 SearchBar 左对齐 */}
        <div style={{ marginLeft: hasSearched ? '182px' : '0' }}>
          {/* AI Overview - 只在第一页显示 */}
          {showAIOverview && currentPage === 1 && hasSearched && !isLoading && !error && results.length > 0 && (
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
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}
        </div>

        {/* Footer */}
        {!hasSearched && (
          <footer className="absolute bottom-8 left-0 right-0 text-center text-sm" style={{ color: 'var(--google-text-secondary)' }}>
            <p>
              Tip: Press <kbd className="px-2 py-1 rounded border text-xs font-mono" style={{
                backgroundColor: 'var(--google-bg-secondary)',
                borderColor: 'var(--google-border)',
                color: 'var(--google-text)'
              }}>/</kbd> to focus search
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--google-bg)' }}>
        <div style={{ color: 'var(--google-text-secondary)' }}>Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}