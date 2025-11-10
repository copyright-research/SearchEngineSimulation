import { generateObject } from 'ai';
import { z } from 'zod';
import { getQuestionGeneratorModel } from '@/lib/ai-model';
import type { SearchResult } from '@/types/search';

/**
 * 问题生成器
 * 基于用户的搜索历史和结果生成验证问题
 */

// 定义问题的 schema
const QuestionSchema = z.object({
  question: z.string().describe('问题内容'),
  options: z.array(z.string()).length(4).describe('4个选项'),
  correctAnswer: z.number().min(0).max(3).describe('正确答案的索引（0-3）'),
  explanation: z.string().describe('答案解释'),
});

const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema).min(3).max(5).describe('3-5个问题'),
});

export type Question = z.infer<typeof QuestionSchema>;
export type QuestionsResponse = z.infer<typeof QuestionsResponseSchema>;

/**
 * 生成验证问题
 * @param query 用户的搜索查询
 * @param results 搜索结果
 * @param aiResponse AI生成的回答（如果有）
 * @param mode 搜索模式
 */
export async function generateVerificationQuestions(
  query: string,
  results: SearchResult[],
  aiResponse?: string,
  mode?: string
): Promise<QuestionsResponse> {
  try {
    // 准备上下文信息
    const searchContext = results.slice(0, 5).map((result, index) => ({
      index: index + 1,
      title: result.title,
      snippet: result.snippet,
      link: result.link,
    }));

    // Build the prompt
    const prompt = `You are a professional question generator. Based on the user's search query and search results, generate 3-5 multiple-choice questions to verify whether the user has actually read and understood the content.

User Search Query: "${query}"
Search Mode: ${mode || 'search'}

Search Results:
${searchContext.map(r => `${r.index}. ${r.title}\n   ${r.snippet}\n   Source: ${r.link}`).join('\n\n')}

${aiResponse ? `\nAI Generated Response:\n${aiResponse}\n` : ''}

Generate 3-5 multiple-choice questions with the following requirements:
1. Questions should be based on the actual content of the search results
2. Questions should test whether the user actually read the results, not just clicked randomly
3. Each question has 4 options, with only 1 correct answer
4. **IMPORTANT**: correctAnswer must be 0, 1, 2, or 3 (array index, starting from 0)
5. Questions should be moderately difficult - not too easy, not too hard
6. Avoid questions that can be answered with common sense alone
7. Questions should be specific and clear, avoiding ambiguity
8. Options should have some level of distraction, but not be too similar
9. Prioritize key information from search result titles, snippets, and AI responses

**Answer Index Explanation**:
- First option (options[0]) → correctAnswer: 0
- Second option (options[1]) → correctAnswer: 1
- Third option (options[2]) → correctAnswer: 2
- Fourth option (options[3]) → correctAnswer: 3

Question types can include:
- Factual questions (based on specific information in search results)
- Comprehension questions (testing understanding of content)
- Source identification (which search result mentioned certain information)
- Detail recall (specific details from search results)

Generate questions in English.`;

    // 使用 AI 模型生成结构化问题
    const model = getQuestionGeneratorModel();
    
    const result = await generateObject({
      model,
      schema: QuestionsResponseSchema,
      prompt,
      temperature: 0.7,
    });

    console.log('Generated questions:', result.object.questions.length);
    return result.object;
  } catch (error) {
    console.error('Failed to generate verification questions:', error);
    throw error;
  }
}

/**
 * 为AI模式生成问题（基于对话历史）
 */
export async function generateQuestionsForAIMode(
  query: string,
  aiResponse: string,
  sources: SearchResult[]
): Promise<QuestionsResponse> {
  return generateVerificationQuestions(query, sources, aiResponse, 'ai');
}

/**
 * 为搜索模式生成问题（无AI回答）
 */
export async function generateQuestionsForSearchMode(
  query: string,
  results: SearchResult[],
  hasOverview: boolean
): Promise<QuestionsResponse> {
  const mode = hasOverview ? 'search_with_overview' : 'search';
  return generateVerificationQuestions(query, results, undefined, mode);
}

