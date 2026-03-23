import type { TopStoriesBlock, TopStoryItem } from '@/types/search';

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';
const MAX_TOP_STORIES = 5;

interface SerpApiStoryCandidate {
  title?: string;
  link?: string;
  source?: string | { name?: string };
  thumbnail?: string;
  date?: string;
  iso_date?: string;
  live?: boolean;
  label?: string;
  highlight?: SerpApiStoryCandidate;
  stories?: SerpApiStoryCandidate[];
}

interface SerpApiGoogleSearchResponse {
  top_stories?: SerpApiStoryCandidate[] | Record<string, unknown>;
  top_stories_link?: string;
}

interface SerpApiGoogleNewsResponse {
  news_results?: SerpApiStoryCandidate[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatIsoDate(isoDate?: string): string | undefined {
  if (!isNonEmptyString(isoDate)) {
    return undefined;
  }

  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  const sameYear = parsedDate.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(parsedDate);
}

function normalizeTopStoryItem(candidate: SerpApiStoryCandidate): TopStoryItem | null {
  if (!isNonEmptyString(candidate.title) || !isNonEmptyString(candidate.link)) {
    return null;
  }

  const source = typeof candidate.source === 'string'
    ? candidate.source
    : candidate.source?.name;

  if (!isNonEmptyString(source)) {
    return null;
  }

  const label = isNonEmptyString(candidate.label) ? candidate.label.toLowerCase() : '';

  return {
    title: candidate.title.trim(),
    link: candidate.link,
    source: source.trim(),
    date: isNonEmptyString(candidate.date) ? candidate.date.trim() : formatIsoDate(candidate.iso_date),
    thumbnail: isNonEmptyString(candidate.thumbnail) ? candidate.thumbnail : undefined,
    isLive: candidate.live === true || label === 'live',
  };
}

function dedupeStories(candidates: SerpApiStoryCandidate[]): TopStoryItem[] {
  const seenLinks = new Set<string>();
  const normalizedItems: TopStoryItem[] = [];

  for (const candidate of candidates) {
    const normalizedItem = normalizeTopStoryItem(candidate);
    if (!normalizedItem) {
      continue;
    }

    if (seenLinks.has(normalizedItem.link)) {
      continue;
    }

    seenLinks.add(normalizedItem.link);
    normalizedItems.push(normalizedItem);

    if (normalizedItems.length >= MAX_TOP_STORIES) {
      break;
    }
  }

  return normalizedItems;
}

function extractTopStoriesCandidates(
  topStories: SerpApiGoogleSearchResponse['top_stories']
): SerpApiStoryCandidate[] {
  if (Array.isArray(topStories)) {
    return topStories;
  }

  if (!topStories || typeof topStories !== 'object') {
    return [];
  }

  const groupedCandidates: SerpApiStoryCandidate[] = [];

  for (const value of Object.values(topStories)) {
    if (Array.isArray(value)) {
      groupedCandidates.push(...(value as SerpApiStoryCandidate[]));
    }
  }

  return groupedCandidates;
}

function extractGoogleNewsCandidates(newsResults?: SerpApiStoryCandidate[]): SerpApiStoryCandidate[] {
  if (!Array.isArray(newsResults)) {
    return [];
  }

  const candidates: SerpApiStoryCandidate[] = [];

  for (const result of newsResults) {
    if (result.highlight) {
      candidates.push(result.highlight);
    } else {
      candidates.push(result);
    }

    if (Array.isArray(result.stories)) {
      candidates.push(...result.stories);
    }
  }

  return candidates;
}

function buildGoogleNewsMoreLink(query: string): string {
  return `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(query)}`;
}

function looksLikeNewsQuery(query: string): boolean {
  return /\b(news|latest|update|updates|live|breaking|today|war|crisis|election|market|markets|price|prices|tariff|tariffs|stocks?)\b|新闻|最新|头条|直播|战况|局势|选举|股市|油价|战争/i.test(query);
}

async function fetchSerpApiJson<T>(params: Record<string, string>): Promise<T> {
  if (!SERPAPI_API_KEY) {
    throw new Error('SerpAPI credentials are not configured');
  }

  const searchParams = new URLSearchParams({
    ...params,
    api_key: SERPAPI_API_KEY,
  });

  const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(4000)
    : undefined;

  const response = await fetch(`${SERPAPI_ENDPOINT}?${searchParams.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  return response.json() as Promise<T>;
}

export async function getTopStoriesBlock(query: string): Promise<TopStoriesBlock | null> {
  if (!SERPAPI_API_KEY || !isNonEmptyString(query)) {
    return null;
  }

  const googleResponse = await fetchSerpApiJson<SerpApiGoogleSearchResponse>({
    engine: 'google',
    q: query.trim(),
    google_domain: 'google.com',
    gl: 'us',
    hl: 'en',
  });

  const topStoriesItems = dedupeStories(extractTopStoriesCandidates(googleResponse.top_stories));
  if (topStoriesItems.length > 0) {
    return {
      title: 'Top stories',
      items: topStoriesItems,
      moreLink: googleResponse.top_stories_link || buildGoogleNewsMoreLink(query),
      source: 'serpapi_google',
    };
  }

  if (!looksLikeNewsQuery(query)) {
    return null;
  }

  const googleNewsResponse = await fetchSerpApiJson<SerpApiGoogleNewsResponse>({
    engine: 'google_news',
    q: query.trim(),
    gl: 'us',
    hl: 'en',
  });

  const googleNewsItems = dedupeStories(extractGoogleNewsCandidates(googleNewsResponse.news_results));
  if (googleNewsItems.length === 0) {
    return null;
  }

  return {
    title: 'Top stories',
    items: googleNewsItems,
    moreLink: buildGoogleNewsMoreLink(query),
    source: 'serpapi_google_news',
  };
}
