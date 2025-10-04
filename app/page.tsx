'use client';

import { useState } from 'react';
import SearchBar from '@/components/SearchBar';
import SearchResults from '@/components/SearchResults';
import type { GoogleSearchResponse, SearchResult } from '@/types/search';

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<{
    searchTime?: number;
    totalResults?: string;
  }>({});
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data: GoogleSearchResponse = await response.json();
      
      setResults(data.items || []);
      setSearchInfo({
        searchTime: data.searchInformation?.searchTime,
        totalResults: data.searchInformation?.formattedTotalResults,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败，请稍后重试');
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
            <h1 className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 transition-all duration-500 ${hasSearched ? 'text-3xl' : 'text-6xl'}`}>
              Copyright Search
            </h1>
            {!hasSearched && (
              <p className="mt-4 text-gray-600 text-lg animate-fade-in">
                快速、精准、优雅的搜索体验
              </p>
            )}
          </div>
          
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </header>

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
              提示: 按 <kbd className="px-2 py-1 bg-white/80 backdrop-blur-sm rounded border border-gray-300 shadow-sm text-xs font-mono">/</kbd> 快速聚焦搜索框
            </p>
          </footer>
        )}
      </main>
    </div>
  );
}