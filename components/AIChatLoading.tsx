'use client';

import { Loader } from '@/components/ai-elements/loader';

type AIChatLoadingStage = 'submitted' | 'streaming';

interface AIChatLoadingProps {
  stage: AIChatLoadingStage;
}

const stageContent: Record<
  AIChatLoadingStage,
  {
    title: string;
    description: string;
    steps: Array<{ label: string; state: 'active' | 'done' | 'pending' }>;
  }
> = {
  submitted: {
    title: 'Searching the web',
    description: 'Looking for fresh sources before composing the answer.',
    steps: [
      { label: 'Search', state: 'active' },
      { label: 'Read sources', state: 'pending' },
      { label: 'Write answer', state: 'pending' },
    ],
  },
  streaming: {
    title: 'Grounding the answer',
    description: 'Reviewing the best sources and drafting a cited response.',
    steps: [
      { label: 'Search', state: 'done' },
      { label: 'Read sources', state: 'active' },
      { label: 'Write answer', state: 'pending' },
    ],
  },
};

const stepStyles = {
  active: {
    backgroundColor: '#e8f0fe',
    borderColor: '#d2e3fc',
    color: '#1967d2',
    dotColor: '#1a73e8',
  },
  done: {
    backgroundColor: '#e6f4ea',
    borderColor: '#ceead6',
    color: '#137333',
    dotColor: '#34a853',
  },
  pending: {
    backgroundColor: '#f1f3f4',
    borderColor: '#e8eaed',
    color: '#5f6368',
    dotColor: '#9aa0a6',
  },
} as const;

export default function AIChatLoading({ stage }: AIChatLoadingProps) {
  const content = stageContent[stage];

  return (
    <div
      className="animate-fade-in"
      style={{
        contain: 'layout style paint',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--google-border)',
      }}
    >
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div style={{ flex: '0 0 612px', maxWidth: '612px' }}>
          <div
            className="flex items-center gap-3 mb-4"
            style={{ padding: '0', backgroundColor: 'transparent' }}
          >
            <svg
              className="fWWlmf"
              height="24"
              viewBox="0 0 24 24"
              width="24"
              focusable="false"
              style={{ color: 'var(--m3c23)' }}
            >
              <path
                d="m12 2 2.582 6.953L22 11.618l-5.822 3.93L17.4 22 12 18.278 6.6 22l1.222-6.452L2 11.618l7.418-2.665L12 2z"
                fill="currentColor"
              />
            </svg>
            <h4
              className="Fzsovc"
              style={{
                fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: '20px',
                color: 'var(--m3c9)',
              }}
            >
              AI Overview
            </h4>
          </div>

          <div style={{ color: 'var(--google-text)' }}>
            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', flexShrink: 0 }}
              >
                <Loader size={16} />
              </div>
              <div className="min-w-0">
                <div
                  style={{
                    color: 'var(--google-text)',
                    fontSize: '15px',
                    fontWeight: 500,
                    fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                  }}
                >
                  {content.title}
                </div>
                <p
                  className="mt-1"
                  style={{
                    color: 'var(--google-text-secondary)',
                    fontSize: '13px',
                    lineHeight: '20px',
                    fontFamily: 'Roboto, Arial, sans-serif',
                  }}
                >
                  {content.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {content.steps.map((step) => {
                const style = stepStyles[step.state];
                return (
                  <div
                    key={step.label}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                    style={{
                      backgroundColor: style.backgroundColor,
                      borderColor: style.borderColor,
                      color: style.color,
                    }}
                  >
                    <span
                      className="block h-2 w-2 rounded-full"
                      style={{ backgroundColor: style.dotColor }}
                    />
                    <span
                      style={{
                        fontSize: '12px',
                        lineHeight: '16px',
                        fontWeight: 500,
                        fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-3">
              <div
                className="h-3 rounded-full animate-pulse"
                style={{ width: '88%', backgroundColor: '#d2d6db' }}
              />
              <div
                className="h-3 rounded-full animate-pulse"
                style={{ width: '94%', backgroundColor: '#d9dde1', animationDelay: '120ms' }}
              />
              <div
                className="h-3 rounded-full animate-pulse"
                style={{ width: '81%', backgroundColor: '#d2d6db', animationDelay: '240ms' }}
              />
              <div
                className="h-3 rounded-full animate-pulse"
                style={{ width: '67%', backgroundColor: '#d9dde1', animationDelay: '360ms' }}
              />
            </div>
          </div>
        </div>

        <div
          className="flex-shrink-0 w-full lg:w-auto"
          style={{ width: '372px', maxWidth: '100%' }}
        >
          <div
            className="flex flex-col overflow-hidden"
            style={{
              background: 'var(--nvzc36, #f7f8fa)',
              borderRadius: '20px',
              boxShadow: 'none',
            }}
          >
            <div style={{ padding: '16px 20px 12px' }}>
              <h4
                style={{
                  fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                  fontSize: '16px',
                  fontWeight: 500,
                  lineHeight: '24px',
                  color: 'var(--bbQxAb)',
                }}
              >
                Sources
              </h4>
              <p
                className="mt-1"
                style={{
                  color: 'var(--google-text-secondary)',
                  fontSize: '12px',
                  lineHeight: '18px',
                  fontFamily: 'Roboto, Arial, sans-serif',
                }}
              >
                The source list will appear once the first retrieval pass lands.
              </p>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-2">
                  <div
                    className="h-3 rounded-full animate-pulse"
                    style={{ width: item === 1 ? '82%' : '90%', backgroundColor: '#d2d6db' }}
                  />
                  <div
                    className="h-3 rounded-full animate-pulse"
                    style={{ width: item === 2 ? '72%' : '78%', backgroundColor: '#d9dde1' }}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <div
                      className="h-4 w-4 rounded-full animate-pulse"
                      style={{ backgroundColor: '#d2d6db' }}
                    />
                    <div
                      className="h-2.5 rounded-full animate-pulse"
                      style={{ width: '34%', backgroundColor: '#d9dde1' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
