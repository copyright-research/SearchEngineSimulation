import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { list } from '@/lib/r2-storage';
import { getParamCaseInsensitive } from '@/lib/url-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isReplayAuthenticated(request: NextRequest): boolean {
  const validToken = process.env.REPLAY_AUTH_TOKEN;
  if (!validToken) {
    return false;
  }

  const authCookie = request.cookies.get('replay-auth');
  return authCookie?.value === validToken;
}

async function listAllR2Objects(prefix: string) {
  const allBlobs: Array<{
    pathname: string;
    size: number;
    uploadedAt?: Date;
    url: string;
  }> = [];

  let cursor: string | undefined;
  do {
    const page = await list({
      prefix,
      limit: 1000,
      cursor,
    });
    allBlobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return allBlobs;
}

/**
 * 按 RID 导出打包清单（用于前端在浏览器端并行下载并生成 ZIP）
 * GET /api/replay/export-rid?rid=xxx
 */
export async function GET(request: NextRequest) {
  try {
    if (!isReplayAuthenticated(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rid = getParamCaseInsensitive(searchParams, 'rid');

    if (!rid) {
      return NextResponse.json(
        { error: 'Missing required parameter: rid' },
        { status: 400 }
      );
    }

    const startedAt = new Date().toISOString();
    const session = await prisma.searchSession.findUnique({
      where: { rid },
    });

    const sessionId = session?.id ?? null;

    const [searchHistoryRows, verificationQuestionRows, userAnswerRows] = sessionId
      ? await Promise.all([
          prisma.searchHistory.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.verificationQuestion.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.userAnswer.findMany({
            where: { sessionId },
            orderBy: { answeredAt: 'asc' },
            include: {
              question: {
                select: {
                  question: true,
                  correctAnswer: true,
                },
              },
            },
          }),
        ])
      : [[], [], []];

    const prefix = `recordings/${rid}/`;
    const r2Blobs = await listAllR2Objects(prefix);
    const totalR2BytesListed = r2Blobs.reduce((sum, blob) => sum + (blob.size || 0), 0);
    const r2Objects = r2Blobs.map((blob) => ({
      key: blob.pathname,
      size: blob.size || 0,
      uploadedAt: blob.uploadedAt ? new Date(blob.uploadedAt).toISOString() : null,
    }));

    const payload = {
      rid,
      startedAt,
      finishedAt: new Date().toISOString(),
      generatedBy: 'api/replay/export-rid',
      sql: {
        sessionId,
        missingSession: !session,
        tables: [
          {
            table: 'search_sessions',
            file: 'sql/search_sessions.json',
            filter: { rid },
            rowCount: session ? 1 : 0,
            rows: session ? [session] : [],
          },
          {
            table: 'search_history',
            file: 'sql/search_history.json',
            filter: { sessionId },
            rowCount: searchHistoryRows.length,
            rows: searchHistoryRows,
          },
          {
            table: 'verification_questions',
            file: 'sql/verification_questions.json',
            filter: { sessionId },
            rowCount: verificationQuestionRows.length,
            rows: verificationQuestionRows,
          },
          {
            table: 'user_answers',
            file: 'sql/user_answers.json',
            filter: { sessionId },
            rowCount: userAnswerRows.length,
            rows: userAnswerRows,
          },
        ],
      },
      r2: {
        prefix,
        listedBytes: totalR2BytesListed,
        matchedObjects: r2Objects.length,
        objects: r2Objects,
      },
    };
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[replay] Export RID bundle error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export rid bundle',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
