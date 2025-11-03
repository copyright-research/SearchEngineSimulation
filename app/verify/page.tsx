'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Question {
  id: number;
  question: string;
  options: string[];
  query: string;
  mode: string;
  created_at: string;
}

interface Stats {
  total_answered: number;
  correct_count: number;
  accuracy_percentage: number;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const rid = searchParams.get('rid');
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<number, {
    isCorrect: boolean;
    correctAnswer: number;
  }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!rid) {
      setError('Missing RID parameter');
      setIsLoading(false);
      return;
    }

    fetchQuestions();
  }, [rid]);

  const fetchQuestions = async () => {
    if (!rid) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/questions?rid=${encodeURIComponent(rid)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch questions');
      }

      const data = await response.json();
      setQuestions(data.questions);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, answerIndex: number) => {
    if (submittedQuestions[questionId]) return; // 已提交的问题不能再选择
    
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex,
    }));
  };

  const handleSubmitAnswer = async (questionId: number) => {
    const answer = selectedAnswers[questionId];
    if (answer === undefined) return;

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rid,
          questionId,
          answer,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit answer');
      }

      const data = await response.json();
      setSubmittedQuestions(prev => ({
        ...prev,
        [questionId]: {
          isCorrect: data.isCorrect,
          correctAnswer: data.correctAnswer,
        },
      }));

      // 刷新统计数据
      fetchQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!rid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Missing RID</h1>
            <p className="text-gray-600 mb-6">
              Please provide a Recording ID (RID) parameter in the URL.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchQuestions}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50">
      {/* 背景装饰 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link 
                href={`/?rid=${rid}`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                Verification Questions
              </h1>
            </div>
          </div>
          <p className="text-gray-600">
            Answer these questions to verify your engagement with the search results.
          </p>
        </header>

        {/* Stats Card */}
        {stats && stats.total_answered > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200 shadow-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.total_answered}</div>
                <div className="text-sm text-gray-600">Answered</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.correct_count}</div>
                <div className="text-sm text-gray-600">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {Math.round(parseFloat(stats.accuracy_percentage.toString()))}%
                </div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Done!</h2>
            <p className="text-gray-600 mb-6">
              You&apos;ve answered all available questions. Keep searching to get more questions!
            </p>
            <Link
              href={`/?rid=${rid}`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
            >
              Continue Searching
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((question, index) => {
              const submitted = submittedQuestions[question.id];
              const selectedAnswer = selectedAnswers[question.id];
              
              return (
                <div
                  key={question.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden animate-fade-in"
                >
                  {/* Question Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                            Question {index + 1}
                          </span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                            {question.mode}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Related to: &quot;{question.query}&quot;
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {question.question}
                    </h3>

                    {/* Options */}
                    <div className="space-y-3 mb-6">
                      {question.options.map((option, optionIndex) => {
                        const isSelected = selectedAnswer === optionIndex;
                        const isCorrect = submitted && submitted.correctAnswer === optionIndex;
                        const isWrong = submitted && isSelected && !submitted.isCorrect;
                        
                        let buttonClass = 'w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ';
                        
                        if (submitted) {
                          if (isCorrect) {
                            buttonClass += 'border-green-500 bg-green-50 text-green-900';
                          } else if (isWrong) {
                            buttonClass += 'border-red-500 bg-red-50 text-red-900';
                          } else {
                            buttonClass += 'border-gray-200 bg-gray-50 text-gray-600';
                          }
                        } else {
                          if (isSelected) {
                            buttonClass += 'border-blue-500 bg-blue-50 text-blue-900';
                          } else {
                            buttonClass += 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-900';
                          }
                        }

                        return (
                          <button
                            key={optionIndex}
                            onClick={() => handleAnswerSelect(question.id, optionIndex)}
                            disabled={!!submitted}
                            className={buttonClass}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                isSelected 
                                  ? submitted 
                                    ? isCorrect 
                                      ? 'border-green-500 bg-green-500'
                                      : 'border-red-500 bg-red-500'
                                    : 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                {!isSelected && isCorrect && (
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className="flex-1">{option}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Submit Button or Result */}
                    {!submitted ? (
                      <button
                        onClick={() => handleSubmitAnswer(question.id)}
                        disabled={selectedAnswer === undefined || isSubmitting}
                        className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                      </button>
                    ) : (
                      <div className={`p-4 rounded-lg ${
                        submitted.isCorrect 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {submitted.isCorrect ? (
                            <>
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="font-semibold text-green-900">Correct!</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span className="font-semibold text-red-900">Incorrect</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

