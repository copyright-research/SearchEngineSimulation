'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  initialQuery?: string;
}

export default function SearchBar({ onSearch, isLoading, initialQuery = '' }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 键盘快捷键：按 / 聚焦搜索框
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        {/* 搜索图标 */}
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          {isLoading ? (
            <svg className="animate-spin h-5 w-5" style={{ color: 'var(--google-blue)' }} viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg
              className="w-5 h-5 transition-colors"
              style={{ color: 'var(--google-text-tertiary)' }}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          )}
        </div>
        
        {/* 搜索输入框 - Google 风格 */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything..."
          className="w-full pl-12 pr-12 py-3.5 text-base rounded-full transition-all duration-200 disabled:cursor-not-allowed"
          style={{
            border: '1px solid var(--google-border)',
            backgroundColor: 'var(--google-bg)',
            color: 'var(--google-text)',
            fontFamily: 'Roboto, Arial, sans-serif',
            fontSize: '16px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 6px rgba(32,33,36,.28)';
            e.currentTarget.style.borderColor = 'transparent';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = 'var(--google-border)';
          }}
          onMouseEnter={(e) => {
            if (document.activeElement !== e.currentTarget) {
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(32,33,36,.28)';
            }
          }}
          onMouseLeave={(e) => {
            if (document.activeElement !== e.currentTarget) {
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
          disabled={isLoading}
        />

        {/* 清除按钮 */}
        {query && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-4 flex items-center transition-colors"
            style={{ color: 'var(--google-text-tertiary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--google-text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--google-text-tertiary)';
            }}
            aria-label="Clear search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
