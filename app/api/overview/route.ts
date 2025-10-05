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

3. VIDEO LINKS (if relevant):
   - Format: "You can watch this video: https://example.com (https://example.com)"
   - Or: "This video explains [topic]: https://example.com (https://example.com)"
   - Place after relevant sections, not in the opening

4. CITATION RULES:
   - Opening paragraph: Dense citations at the end [1, 2, 3, 4, 5, 6, 7]
   - Section bullets: Specific citations after each point [1], [2, 3], [4, 5, 6]
   - Sub-bullets: Also include citations
   - Use [1, 2] when info comes from multiple sources
   - You have up to 10 sources available

5. MARKDOWN FORMATTING:
   - Use ## for section headings
   - Use - for bullet points
   - Use indentation (tabs) for sub-bullets
   - Use **bold** for emphasis on key terms (sparingly)
   - Use \`code\` for technical terms if appropriate

6. TONE & STYLE:
   - Informative and conversational
   - Direct and confident
   - Synthesize information from multiple sources
   - Avoid phrases like "According to the sources" or "The search results show"
   - Present information as factual statements

7. IMPORTANT CONSTRAINTS:
   - Do NOT make up information - only use what's in the search results
   - Do NOT include source URLs in citations (they will be added separately)
   - Do NOT use generic section titles like "Key Details" for every response
   - Do NOT forget citations on any bullet point
   - Do NOT add a disclaimer at the end (it will be added automatically)

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
