import type { GoogleSearchResponse } from '@/types/search';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

export async function searchGoogle(query: string, start: number = 1): Promise<GoogleSearchResponse> {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials are not configured');
  }

  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
    cx: GOOGLE_SEARCH_ENGINE_ID,
    q: query,
    start: start.toString(),
    num: '10', // 每页返回 10 条结果
  });

  const url = `https://www.googleapis.com/customsearch/v1?${params}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Google Search API error: ${response.status} ${response.statusText}. ${
          errorData.error?.message || ''
        }`
      );
    }

    const data: GoogleSearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}
