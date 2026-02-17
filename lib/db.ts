import { prisma } from '@/lib/prisma';
import type { SearchResult } from '@/types/search';

/**
 * 获取或创建搜索会话
 */
export async function getOrCreateSession(rid: string) {
  let session = await prisma.searchSession.findUnique({
    where: { rid },
  });

  if (!session) {
    session = await prisma.searchSession.create({
      data: { rid },
    });
  }

  return session;
}

/**
 * 保存搜索历史
 */
export async function saveSearchHistory(
  rid: string,
  query: string,
  mode: 'search' | 'search_with_overview' | 'ai',
  results: SearchResult[],
  aiResponse?: string
) {
  const session = await getOrCreateSession(rid);

  const history = await prisma.searchHistory.create({
    data: {
      sessionId: session.id,
      query,
      mode,
      results: JSON.parse(JSON.stringify(results)),
      aiResponse,
    },
  });

  return history;
}

/**
 * 获取搜索历史
 */
export async function getSearchHistory(rid: string) {
  const session = await prisma.searchSession.findUnique({
    where: { rid },
    include: {
      searchHistories: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return session?.searchHistories || [];
}

/**
 * 保存验证问题（覆盖旧问题）
 */
export async function saveVerificationQuestions(
  rid: string,
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>
) {
  const session = await getOrCreateSession(rid);

  // 使用事务：先删除该 session 的所有旧问题，再创建新问题
  await prisma.$transaction(async (tx) => {
    // 1. 删除该 session 的所有旧问题（级联删除会自动删除关联的 userAnswers）
    await tx.verificationQuestion.deleteMany({
      where: { sessionId: session.id },
    });

    // 2. 创建新问题
    await tx.verificationQuestion.createMany({
      data: questions.map((q) => ({
        sessionId: session.id,
        question: q.question,
        options: JSON.parse(JSON.stringify(q.options)),
        correctAnswer: q.correctAnswer,
      })),
    });
  });

  console.log(`[DB] Replaced all questions for RID: ${rid} with ${questions.length} new questions`);
}

/**
 * 获取验证问题
 */
export async function getVerificationQuestions(rid: string) {
  const session = await prisma.searchSession.findUnique({
    where: { rid },
    include: {
      verificationQuestions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return session?.verificationQuestions || [];
}

/**
 * 保存用户答案
 */
export async function saveUserAnswer(
  rid: string,
  questionId: number,
  userAnswer: number
) {
  const session = await getOrCreateSession(rid);

  const question = await prisma.verificationQuestion.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  if (question.sessionId !== session.id) {
    throw new Error('Question does not belong to this session');
  }

  const isCorrect = userAnswer === question.correctAnswer;

  const answer = await prisma.userAnswer.upsert({
    where: {
      sessionId_questionId: {
        sessionId: session.id,
        questionId,
      },
    },
    update: {
      userAnswer,
      isCorrect,
      answeredAt: new Date(),
    },
    create: {
      sessionId: session.id,
      questionId,
      userAnswer,
      isCorrect,
    },
  });

  return {
    is_correct: answer.isCorrect,
    correct_answer: question.correctAnswer,
  };
}

/**
 * 获取用户答题统计
 */
export async function getUserAnswerStats(rid: string) {
  const session = await prisma.searchSession.findUnique({
    where: { rid },
    include: {
      userAnswers: true,
    },
  });

  if (!session) {
    return {
      total: 0,
      correct: 0,
      accuracy: 0,
    };
  }

  const total = session.userAnswers.length;
  const correct = session.userAnswers.filter((a) => a.isCorrect).length;

  return {
    total,
    correct,
    accuracy: total > 0 ? (correct / total) * 100 : 0,
  };
}

/**
 * 更新搜索历史的反馈 (up/down)
 */
export async function updateSearchHistoryFeedback(
  historyId: number,
  feedback: 'up' | 'down' | null
) {
  return await prisma.searchHistory.update({
    where: { id: historyId },
    data: { feedback },
  });
}

/**
 * 更新搜索历史的 AI 回答内容
 */
export async function updateSearchHistoryAIResponse(
  historyId: number,
  aiResponse: string
) {
  return await prisma.searchHistory.update({
    where: { id: historyId },
    data: { aiResponse },
  });
}

/**
 * 按 query 获取缓存的搜索结果（优先返回已有 AI Overview 的记录）
 */
export async function getCachedSearchResultsByQuery(
  query: string
): Promise<SearchResult[] | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  const withOverview = await prisma.searchHistory.findFirst({
    where: {
      query: {
        equals: normalizedQuery,
        mode: 'insensitive',
      },
      mode: 'search_with_overview',
      aiResponse: {
        not: null,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      results: true,
    },
  });

  const fallback = withOverview ?? await prisma.searchHistory.findFirst({
    where: {
      query: {
        equals: normalizedQuery,
        mode: 'insensitive',
      },
      mode: {
        in: ['search', 'search_with_overview'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      results: true,
    },
  });

  if (!fallback || !Array.isArray(fallback.results)) {
    return null;
  }

  return fallback.results as unknown as SearchResult[];
}

/**
 * 按 query 获取缓存的 AI Overview（包含对应结果）
 */
export async function getCachedOverviewByQuery(
  query: string
): Promise<{ results: SearchResult[]; aiResponse: string } | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  const cached = await prisma.searchHistory.findFirst({
    where: {
      query: {
        equals: normalizedQuery,
        mode: 'insensitive',
      },
      mode: 'search_with_overview',
      aiResponse: {
        not: null,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      results: true,
      aiResponse: true,
    },
  });

  if (!cached || !cached.aiResponse || !Array.isArray(cached.results)) {
    return null;
  }

  return {
    results: cached.results as unknown as SearchResult[],
    aiResponse: cached.aiResponse,
  };
}
