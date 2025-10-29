import { groq } from '@ai-sdk/groq';
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { NextRequest } from 'next/server';
import { searchGoogle } from '@/lib/google-search';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import type { SearchResult } from '@/types/search';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Rate limiter: 每个 IP 每小时最多 20 次请求
const chatLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 小时
  maxRequests: 20,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting 检查
    const clientIp = getClientIp(req);
    const rateLimitCheck = chatLimiter.check(clientIp);

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
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 2. 验证请求数据
    const { messages }: { messages: UIMessage[] } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response('Messages are required', { status: 400 });
    }

    // 获取最后一条用户消息作为搜索查询
    const lastMessage = messages[messages.length - 1];
    // 从 parts 中提取文本
    const query = lastMessage.parts
      .filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? part.text : ''))
      .join('');

    if (!query || query.trim().length === 0) {
      return new Response('Query cannot be empty', { status: 400 });
    }

    // 查询长度限制
    if (query.length > 500) {
      return new Response('Query is too long (max 500 characters)', { status: 400 });
    }

    console.log('AI Chat request:', { query, messagesCount: messages.length });

    // 1. 执行 Google 搜索
    let searchResults: SearchResult[] = [];
    try {
      const searchResponse = await searchGoogle(query);
      searchResults = searchResponse.items || [];
      console.log('Search completed:', { resultsCount: searchResults.length });
    } catch (searchError) {
      console.error('Search error:', searchError);
      // 继续执行，但没有搜索结果
    }

    // 2. 构建 grounding context（仅当前查询的搜索结果）
    const context = searchResults
      .slice(0, 10)
      .map((result, index) => {
        return `[${index + 1}] ${result.title}\n${result.snippet}\nSource: ${result.displayLink}`;
      })
      .join('\n\n');

    // 3. 构建对话历史上下文（不包含搜索结果，只有问答内容）
    let conversationHistory = '';
    if (messages.length > 1) {
      // 获取除了最后一条消息外的所有历史消息
      const historyMessages = messages.slice(0, -1);
      conversationHistory = '\n\nCONVERSATION HISTORY:\n' + 
        historyMessages.map((msg) => {
          const text = msg.parts
            .filter((part) => part.type === 'text')
            .map((part) => ('text' in part ? part.text : ''))
            .join('');
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          return `${role}: ${text}`;
        }).join('\n\n');
    }

    // 4. 构建系统提示词（Perplexity 风格 + 对话上下文）
    const systemPrompt = searchResults.length > 0
      ? `You are Perplexity AI - an advanced search-powered assistant that provides comprehensive, well-researched answers.
${conversationHistory}

Search Results for current query: "${query}"
${context}

RESPONSE GUIDELINES:

1. CONTEXT AWARENESS:
   - Consider the conversation history when formulating your answer
   - If the current query refers to previous discussion, acknowledge it naturally
   - Build upon previous answers when appropriate
   - Maintain consistency with earlier responses

2. STRUCTURE YOUR ANSWER:
   - Start with a direct, concise answer (1-2 paragraphs)
   - Add citations at the end of each sentence or claim [1, 2, 3]
   - Use ## headings to organize information into logical sections
   - Use bullet points for lists and key points
   - Each bullet point must end with citations

3. CITATION RULES:
   - Cite sources as [1], [2], etc. after EVERY factual claim
   - Use multiple citations [1, 2, 3] when info comes from multiple sources
   - Opening paragraph should have dense citations like [1, 2, 3, 4, 5]
   - Never make claims without citations
   - ONLY cite from the current search results, NOT from conversation history

4. CONTENT QUALITY:
   - ONLY use information from the search results provided for new factual claims
   - You can reference information from conversation history for context
   - Synthesize information from multiple sources
   - Be conversational but authoritative
   - If search results are insufficient, acknowledge it honestly
   - Avoid phrases like "According to the sources" or "The search results show"
   - Present information as factual statements with citations

5. FORMATTING:
   - Use **bold** sparingly for key terms
   - Use \`code\` for technical terms if appropriate
   - Keep paragraphs concise (2-4 sentences)
   - Use clear section headings that match the query context

EXAMPLE:
Next.js 15 introduces significant improvements to performance and developer experience [1, 2, 3]. The release focuses on React 19 support and enhanced caching mechanisms [4, 5].

## Key Features
- Turbopack integration for faster builds [1, 3]
- Improved Server Components with streaming support [2, 4]
- Enhanced Image Optimization [5, 6]

Remember: Be helpful, accurate, maintain context awareness, and always cite your sources!`
      : `You are a helpful AI assistant. Unfortunately, I couldn't retrieve search results for: "${query}"
${conversationHistory}

Please provide a brief answer based on general knowledge and the conversation history above, but clearly mention that you don't have access to current/specific information about this topic.`;

    // 5. 准备消息历史
    // 将 UIMessage 转换为 ModelMessage
    const modelMessages = convertToModelMessages(messages);

    // 6. 调用 Groq AI 生成回答
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: modelMessages,
      temperature: 0.7,
      maxRetries: 2,
      onFinish: async ({ text }) => {
        console.log('AI response completed:', { 
          textLength: text.length,
          sourcesCount: searchResults.length 
        });
      },
    });

    // 7. 返回 UI Message Stream 响应（AI SDK 5 标准格式）
    return result.toUIMessageStreamResponse({
      headers: {
        'X-Search-Results-Count': searchResults.length.toString(),
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitCheck.resetTime).toISOString(),
      },
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

