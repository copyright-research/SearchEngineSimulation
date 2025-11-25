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
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export default function SearchResults({
  results,
  searchTime,
  totalResults,
  isLoading,
  error,
  currentPage = 1,
  onPageChange,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="w-full mt-6 space-y-6" style={{ maxWidth: '652px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 rounded w-3/4 mb-2" style={{ backgroundColor: 'var(--google-bg-secondary)' }}></div>
            <div className="h-3 rounded w-1/2 mb-3" style={{ backgroundColor: 'var(--google-bg-secondary)' }}></div>
            <div className="space-y-2">
              <div className="h-3 rounded" style={{ backgroundColor: 'var(--google-bg-secondary)' }}></div>
              <div className="h-3 rounded w-5/6" style={{ backgroundColor: 'var(--google-bg-secondary)' }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mt-6" style={{ maxWidth: '652px' }}>
        <div className="border-l-4 p-4 rounded" style={{
          backgroundColor: '#fce8e6',
          borderColor: '#d93025'
        }}>
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5" style={{ color: '#d93025' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm" style={{ color: '#5f6368' }}>
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
      <div className="w-full mt-6 text-center py-12" style={{ maxWidth: '652px' }}>
        <svg
          className="mx-auto h-12 w-12"
          style={{ color: 'var(--google-text-tertiary)' }}
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
        <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--google-text)' }}>No results found</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--google-text-secondary)' }}>Try different keywords</p>
      </div>
    );
  }

  // 计算总页数（Google API 最多返回 100 个结果，即 10 页）
  const getTotalPages = () => {
    if (!totalResults) return 1;
    // 移除逗号并解析数字
    const total = parseInt(totalResults.replace(/,/g, ''), 10);
    if (isNaN(total)) return 1;
    // Google CSE 最多返回 100 个结果（10 页）
    return Math.min(Math.ceil(total / 10), 10);
  };

  const totalPages = getTotalPages();

  return (
    <div className="w-full mt-6 mb-12" style={{ maxWidth: '652px' }}>
      {searchTime && totalResults && (
        <div className="text-sm mb-4 px-1" style={{ color: 'var(--google-text-secondary)' }}>
          About <span style={{ color: 'var(--google-text)' }}>{totalResults}</span> results
          <span style={{ color: 'var(--google-text-tertiary)' }}> ({searchTime.toFixed(2)} seconds)</span>
        </div>
      )}

      <div className="space-y-8">
        {results.map((result, index) => (
          <SearchResultItem key={index} result={result} index={index} />
        ))}
      </div>

      {/* 分页控件 */}
      {!isLoading && !error && results.length > 0 && onPageChange && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
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
      className="search-result-item group"
      data-result-index={index + 1}
      style={{
        animation: `fadeInUp 0.3s ease-out ${index * 0.03}s both`,
        paddingBottom: '20px',
        borderBottom: '1px solid var(--google-border)',
        marginBottom: '20px'
      }}
    >
      <div className="flex gap-4">
        {/* 左侧：内容 */}
        <div className="flex-1 min-w-0">
          {/* 网站信息和 URL */}
          <div className="flex items-center gap-2 mb-1">
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
            <div className="flex flex-col">
              {result.displayLink && (
                <span className="text-sm" style={{ color: 'var(--google-text)' }}>
                  {result.displayLink}
                </span>
              )}
              {result.formattedUrl && (
                <span className="text-xs truncate" style={{ color: 'var(--google-text-secondary)' }}>
                  {result.formattedUrl}
                </span>
              )}
            </div>
          </div>
          
          {/* 标题 */}
          <a
            href={result.link}
            target="_blank"
            rel="noopener noreferrer"
            className="search-result-link block group/link"
            data-result-index={index + 1}
            data-result-title={result.title}
          >
            <h2 
              className="text-xl font-normal mb-1 line-clamp-2 leading-snug"
              style={{ 
                color: 'var(--google-link)',
                fontFamily: 'Roboto, Arial, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {result.title}
            </h2>
          </a>
          
          {/* 摘要 */}
          <p 
            className="text-sm line-clamp-2 leading-relaxed"
            style={{ color: 'var(--google-text-secondary)' }}
          >
            {result.snippet}
          </p>
        </div>

        {/* 右侧：缩略图（如果有） */}
        {thumbnail && !imgError && (
          <div 
            className="flex-shrink-0 w-24 h-24 relative rounded overflow-hidden"
            style={{ backgroundColor: 'var(--google-bg-secondary)' }}
          >
            <Image
              src={thumbnail.src}
              alt={result.title}
              fill
              className="object-cover"
              sizes="96px"
              onError={() => setImgError(true)}
            />
          </div>
        )}
      </div>
    </article>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // 生成页码数组（Google 风格：显示当前页前后各几页）
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 10;

    if (totalPages <= maxPagesToShow) {
      // 如果总页数少于等于 10，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 总是显示第一页
      pages.push(1);

      let startPage = Math.max(2, currentPage - 3);
      let endPage = Math.min(totalPages - 1, currentPage + 3);

      // 调整范围以保证显示足够的页码
      if (currentPage <= 4) {
        endPage = Math.min(8, totalPages - 1);
      } else if (currentPage >= totalPages - 3) {
        startPage = Math.max(2, totalPages - 7);
      }

      if (startPage > 2) {
        pages.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages - 1) {
        pages.push('...');
      }

      // 总是显示最后一页
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav 
      className="flex items-center justify-start gap-2 mt-8 pt-8"
      style={{ borderTop: '1px solid var(--google-border)' }}
      aria-label="Pagination"
    >
      {/* 上一页按钮 */}
      {currentPage > 1 && (
        <button
          onClick={() => onPageChange(currentPage - 1)}
          className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
          style={{
            color: 'var(--google-blue)',
            fontFamily: 'Roboto, Arial, sans-serif',
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--google-bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Previous page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Previous</span>
        </button>
      )}

      {/* 页码按钮 */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2"
                style={{ color: 'var(--google-text-secondary)' }}
              >
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isCurrentPage = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              onClick={() => !isCurrentPage && onPageChange(pageNum)}
              className="min-w-[40px] h-10 rounded-full transition-colors"
              style={{
                backgroundColor: isCurrentPage ? 'var(--google-blue)' : 'transparent',
                color: isCurrentPage ? '#ffffff' : 'var(--google-blue)',
                fontFamily: 'Roboto, Arial, sans-serif',
                fontSize: '14px',
                fontWeight: isCurrentPage ? 700 : 400,
                cursor: isCurrentPage ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isCurrentPage) {
                  e.currentTarget.style.backgroundColor = 'var(--google-bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrentPage) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              disabled={isCurrentPage}
              aria-label={`Page ${pageNum}`}
              aria-current={isCurrentPage ? 'page' : undefined}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* 下一页按钮 */}
      {currentPage < totalPages && (
        <button
          onClick={() => onPageChange(currentPage + 1)}
          className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors"
          style={{
            color: 'var(--google-blue)',
            fontFamily: 'Roboto, Arial, sans-serif',
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--google-bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Next page"
        >
          <span>Next</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </nav>
  );
}
