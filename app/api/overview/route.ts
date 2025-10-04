import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Removed edge runtime as it's not compatible with the AI SDK
// export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { query, results } = await req.json();

    if (!query || !results || results.length === 0) {
      return new Response('Invalid request', { status: 400 });
    }

    // 构建上下文：从搜索结果中提取信息
    const context = results
      .slice(0, 5) // 只使用前 5 条结果
      .map((result: any, index: number) => {
        return `[${index + 1}] ${result.title}\n${result.snippet}\nSource: ${result.displayLink}`;
      })
      .join('\n\n');

    const prompt = `You are a helpful AI assistant providing search overviews. Based on the following search results for the query "${query}", provide a comprehensive, well-structured summary.

Search Results:
${context}

Instructions:
- Provide a clear, informative overview (2-3 paragraphs is the best)
- Synthesize information from multiple sources
- Be objective and factual
- Mention key points and relevant details
- If results are contradictory, note different perspectives
- Use natural, conversational language
- Do NOT make up information not present in the results

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
