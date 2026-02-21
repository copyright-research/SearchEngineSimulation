import { NextRequest, NextResponse } from 'next/server';
import { saveSearchHistory, saveVerificationQuestions } from '@/lib/db';
import { generateQuestionsForAIMode, generateQuestionsForSearchMode } from '@/lib/question-generator';
import type { SearchResult } from '@/types/search';

function getDomain(link: string): string {
  try {
    return new URL(link).hostname;
  } catch {
    return 'unknown-domain';
  }
}

function toDistinctNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function ensureFourOptions(primary: string, fallbacks: string[]): string[] {
  const options = toDistinctNonEmpty([primary, ...fallbacks]).slice(0, 4);
  const fillers = [
    'None of the above',
    'Not shown in results',
    'Insufficient information',
    'Cannot be determined',
  ];

  for (const filler of fillers) {
    if (options.length >= 4) break;
    if (!options.includes(filler)) options.push(filler);
  }

  while (options.length < 4) {
    options.push(`Option ${options.length + 1}`);
  }

  return options;
}

function buildFallbackQuestions(query: string, results: SearchResult[]) {
  const top = results.slice(0, 4);
  if (top.length === 0) {
    const queryOptions = ensureFourOptions(
      query,
      [
        `${query} tutorial`,
        `${query} latest updates`,
        `${query} overview`,
      ]
    );
    const queryCorrect = queryOptions.findIndex((opt) => opt === query);

    const firstToken = query.trim().split(/\s+/)[0] || query;
    const tokenOptions = ensureFourOptions(
      firstToken,
      [
        'documentation',
        'example',
        'reference',
      ]
    );
    const tokenCorrect = tokenOptions.findIndex((opt) => opt === firstToken);

    return [
      {
        question: 'Which query was submitted for this search session?',
        options: queryOptions,
        correctAnswer: queryCorrect >= 0 ? queryCorrect : 0,
      },
      {
        question: 'What best describes the result status of this saved search?',
        options: [
          'No usable result content was available when questions were generated',
          'The query was never sent',
          'A replay recording was merged',
          'User answers were already submitted',
        ],
        correctAnswer: 0,
      },
      {
        question: 'Which token appears in the original query text?',
        options: tokenOptions,
        correctAnswer: tokenCorrect >= 0 ? tokenCorrect : 0,
      },
    ];
  }

  const first = top[0];
  const second = top[1] ?? top[0];

  const firstTitleOptions = ensureFourOptions(
    first.title || 'Untitled result',
    top.slice(1).map((r) => r.title || 'Untitled result')
  );
  const firstTitleCorrect = firstTitleOptions.findIndex((opt) => opt === (first.title || 'Untitled result'));

  const firstDomain = getDomain(first.link);
  const domainOptions = ensureFourOptions(
    firstDomain,
    [
      ...top.slice(1).map((r) => getDomain(r.link)),
      'example.com',
      'wikipedia.org',
      'github.com',
    ]
  );
  const domainCorrect = domainOptions.findIndex((opt) => opt === firstDomain);

  const queryOptions = ensureFourOptions(
    query,
    [
      `${query} tutorial`,
      `${query} latest updates`,
      `${query} overview`,
    ]
  );
  const queryCorrect = queryOptions.findIndex((opt) => opt === query);

  return [
    {
      question: 'Which title appears as the first result in the current search list?',
      options: firstTitleOptions,
      correctAnswer: firstTitleCorrect >= 0 ? firstTitleCorrect : 0,
    },
    {
      question: `Which domain appears in the current search results for "${query}"?`,
      options: domainOptions,
      correctAnswer: domainCorrect >= 0 ? domainCorrect : 0,
    },
    {
      question: `Which query was used to produce this result set (sample title: "${second.title || 'Untitled result'}")?`,
      options: queryOptions,
      correctAnswer: queryCorrect >= 0 ? queryCorrect : 0,
    },
  ];
}

/**
 * 保存搜索历史
 * POST /api/history/save
 *
 * Body: {
 *   rid: string;
 *   query: string;
 *   mode: 'ai' | 'search' | 'search_with_overview';
 *   results: SearchResult[];
 *   aiResponse?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rid, query, mode, results, aiResponse } = body;

    // 验证必需参数
    if (!rid || !query || !mode || !results) {
      return NextResponse.json(
        { error: 'Missing required fields: rid, query, mode, results' },
        { status: 400 }
      );
    }

    // 验证 mode
    if (!['ai', 'search', 'search_with_overview'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be one of: ai, search, search_with_overview' },
        { status: 400 }
      );
    }

    if (!Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Invalid field: results must be an array' },
        { status: 400 }
      );
    }

    // 保存搜索历史
    const searchHistory = await saveSearchHistory(
      rid,
      query,
      mode,
      results,
      aiResponse
    );

    // 生成并覆盖该 RID 的验证问题（失败不影响搜索历史主流程）
    try {
      const typedResults = results as SearchResult[];

      if (typedResults.length > 0) {
        const generated = mode === 'ai' && typeof aiResponse === 'string' && aiResponse.trim()
          ? await generateQuestionsForAIMode(query, aiResponse, typedResults)
          : await generateQuestionsForSearchMode(query, typedResults, mode === 'search_with_overview');

        if (generated.questions.length > 0) {
          await saveVerificationQuestions(
            rid,
            generated.questions.map((q) => ({
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
            }))
          );
        }
      } else {
        const fallbackQuestions = buildFallbackQuestions(query, typedResults);
        if (fallbackQuestions.length > 0) {
          await saveVerificationQuestions(rid, fallbackQuestions);
        }
      }
    } catch (questionError) {
      console.error('Failed to generate/save verification questions:', questionError);

      // 模型不可用时，回退到本地规则题，避免 verification_questions 漏报
      try {
        const fallbackQuestions = buildFallbackQuestions(query, results as SearchResult[]);
        if (fallbackQuestions.length > 0) {
          await saveVerificationQuestions(rid, fallbackQuestions);
        }
      } catch (fallbackError) {
        console.error('Failed to save fallback verification questions:', fallbackError);
      }
    }

    return NextResponse.json({
      success: true,
      searchHistoryId: searchHistory.id,
      message: 'Search history saved.',
    });
  } catch (error) {
    console.error('Failed to save search history:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save search history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
