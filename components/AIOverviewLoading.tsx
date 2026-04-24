'use client';

import { Loader } from '@/components/ai-elements/loader';

type AIOverviewLoadingStage = 'searching' | 'generating';

interface AIOverviewLoadingProps {
  stage: AIOverviewLoadingStage;
  sourceCount?: number;
  embedded?: boolean;
}

const stageContent: Record<AIOverviewLoadingStage, {
  title: string;
  description: (sourceCount?: number) => string;
  steps: Array<{ label: string; state: 'active' | 'done' | 'pending' }>;
}> = {
  searching: {
    title: 'Preparing your AI overview',
    description: () => 'Pulling in search results first so the answer can start with real sources.',
    steps: [
      { label: 'Fetch results', state: 'active' },
      { label: 'Read sources', state: 'pending' },
      { label: 'Draft answer', state: 'pending' },
    ],
  },
  generating: {
    title: 'Writing the overview',
    description: (sourceCount) =>
      sourceCount && sourceCount > 0
        ? `Reviewing ${Math.min(sourceCount, 10)} sources and drafting a cited answer.`
        : 'Reviewing sources and drafting a cited answer.',
    steps: [
      { label: 'Fetch results', state: 'done' },
      { label: 'Read sources', state: 'active' },
      { label: 'Draft answer', state: 'pending' },
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

export default function AIOverviewLoading({ stage, sourceCount, embedded = false }: AIOverviewLoadingProps) {
  const content = stageContent[stage];

  const body = (
    <div className="p-5 flex flex-col gap-4">
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
            {content.description(sourceCount)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
                style={{
                  backgroundColor: style.dotColor,
                  opacity: step.state === 'active' ? 1 : 0.9,
                }}
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

      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: '#f8f9fa',
          borderColor: '#e8eaed',
        }}
      >
        <div className="space-y-3">
          <div
            className="h-3 rounded-full animate-pulse"
            style={{ width: '78%', backgroundColor: '#d2d6db' }}
          />
          <div
            className="h-3 rounded-full animate-pulse"
            style={{ width: '92%', backgroundColor: '#d9dde1', animationDelay: '120ms' }}
          />
          <div
            className="h-3 rounded-full animate-pulse"
            style={{ width: '64%', backgroundColor: '#d2d6db', animationDelay: '240ms' }}
          />
        </div>

        <div
          className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            backgroundColor: '#ffffff',
            color: 'var(--google-text-secondary)',
            border: '1px solid #e8eaed',
          }}
        >
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#1a73e8' }}
          />
          <span
            style={{
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 500,
              fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
            }}
          >
            Answer will appear here with linked sources
          </span>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <div className="w-full mb-6 animate-fade-in" style={{ maxWidth: '1100px' }}>
      <div
        className="overflow-visible transition-all duration-200"
        style={{
          backgroundColor: 'transparent',
          borderBottom: '1px solid var(--google-border)',
          paddingBottom: '20px',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            maxHeight: '32px',
            padding: '16px 0',
            borderBottom: '1px solid var(--google-border-light)',
            backgroundColor: 'transparent',
          }}
        >
          <div className="flex items-center gap-4" style={{ flexGrow: 1, paddingLeft: '16px' }}>
            <svg
              className="fWWlmf"
              height="24"
              width="24"
              aria-hidden="true"
              viewBox="0 0 471 471"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <path
                fill="var(--m3c23)"
                d="M235.5 471C235.5 438.423 229.22 407.807 216.66 379.155C204.492 350.503 187.811 325.579 166.616 304.384C145.421 283.189 120.498 266.508 91.845 254.34C63.1925 241.78 32.5775 235.5 0 235.5C32.5775 235.5 63.1925 229.416 91.845 217.249C120.498 204.689 145.421 187.811 166.616 166.616C187.811 145.421 204.492 120.497 216.66 91.845C229.22 63.1925 235.5 32.5775 235.5 0C235.5 32.5775 241.584 63.1925 253.751 91.845C266.311 120.497 283.189 145.421 304.384 166.616C325.579 187.811 350.503 204.689 379.155 217.249C407.807 229.416 438.423 235.5 471 235.5C438.423 235.5 407.807 241.78 379.155 254.34C350.503 266.508 325.579 283.189 304.384 304.384C283.189 325.579 266.311 350.503 253.751 379.155C241.584 407.807 235.5 438.423 235.5 471Z"
              />
            </svg>
            <div
              className="Fzsovc"
              style={{
                fontWeight: 500,
                color: 'var(--google-text)',
                fontSize: '14px',
                fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
              }}
            >
              AI Overview
            </div>
          </div>
        </div>
        {body}
      </div>
    </div>
  );
}
