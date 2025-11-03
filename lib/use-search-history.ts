import { useCallback } from 'react';
import { getUrlParamCaseInsensitive } from './url-utils';
import type { SearchResult } from '@/types/search';

/**
 * Hook for saving search history and triggering question generation
 */
export function useSearchHistory() {
  const saveSearchHistory = useCallback(async (
    query: string,
    mode: 'ai' | 'search' | 'search_with_overview',
    results: SearchResult[],
    aiResponse?: string
  ) => {
    try {
      // 获取 RID
      const rid = getUrlParamCaseInsensitive('rid');
      if (!rid) {
        console.log('No RID found, skipping search history save');
        return;
      }

      // 保存搜索历史
      const response = await fetch('/api/history/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rid,
          query,
          mode,
          results,
          aiResponse,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to save search history:', error);
        return;
      }

      const data = await response.json();
      console.log('Search history saved:', data);
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, []);

  return { saveSearchHistory };
}

