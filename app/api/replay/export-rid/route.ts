import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { list, get } from '@/lib/r2-storage';
import { getParamCaseInsensitive } from '@/lib/url-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isReplayAuthenticated(request: NextRequest): boolean {
  const validToken = process.env.REPLAY_AUTH_TOKEN;
  if (!validToken) {
    return true;
  }

  const authCookie = request.cookies.get('replay-auth');
  return authCookie?.value === validToken;
}

function sanitizeFileSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'rid';
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
 * 按 RID 导出完整数据包（SQL + R2）
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

    let totalR2Bytes = 0;
    const r2Objects: Array<{
      key: string;
      size: number;
      uploadedAt: string | null;
      contentType: string | null;
      body: string;
    }> = [];

    for (let i = 0; i < r2Blobs.length; i++) {
      const blob = r2Blobs[i];
      const file = await get(blob.pathname);
      totalR2Bytes += blob.size || 0;
      r2Objects.push({
        key: blob.pathname,
        size: blob.size || 0,
        uploadedAt: blob.uploadedAt ? new Date(blob.uploadedAt).toISOString() : null,
        contentType: file.contentType || null,
        body: file.body,
      });
    }

    const payload = {
      rid,
      startedAt,
      finishedAt: new Date().toISOString(),
      sql: {
        sessionId,
        missingSession: !session,
        tables: [
          {
            table: 'search_sessions',
            rowCount: session ? 1 : 0,
            rows: session ? [session] : [],
          },
          {
            table: 'search_history',
            rowCount: searchHistoryRows.length,
            rows: searchHistoryRows,
          },
          {
            table: 'verification_questions',
            rowCount: verificationQuestionRows.length,
            rows: verificationQuestionRows,
          },
          {
            table: 'user_answers',
            rowCount: userAnswerRows.length,
            rows: userAnswerRows,
          },
        ],
      },
      r2: {
        prefix,
        matchedObjects: r2Objects.length,
        totalBytesDownloaded: totalR2Bytes,
        objects: r2Objects,
      },
    };

    const fileName = `rid-${sanitizeFileSegment(rid)}-bundle-${Date.now()}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
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

