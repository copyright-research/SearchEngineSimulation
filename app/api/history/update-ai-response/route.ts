import { NextRequest, NextResponse } from 'next/server';
import { updateSearchHistoryAIResponse } from '@/lib/db';
import type { SearchResult } from '@/types/search';

/**
 * 更新已有搜索历史的 AI Overview 文本
 * POST /api/history/update-ai-response
 *
 * Body: {
 *   historyId: number;
 *   aiResponse: string;
 *   results?: SearchResult[];
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { historyId, aiResponse, results } = body;

    if (!historyId || typeof aiResponse !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: historyId, aiResponse' },
        { status: 400 }
      );
    }

    if (results !== undefined && !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Invalid field: results must be an array when provided' },
        { status: 400 }
      );
    }

    await updateSearchHistoryAIResponse(
      historyId,
      aiResponse,
      Array.isArray(results) ? (results as SearchResult[]) : undefined
    );

    return NextResponse.json({
      success: true,
      message: 'AI response updated',
    });
  } catch (error) {
    console.error('Failed to update AI response:', error);
    return NextResponse.json(
      {
        error: 'Failed to update AI response',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
