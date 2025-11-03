import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
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

    // 构建提示词
    const prompt = `你是一个专业的问题生成助手。基于用户的搜索查询和搜索结果，生成3-5个选择题来验证用户是否真的阅读和理解了内容。

用户搜索查询: "${query}"
搜索模式: ${mode || 'search'}

搜索结果:
${searchContext.map(r => `${r.index}. ${r.title}\n   ${r.snippet}\n   来源: ${r.link}`).join('\n\n')}

${aiResponse ? `\nAI 生成的回答:\n${aiResponse}\n` : ''}

请生成3-5个选择题，要求：
1. 问题应该基于搜索结果的实际内容
2. 问题应该测试用户是否真的阅读了结果，而不是随便点击
3. 每个问题有4个选项，只有1个正确答案
4. **重要**：correctAnswer 必须是 0、1、2 或 3（数组索引，从0开始）
5. 问题难度适中，不要太简单也不要太难
6. 避免生成可以通过常识回答的问题
7. 问题应该具体、明确，避免模糊不清
8. 选项应该有一定的迷惑性，但不要过于相似
9. 优先基于搜索结果的标题、摘要和AI回答中的关键信息

**答案索引说明**：
- 第1个选项（options[0]）→ correctAnswer: 0
- 第2个选项（options[1]）→ correctAnswer: 1
- 第3个选项（options[2]）→ correctAnswer: 2
- 第4个选项（options[3]）→ correctAnswer: 3

问题类型可以包括：
- 事实性问题（基于搜索结果中的具体信息）
- 理解性问题（测试对内容的理解）
- 来源识别（哪个搜索结果提到了某个信息）
- 细节记忆（搜索结果中的具体细节）

请用中文生成问题。`;

    // 使用 Gemini 2.0 Flash 生成结构化问题
    const result = await generateObject({
      model: google('gemini-2.0-flash-exp'),
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

