import { NextRequest, NextResponse } from 'next/server';
import { upsertExperimentActivitySnapshot } from '@/lib/db';
import { clampNonNegativeInt } from '@/lib/experiment-qualification';

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function parseJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    const text = await request.text();
    if (!text.trim()) {
      throw new Error('Empty request body');
    }
    return JSON.parse(text) as Record<string, unknown>;
  }
}

/**
 * POST /api/experiment/activity
 *
 * Hidden heartbeat endpoint used by the experiment client to persist cumulative
 * activity snapshots by RID + clientSessionId.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await parseJsonBody(request);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }

  try {
    const rid = typeof body.rid === 'string' ? body.rid : '';
    const clientSessionId = typeof body.clientSessionId === 'string' ? body.clientSessionId : '';
    const pagePath = typeof body.pagePath === 'string' ? body.pagePath : undefined;

    if (!rid || !clientSessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: rid, clientSessionId' },
        { status: 400 }
      );
    }

    await upsertExperimentActivitySnapshot({
      rid,
      clientSessionId,
      pagePath,
      visibleTimeMs: clampNonNegativeInt(body.visibleTimeMs),
      clickCount: clampNonNegativeInt(body.clickCount),
      scrollCount: clampNonNegativeInt(body.scrollCount),
      mousemoveCount: clampNonNegativeInt(body.mousemoveCount),
      lastSeenAt: parseDate(body.lastSeenAt),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('[experiment] Failed to persist activity snapshot:', error);
    return NextResponse.json(
      {
        error: 'Failed to persist experiment activity',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
