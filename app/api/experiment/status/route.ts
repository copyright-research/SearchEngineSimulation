import { NextRequest, NextResponse } from 'next/server';
import { getExperimentStatusByRid } from '@/lib/db';
import { getParamCaseInsensitive } from '@/lib/url-utils';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

/**
 * GET /api/experiment/status?rid=xxx
 *
 * Minimal status endpoint for Qualtrics branching. The response intentionally
 * exposes only the qualification decision.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  try {
    const rid = getParamCaseInsensitive(request.nextUrl.searchParams, 'rid');

    if (!rid) {
      return NextResponse.json(
        { error: 'Missing required parameter: rid' },
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    const status = await getExperimentStatusByRid(rid);

    return NextResponse.json(
      { qualified: status.qualified },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error('[experiment] Failed to get qualification status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get experiment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}
