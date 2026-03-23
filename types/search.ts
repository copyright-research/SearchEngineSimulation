export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
  formattedUrl?: string;
  htmlSnippet?: string;
  htmlTitle?: string;
  pagemap?: {
    cse_thumbnail?: Array<{
      src: string;
      width: string;
      height: string;
    }>;
    metatags?: Array<Record<string, string>>;
  };
  // Debug 模式：搜索结果来源
  searchSource?: 'tavily' | 'google';
}

export interface TopStoryItem {
  title: string;
  link: string;
  source: string;
  date?: string;
  thumbnail?: string;
  isLive?: boolean;
}

export interface TopStoriesBlock {
  title: string;
  items: TopStoryItem[];
  moreLink?: string;
  source: 'serpapi_google' | 'serpapi_google_news';
}

export interface GoogleSearchResponse {
  kind: string;
  url: {
    type: string;
    template: string;
  };
  queries: {
    request: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
    nextPage?: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
  };
  context: {
    title: string;
  };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items?: SearchResult[];
}

export interface SearchParams {
  q: string;
  start?: number;
  num?: number;
}
