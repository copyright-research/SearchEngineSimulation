import { NextRequest, NextResponse } from 'next/server';
import { saveSearchHistory, saveVerificationQuestions } from '@/lib/db';
import { generateVerificationQuestions } from '@/lib/question-generator';
import type { SearchResult } from '@/types/search';

/**
 * 保存搜索历史并生成验证问题
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

    // 异步生成验证问题（不阻塞响应）
    generateAndSaveQuestions(
      rid,
      query,
      results,
      aiResponse,
      mode
    ).catch(error => {
      console.error('Failed to generate questions in background:', error);
    });

    return NextResponse.json({
      success: true,
      searchHistoryId: searchHistory.id,
      message: 'Search history saved. Questions are being generated in the background.',
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

/**
 * 后台生成并保存验证问题
 */
async function generateAndSaveQuestions(
  rid: string,
  query: string,
  results: SearchResult[],
  aiResponse: string | undefined,
  mode: string
) {
  try {
    console.log(`Generating questions for RID: ${rid}, mode: ${mode}`);
    
    // 生成问题
    const questionsResponse = await generateVerificationQuestions(
      query,
      results,
      aiResponse,
      mode
    );

    // 保存到数据库
    await saveVerificationQuestions(
      rid,
      questionsResponse.questions
    );

    console.log(`Generated and saved ${questionsResponse.questions.length} questions for RID: ${rid}`);
  } catch (error) {
    console.error('Failed to generate and save questions:', error);
    throw error;
  }
}

