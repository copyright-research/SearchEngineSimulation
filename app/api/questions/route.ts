import { NextRequest, NextResponse } from 'next/server';
import { getVerificationQuestions, saveUserAnswer, getUserAnswerStats } from '@/lib/db-adapter';

/**
 * 获取验证问题
 * GET /api/questions?rid=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rid = searchParams.get('rid');

    if (!rid) {
      return NextResponse.json(
        { error: 'Missing required parameter: rid' },
        { status: 400 }
      );
    }

    // 获取未回答的问题
    const questions = await getVerificationQuestions(rid);

    // 获取答题统计
    const stats = await getUserAnswerStats(rid);

    return NextResponse.json({
      success: true,
      questions,
      stats,
    });
  } catch (error) {
    console.error('Failed to get verification questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get verification questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 提交答案
 * POST /api/questions
 * 
 * Body: {
 *   rid: string;
 *   questionId: number;
 *   answer: number;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rid, questionId, answer } = body;

    // 验证参数
    if (!rid || questionId === undefined || answer === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: rid, questionId, answer' },
        { status: 400 }
      );
    }

    // 验证答案范围
    if (typeof answer !== 'number' || answer < 0 || answer > 3) {
      return NextResponse.json(
        { error: 'Invalid answer. Must be a number between 0 and 3' },
        { status: 400 }
      );
    }

    // 保存答案
    const result = await saveUserAnswer(rid, questionId, answer);

    return NextResponse.json({
      success: true,
      isCorrect: result.is_correct,
      correctAnswer: result.correct_answer,
    });
  } catch (error) {
    console.error('Failed to save user answer:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save user answer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

