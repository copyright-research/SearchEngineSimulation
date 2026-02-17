import { NextRequest, NextResponse } from 'next/server';
import { saveSearchHistory } from '@/lib/db';

/**
 * 保存搜索历史
 * POST /api/history/save
 *
 * Body: {
 *   rid: string;
 *   query: string;
 *   mode: 'ai' | 'search' | 'search_with_overview';
 *   results: SearchResult[];
 *   aiResponse?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rid, query, mode, results, aiResponse } = body;

    // 验证必需参数
    if (!rid || !query || !mode || !results) {
      return NextResponse.json(
        { error: 'Missing required fields: rid, query, mode, results' },
        { status: 400 }
      );
    }

    // 验证 mode
    if (!['ai', 'search', 'search_with_overview'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be one of: ai, search, search_with_overview' },
        { status: 400 }
      );
    }

    // 保存搜索历史
    const searchHistory = await saveSearchHistory(
      rid,
      query,
      mode,
      results,
      aiResponse
    );

    return NextResponse.json({
      success: true,
      searchHistoryId: searchHistory.id,
      message: 'Search history saved.',
    });
  } catch (error) {
    console.error('Failed to save search history:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save search history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
