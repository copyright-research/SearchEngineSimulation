'use client';

import type { SearchResult } from '@/types/search';
import Image from 'next/image';
import { useState } from 'react';

interface SearchResultsProps {
  results: SearchResult[];
  searchTime?: number;
  totalResults?: string;
  isLoading?: boolean;
  error?: string;
}

export default function SearchResults({
  results,
  searchTime,
  totalResults,
  isLoading,
  error,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-8 space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Search error: {error}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-8 text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
        <p className="mt-1 text-sm text-gray-500">Try different keywords</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 mb-12">
      {searchTime && totalResults && (
        <div className="text-sm text-gray-500 mb-6 px-2">
          About <span className="font-medium text-gray-700">{totalResults}</span> results
          <span className="text-gray-400"> · </span>
          {searchTime.toFixed(2)} seconds
        </div>
      )}

      <div className="space-y-4">
        {results.map((result, index) => (
          <SearchResultItem key={index} result={result} index={index} />
        ))}
      </div>
    </div>
  );
}

function SearchResultItem({ result, index }: { result: SearchResult; index: number }) {
  const [imgError, setImgError] = useState(false);
  const thumbnail = result.pagemap?.cse_thumbnail?.[0];
  
  // 获取网站 favicon
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(result.link);

  return (
    <article 
      className="group p-4 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-md border border-transparent hover:border-gray-200"
      style={{
        animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`,
      }}
    >
      <div className="flex gap-4">
        {/* 左侧：内容 */}
        <div className="flex-1 min-w-0">
          {/* 网站信息 */}
          <div className="flex items-center gap-2 mb-2">
            {faviconUrl && (
              <Image
                src={faviconUrl}
                alt=""
                width={16}
                height={16}
                className="rounded-sm"
                unoptimized
              />
            )}
            {result.displayLink && (
              <span className="text-sm font-medium text-gray-700">
                {result.displayLink}
              </span>
            )}
          </div>
          
          {/* 标题 */}
          <a
            href={result.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block group/link"
          >
            <h2 className="text-xl text-blue-600 group-hover/link:text-blue-800 group-hover/link:underline font-normal mb-2 line-clamp-2 leading-snug">
              {result.title}
            </h2>
          </a>
          
          {/* 摘要 */}
          <p className="text-sm text-gray-600 line-clamp-3 mb-2 leading-relaxed">
            {result.snippet}
          </p>
          
          {/* URL */}
          {result.formattedUrl && (
            <div className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="truncate">{result.formattedUrl}</span>
            </div>
          )}
        </div>

        {/* 右侧：缩略图（如果有） */}
        {thumbnail && !imgError && (
          <div className="flex-shrink-0 w-28 h-28 relative rounded-lg overflow-hidden bg-gray-100 group-hover:shadow-lg transition-shadow">
            <Image
              src={thumbnail.src}
              alt={result.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="112px"
              onError={() => setImgError(true)}
            />
          </div>
        )}
      </div>
    </article>
  );
}
