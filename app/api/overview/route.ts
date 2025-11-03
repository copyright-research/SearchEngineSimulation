import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { hybridSearch } from '@/lib/tavily-search';
import { searchGoogle } from '@/lib/google-search';
import type { SearchResult } from '@/types/search';

// Removed edge runtime as it's not compatible with the AI SDK
// export const runtime = 'edge';

// Rate limiter: 每个 IP 每小时最多 30 次请求（比 chat 多一些，因为更轻量）
const overviewLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 小时
  maxRequests: 30,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting 检查
    const clientIp = getClientIp(req);
    const rateLimitCheck = overviewLimiter.check(clientIp);

    if (!rateLimitCheck.success) {
      const resetDate = new Date(rateLimitCheck.resetTime);
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          resetAt: resetDate.toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 2. 检查请求体是否存在
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Invalid content type:', contentType);
      return new Response('Content-Type must be application/json', { status: 400 });
    }

    // 尝试读取请求体
    let body;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        console.error('Empty request body');
        return new Response('Request body is empty', { status: 400 });
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response('Invalid JSON in request body', { status: 400 });
    }

    const { query, results } = body;

    if (!query) {
      console.error('Invalid request data: missing query');
      return new Response('Invalid request: missing query', { status: 400 });
    }

    // 使用混合搜索（Google + Tavily）获取更高质量的结果用于 AI Overview
    console.log('[AI Overview] Using hybrid search for:', query);
    let enhancedResults: SearchResult[] = [];
    
    try {
      // 使用混合搜索，并标记来源
      enhancedResults = await hybridSearch(query, async (q) => {
        const response = await searchGoogle(q);
        return response.items || [];
      }, { includeSource: true }); // 启用来源标记
      console.log('[AI Overview] Enhanced results count:', enhancedResults.length);
    } catch (error) {
      console.error('[AI Overview] Hybrid search failed, falling back to provided results:', error);
      // 如果混合搜索失败，使用前端传来的 Google 结果
      enhancedResults = results || [];
    }

    if (enhancedResults.length === 0) {
      console.error('No results available for AI Overview');
      return new Response('No search results available', { status: 400 });
    }

    // 构建上下文：从混合搜索结果中提取信息
    const context = enhancedResults
      .slice(0, 10) // 最多使用前 10 个结果
      .map((result, index) => {
        return `[${index + 1}] ${result.title}\n${result.snippet}\nSource: ${result.displayLink || new URL(result.link).hostname}`;
      })
      .join('\n\n');

    const prompt = `You are an AI assistant providing search overviews in Google's style. Based on the search results for "${query}", create a comprehensive, well-structured summary.

Search Results:
${context}

STRUCTURE REQUIREMENTS:

1. OPENING PARAGRAPH (1-2 paragraphs):
   - Directly answer the core question
   - Be concise but comprehensive
   - End with dense citations like [1, 2, 3, 4, 5, 6, 7]
   - Example: "ChatGPT is a conversational AI developed by OpenAI... [1, 2, 3, 4, 5]"

2. STRUCTURED SECTIONS (Use ## headings):
   - Choose section titles based on the query type:
     * For "what happened" queries: Use chronological sections (e.g., "What happened", "Key facts")
     * For "how does X work" queries: Use process sections (e.g., "How it works", "Key functionalities")
     * For "what is X" queries: Use categorical sections (e.g., "Key Aspects", "Key Characteristics")
     * For historical queries: Use timeline sections (e.g., "Imperial era", "Modern expansion")
   - Each section should have 3-6 bullet points
   - Use sub-bullets (indented with tabs) when breaking down complex points
   - Every bullet point MUST end with citations [1, 2, 3]

3. CITATION RULES:
   - Opening paragraph: Dense citations at the end [1, 2, 3, 4, 5, 6, 7]
   - Section bullets: Specific citations after each point [1], [2, 3], [4, 5, 6]
   - Sub-bullets: Also include citations
   - Use [1, 2] when info comes from multiple sources
   - You have up to 10 sources available

4. MARKDOWN FORMATTING:
   - Use ## for section headings
   - Use - for bullet points
   - Use indentation (tabs) for sub-bullets
   - Use **bold** for emphasis on key terms (sparingly)
   - Use \`code\` for technical terms if appropriate

5. TONE & STYLE:
   - Informative and conversational
   - Direct and confident
   - Synthesize information from multiple sources
   - Avoid phrases like "According to the sources" or "The search results show"
   - Present information as factual statements

6. IMPORTANT CONSTRAINTS:
   - Do NOT make up information - only use what's in the search results
   - Do NOT include source URLs in citations (they will be added separately)
   - Do NOT use generic section titles like "Key Details" for every response
   - Do NOT forget citations on any bullet point
   - Do NOT add a disclaimer at the end (it will be added automatically)
   - Do NOT include video links or suggest watching videos

Overview:`;

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
      temperature: 0.7,
    });

    // 将混合搜索结果编码到响应头中（使用 UTF-8）
    const encodedResults = Buffer.from(JSON.stringify(enhancedResults.slice(0, 10)), 'utf-8').toString('base64');

    return result.toTextStreamResponse({
      headers: {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitCheck.resetTime).toISOString(),
        'X-Search-Results': encodedResults, // 添加搜索结果到响应头
      },
    });
  } catch (error) {
    console.error('AI Overview error:', error);
    return new Response('Error generating overview', { status: 500 });
  }
}
