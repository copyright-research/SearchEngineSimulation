import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { UIMessage } from 'ai';

/**
 * 基于对话历史和当前问题生成优化的搜索关键词
 */
export async function generateSearchQuery(
  currentQuery: string,
  conversationHistory: UIMessage[]
): Promise<string> {
  // 如果没有历史记录，直接返回当前查询
  if (conversationHistory.length === 0) {
    return currentQuery;
  }

  try {
    // 构建对话历史文本
    const historyText = conversationHistory
      .slice(-4) // 只取最近4轮对话
      .map((msg) => {
        const text = msg.parts
          .filter((part) => part.type === 'text')
          .map((part) => ('text' in part ? part.text : ''))
          .join('');
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${text}`;
      })
      .join('\n\n');

    const prompt = `You are a search query optimizer. Based on the conversation history and current user question, generate an optimized search query that captures the full context.

CONVERSATION HISTORY:
${historyText}

CURRENT USER QUESTION:
${currentQuery}

TASK:
1. Analyze if the current question refers to previous context (e.g., "它", "这个", "那个", "more details", "what about", etc.)
2. If it does, generate a standalone search query that includes the necessary context from history
3. If it doesn't, return the current question as-is or slightly optimized
4. The query should be concise but complete (max 10 words)
5. Focus on key entities, concepts, and relationships
6. Remove conversational filler words

EXAMPLES:

History: "User: What is Next.js?\nAssistant: Next.js is a React framework..."
Current: "How does it compare to Remix?"
Output: Next.js vs Remix comparison

History: "User: Tell me about the Hong Kong protests\nAssistant: The protests started in 2019..."
Current: "What was the government's response?"
Output: Hong Kong government response to 2019 protests

History: "User: Who is Taylor Swift?\nAssistant: Taylor Swift is a singer..."
Current: "What are her latest albums?"
Output: Taylor Swift latest albums 2023 2024

History: "User: Explain quantum computing"
Current: "What are some real-world applications?"
Output: quantum computing real-world applications

IMPORTANT:
- Output ONLY the optimized search query
- No explanations, no quotes, no extra text
- If the current question is already standalone and clear, return it as-is
- Preserve important keywords and entities from both history and current question

Optimized Search Query:`;

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      temperature: 0.3, // 低温度以保持一致性
    });

    const optimizedQuery = result.text.trim();
    
    // 验证生成的查询不为空且合理
    if (optimizedQuery && optimizedQuery.length > 0 && optimizedQuery.length < 200) {
      console.log('[Query Rewriter] Original:', currentQuery);
      console.log('[Query Rewriter] Optimized:', optimizedQuery);
      return optimizedQuery;
    }

    // 如果生成失败，返回原查询
    return currentQuery;
  } catch (error) {
    console.error('[Query Rewriter] Error:', error);
    return currentQuery;
  }
}

/**
 * 检测查询是否需要上下文（简单启发式）
 */
export function needsContext(query: string): boolean {
  const contextIndicators = [
    // 中文指代词
    '它', '这个', '那个', '他', '她', '这些', '那些', '此', '其',
    // 英文指代词和短语
    'it', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
    // 追问词
    'more', 'details', 'explain', 'elaborate', 'what about', 'how about',
    '更多', '详细', '解释', '说明', '那么', '还有',
    // 比较词
    'compare', 'difference', 'vs', 'versus', 'better',
    '比较', '区别', '对比', '哪个好',
  ];

  const lowerQuery = query.toLowerCase();
  return contextIndicators.some(indicator => lowerQuery.includes(indicator));
}

