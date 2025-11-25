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
        return null;
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
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch (parseError) {
          errorDetails = { 
            status: response.status,
            statusText: response.statusText,
            text: await response.text().catch(() => '')
          };
        }
        console.error('Failed to save search history:', errorDetails);
        return null;
      }

      const data = await response.json();
      console.log('Search history saved:', data);
      return data.searchHistoryId as number;
    } catch (error) {
      console.error('Failed to save search history:', error);
      return null;
    }
  }, []);

  const reportFeedback = useCallback(async (
    historyId: number,
    feedback: 'up' | 'down' | null
  ) => {
    try {
      const response = await fetch('/api/history/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          historyId,
          feedback,
        }),
      });

      if (!response.ok) {
        console.error('Failed to save feedback');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to save feedback:', error);
      return false;
    }
  }, []);

  return { saveSearchHistory, reportFeedback };
}
