import { NextRequest, NextResponse } from 'next/server';
import { updateSearchHistoryFeedback } from '@/lib/db';

/**
 * 保存用户反馈
 * POST /api/history/feedback
 * 
 * Body: {
 *   historyId: number;
 *   feedback: 'up' | 'down' | null;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { historyId, feedback } = body;

    if (!historyId) {
      return NextResponse.json(
        { error: 'Missing required field: historyId' },
        { status: 400 }
      );
    }

    if (feedback !== null && !['up', 'down'].includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback value' },
        { status: 400 }
      );
    }

    await updateSearchHistoryFeedback(historyId, feedback);

    return NextResponse.json({
      success: true,
      message: 'Feedback saved',
    });
  } catch (error) {
    console.error('Failed to save feedback:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


