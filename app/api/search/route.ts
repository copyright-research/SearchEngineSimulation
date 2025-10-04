import { NextRequest, NextResponse } from 'next/server';
import { searchGoogle } from '@/lib/google-search';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const start = searchParams.get('start');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const startIndex = start ? parseInt(start, 10) : 1;

    const results = await searchGoogle(query, startIndex);

    return NextResponse.json(results);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred while searching',
      },
      { status: 500 }
    );
  }
}
