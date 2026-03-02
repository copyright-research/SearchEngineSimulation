import { NextResponse } from 'next/server';
import modelScores from '@/data/model-scores.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      count: modelScores.length,
      models: modelScores,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
