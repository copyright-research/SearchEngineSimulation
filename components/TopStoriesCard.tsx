'use client';

/* eslint-disable @next/next/no-img-element */

import type { TopStoriesBlock, TopStoryItem } from '@/types/search';

interface TopStoriesCardProps {
  block: TopStoriesBlock;
  className?: string;
}

function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

function StoryMeta({ story }: { story: TopStoryItem }) {
  const faviconUrl = getFaviconUrl(story.link);

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs"
      style={{ color: 'var(--google-text-secondary)' }}
    >
      {story.isLive && (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: '#ea4335',
            color: '#ffffff',
          }}
        >
          Live
        </span>
      )}
      {faviconUrl && (
        <img
          src={faviconUrl}
          alt=""
          width={16}
          height={16}
          className="rounded-sm"
        />
      )}
      <span className="font-medium" style={{ color: 'var(--google-text)' }}>
        {story.source}
      </span>
      {story.date && <span>{story.date}</span>}
    </div>
  );
}

function SecondaryStory({ story }: { story: TopStoryItem }) {
  return (
    <a
      href={story.link}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[1fr_104px] gap-4 px-5 py-4 transition-colors"
      style={{ textDecoration: 'none' }}
    >
      <div className="min-w-0">
        <StoryMeta story={story} />
        <h4
          className="mt-2 line-clamp-3 text-[17px] leading-6"
          style={{
            color: 'var(--google-link)',
            fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
            fontWeight: 400,
          }}
        >
          {story.title}
        </h4>
      </div>
      {story.thumbnail ? (
        <div
          className="h-[84px] w-[104px] overflow-hidden rounded-2xl"
          style={{ backgroundColor: 'var(--google-bg-secondary)' }}
        >
          <img
            src={story.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className="h-[84px] w-[104px] rounded-2xl"
          style={{ backgroundColor: 'var(--google-bg-secondary)' }}
        />
      )}
    </a>
  );
}

export default function TopStoriesCard({ block, className }: TopStoriesCardProps) {
  if (!block.items.length) {
    return null;
  }

  const featuredStory = block.items[0];
  const secondaryStories = block.items.slice(1, 3);
  const extraStories = block.items.slice(3, 5);

  return (
    <section className={className}>
      <div
        className="overflow-hidden rounded-[22px] border"
        style={{
          backgroundColor: 'var(--google-bg)',
          borderColor: 'var(--google-border-light)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h3
            style={{
              color: 'var(--google-text)',
              fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
              fontSize: '18px',
              fontWeight: 500,
            }}
          >
            {block.title}
          </h3>
          {block.moreLink && (
            <a
              href={block.moreLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-4 py-2 text-sm transition-colors"
              style={{
                backgroundColor: 'var(--google-bg-secondary)',
                color: 'var(--google-text)',
                textDecoration: 'none',
              }}
            >
              More news
            </a>
          )}
        </div>

        <div
          className={`grid border-t ${secondaryStories.length > 0 ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]' : ''}`}
          style={{ borderColor: 'var(--google-border-light)' }}
        >
          <a
            href={featuredStory.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-5"
            style={{ textDecoration: 'none' }}
          >
            {featuredStory.thumbnail && (
              <div
                className="mb-4 aspect-[16/9] overflow-hidden rounded-2xl"
                style={{ backgroundColor: 'var(--google-bg-secondary)' }}
              >
                <img
                  src={featuredStory.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <StoryMeta story={featuredStory} />
            <h4
              className="mt-3 text-[30px] leading-9"
              style={{
                color: 'var(--google-link)',
                fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                fontWeight: 400,
              }}
            >
              {featuredStory.title}
            </h4>
          </a>

          {secondaryStories.length > 0 && (
            <div
              className="border-t lg:border-l lg:border-t-0"
              style={{ borderColor: 'var(--google-border-light)' }}
            >
              {secondaryStories.map((story, index) => (
                <div
                  key={story.link}
                  style={{
                    borderTop: index === 0 ? '0' : '1px solid var(--google-border-light)',
                  }}
                >
                  <SecondaryStory story={story} />
                </div>
              ))}
            </div>
          )}
        </div>

        {extraStories.length > 0 && (
          <div
            className="border-t px-5 py-4"
            style={{ borderColor: 'var(--google-border-light)' }}
          >
            <h4
              className="mb-3"
              style={{
                color: 'var(--google-text)',
                fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Also in the news
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              {extraStories.map((story) => (
                <a
                  key={story.link}
                  href={story.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border p-4 transition-colors"
                  style={{
                    borderColor: 'var(--google-border-light)',
                    textDecoration: 'none',
                  }}
                >
                  <StoryMeta story={story} />
                  <div
                    className="mt-2 line-clamp-3 text-[15px] leading-6"
                    style={{
                      color: 'var(--google-link)',
                      fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                    }}
                  >
                    {story.title}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
