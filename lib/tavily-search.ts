import { tavily } from '@tavily/core';
import type { SearchResult } from '@/types/search';

/**
 * Tavily 搜索工具
 * 提供高质量的 AI 优化搜索结果
 */

// 初始化 Tavily 客户端
const tavilyClient = tavily({ 
  apiKey: process.env.TAVILY_API_KEY || '' 
});

/**
 * 使用 Tavily 进行搜索
 */
export async function searchTavily(query: string, maxResults: number = 5) {
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[Tavily] API key not configured, skipping Tavily search');
    return [];
  }

  try {
    console.log(`[Tavily] Searching for: "${query}"`);
    
    const response = await tavilyClient.search(query, {
      maxResults,
      searchDepth: 'advanced', // 'basic' 或 'advanced'
      includeAnswer: false, // 我们用自己的 AI 生成答案
      includeRawContent: false, // 不需要完整内容
    });

    console.log(`[Tavily] Found ${response.results.length} results`);

    // 转换为统一的 SearchResult 格式
    return response.results.map((result, index) => ({
      kind: 'customsearch#result',
      title: result.title,
      htmlTitle: result.title,
      link: result.url,
      displayLink: new URL(result.url).hostname,
      snippet: result.content,
      htmlSnippet: result.content,
      formattedUrl: result.url,
      htmlFormattedUrl: result.url,
      cacheId: `tavily-${index}`,
      // 添加 Tavily 特有的评分
      pagemap: {
        metatags: [{
          'og:description': result.content,
          'tavily:score': result.score?.toString() || '0',
        }]
      }
    } as SearchResult));
  } catch (error) {
    console.error('[Tavily] Search error:', error);
    return [];
  }
}

/**
 * 合并 Google 和 Tavily 的搜索结果
 * 策略：
 * 1. 去重（基于 URL）
 * 2. Tavily 结果优先（因为更相关）
 * 3. 保留 Google 的独特结果
 * 4. 最多返回 10 个结果
 */
export function mergeSearchResults(
  googleResults: SearchResult[],
  tavilyResults: SearchResult[],
  includeSource: boolean = false
): SearchResult[] {
  // 使用 Map 去重，key 是 URL
  const resultMap = new Map<string, SearchResult & { source: string }>();

  // 先添加 Tavily 结果（优先级更高）
  tavilyResults.forEach(result => {
    const normalizedUrl = normalizeUrl(result.link);
    resultMap.set(normalizedUrl, {
      ...result,
      source: 'tavily',
    });
  });

  // 再添加 Google 结果（如果 URL 不重复）
  googleResults.forEach(result => {
    const normalizedUrl = normalizeUrl(result.link);
    if (!resultMap.has(normalizedUrl)) {
      resultMap.set(normalizedUrl, {
        ...result,
        source: 'google',
      });
    }
  });

  // 转换为数组并排序
  const finalResults = Array.from(resultMap.values());

  // 排序策略：Tavily 结果在前，然后是 Google 结果
  finalResults.sort((a, b) => {
    if (a.source === 'tavily' && b.source === 'google') return -1;
    if (a.source === 'google' && b.source === 'tavily') return 1;
    return 0;
  });

  // 统计信息
  const tavilyCount = finalResults.filter(r => r.source === 'tavily').length;
  const googleCount = finalResults.filter(r => r.source === 'google').length;
  console.log(`[Merge] Combined ${tavilyResults.length} Tavily + ${googleResults.length} Google = ${finalResults.length} unique results (${tavilyCount} from Tavily, ${googleCount} from Google)`);

  // 如果启用 debug 模式，添加 searchSource 字段
  if (includeSource) {
    return finalResults.map(result => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { source: _, ...rest } = result;
      return {
        ...rest,
        searchSource: result.source as 'tavily' | 'google',
      };
    });
  }

  // 移除 source 字段（内部使用）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return finalResults.map(({ source: _, ...result }) => result);
}

/**
 * 标准化 URL（用于去重）
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // 移除 www.、尾部斜杠、查询参数（可选）
    let normalized = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname;
    normalized = normalized.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * 智能搜索：同时使用 Google 和 Tavily
 */
export async function hybridSearch(
  query: string,
  googleSearchFn: (query: string) => Promise<SearchResult[]>,
  options?: { includeSource?: boolean }
): Promise<SearchResult[]> {
  try {
    // 并行执行两个搜索
    const [googleResults, tavilyResults] = await Promise.all([
      googleSearchFn(query).catch(err => {
        console.error('[Hybrid Search] Google search failed:', err);
        return [];
      }),
      searchTavily(query, 5),
    ]);

    // 确保 googleResults 是数组
    const googleArray = Array.isArray(googleResults) ? googleResults : [];
    
    // 合并结果
    return mergeSearchResults(googleArray, tavilyResults, options?.includeSource);
  } catch (error) {
    console.error('[Hybrid Search] Error:', error);
    // 如果出错，至少尝试返回 Google 结果
    try {
      const fallbackResults = await googleSearchFn(query);
      return Array.isArray(fallbackResults) ? fallbackResults : [];
    } catch {
      return [];
    }
  }
}

