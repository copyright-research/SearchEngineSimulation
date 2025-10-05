import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Removed edge runtime as it's not compatible with the AI SDK
// export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // 检查请求体是否存在
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

    if (!query || !results || results.length === 0) {
      console.error('Invalid request data:', { query: !!query, resultsLength: results?.length });
      return new Response('Invalid request: missing query or results', { status: 400 });
    }

    // 构建上下文：从搜索结果中提取信息
    const context = results
      .map((result: any, index: number) => {
        return `[${index + 1}] ${result.title}\n${result.snippet}\nSource: ${result.displayLink}`;
      })
      .join('\n\n');

    const prompt = `You are an AI assistant providing search overviews in a structured format. Based on the search results for "${query}", create a comprehensive summary.

Search Results:
${context}

Format your response EXACTLY like this structure:

1. Start with 1-2 paragraphs summarizing the main answer, with inline citations like [1, 2, 3]
2. If relevant, include a video link in this format: "You can watch this video: https://example.com (https://example.com)"
3. Add a "Key Details" section with bullet points
4. Each bullet point should have inline citations [1, 2, 3]

Important rules:
- Use markdown
- Use inline citations [1], [2], [3], etc. throughout the text
- Place citations AFTER the relevant sentence or phrase
- Use multiple citations [1, 2, 3] when information comes from multiple sources
- Use markdown bullet points syntax for the Key Details section
- Keep the tone informative and conversational
- Be concise but comprehensive
- Synthesize information from multiple sources when possible
- Do NOT make up information - only use what's in the search results
- Do NOT include the source URLs in your response (they will be added separately)

Overview:`;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('AI Overview error:', error);
    return new Response('Error generating overview', { status: 500 });
  }
}
