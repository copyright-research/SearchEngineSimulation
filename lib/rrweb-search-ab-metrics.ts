import type { eventWithTime } from '@rrweb/types';

type SearchSurface = 'search' | 'ai_mode' | 'unknown';
type ClickSource = 'organic' | 'ai_source' | 'other_link';
type QueryTrigger = 'enter' | 'submit_click' | 'unknown';
type AIInteractionType =
  | 'show_all'
  | 'show_more'
  | 'show_less'
  | 'toggle_sources'
  | 'inline_citation_click'
  | 'source_link_click';

interface SnapshotNodeLike {
  id?: number;
  type?: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  childNodes?: SnapshotNodeLike[];
  parentId?: number;
}

interface QueryCandidate {
  nodeId: number;
  value: string;
  timestamp: number;
}

interface QueryEventInternal {
  timestamp: number;
  query: string;
  trigger: QueryTrigger;
  pageUrl: string | null;
}

export interface ParsedQueryMetric {
  queryId: string;
  query: string;
  submittedAt: number;
  endedAt: number;
  searchDurationMs: number;
  trigger: QueryTrigger;
  surface: SearchSurface;
  treatmentGroup: string;
  pageUrl: string | null;
  organicClicks: number;
  aiSourceClicks: number;
  showAllClicks: number;
  showMoreClicks: number;
  showLessClicks: number;
  aiAreaScrollEvents: number;
  aiAreaMaxScrollY: number;
}

export interface ParsedResultClickMetric {
  timestamp: number;
  clickOrder: number;
  queryId: string | null;
  query: string | null;
  source: ClickSource;
  fromAIOverview: boolean;
  aiCitationRank: number | null;
  organicRank: number | null;
  pageTitle: string;
  url: string;
  domain: string;
  isNewsDomain: boolean;
  pageContext: string;
  elementLabel: string;
}

export interface ParsedAIInteractionMetric {
  timestamp: number;
  queryId: string | null;
  query: string | null;
  type: AIInteractionType;
  label: string;
  citationNumbers: number[];
  sourceNumber: number | null;
}

export interface ParsedScrollMetric {
  totalScrollEvents: number;
  pageScrollEvents: number;
  maxPageScrollY: number;
  aiAreaScrollEvents: number;
  aiAreaMaxScrollY: number;
}

export interface ParsedVisibilityMetric {
  timestamp: number;
  hidden: boolean;
}

export interface SearchABMetrics {
  sessionStart: number;
  sessionEnd: number;
  sessionDurationMs: number;
  pagesVisited: string[];
  inferredParticipantId: string | null;
  queries: ParsedQueryMetric[];
  resultClicks: ParsedResultClickMetric[];
  aiInteractions: ParsedAIInteractionMetric[];
  scroll: ParsedScrollMetric;
  visibilityChanges: ParsedVisibilityMetric[];
  totals: {
    queryCount: number;
    resultClickCount: number;
    organicClickCount: number;
    aiSourceClickCount: number;
    newsDomainClickCount: number;
    aiInteractionCount: number;
    showAllClickCount: number;
    showMoreClickCount: number;
    showLessClickCount: number;
  };
}

const NEWS_DOMAIN_MARKERS = [
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'reuters.com',
  'apnews.com',
  'bbc.',
  'cnn.com',
  'foxnews.com',
  'theguardian.com',
  'npr.org',
  'cnbc.com',
  'bloomberg.com',
  'abcnews.go.com',
  'news.yahoo.com',
  'nbcnews.com',
  'usatoday.com',
  'latimes.com',
  'news',
  'times',
  'post',
  'journal',
  'herald',
  'tribune',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function inferSurfaceAndTreatment(url: string | null): {
  surface: SearchSurface;
  treatmentGroup: string;
  pageContext: string;
} {
  if (!url) {
    return {
      surface: 'unknown',
      treatmentGroup: 'unknown',
      pageContext: 'unknown',
    };
  }

  const parsed = parseUrl(url);
  if (!parsed) {
    return {
      surface: 'unknown',
      treatmentGroup: 'unknown',
      pageContext: 'unknown',
    };
  }

  const pathname = parsed.pathname || '/';
  const searchParams = parsed.searchParams;
  const aiParam = (() => {
    for (const [key, value] of searchParams.entries()) {
      if (key.toLowerCase() === 'ai') return value.toLowerCase();
    }
    return null;
  })();

  if (pathname.startsWith('/ai')) {
    return {
      surface: 'ai_mode',
      treatmentGroup: 'ai_mode',
      pageContext: pathname,
    };
  }

  if (aiParam === '0' || aiParam === 'false') {
    return {
      surface: 'search',
      treatmentGroup: 'control_no_ai_overview',
      pageContext: pathname,
    };
  }

  if (pathname === '/' || pathname.startsWith('/search') || pathname.startsWith('/verify')) {
    return {
      surface: 'search',
      treatmentGroup: 'search_with_ai_overview',
      pageContext: pathname,
    };
  }

  return {
    surface: 'unknown',
    treatmentGroup: 'unknown',
    pageContext: pathname,
  };
}

function extractRidFromUrl(url: string | null): string | null {
  if (!url) return null;
  const parsed = parseUrl(url);
  if (!parsed) return null;
  for (const [key, value] of parsed.searchParams.entries()) {
    if (key.toLowerCase() === 'rid') {
      return value || null;
    }
  }
  return null;
}

function isLikelyQueryInput(node: SnapshotNodeLike | undefined): boolean {
  if (!node || node.type !== 2) return false;
  const tagName = (node.tagName || '').toLowerCase();
  if (tagName !== 'input' && tagName !== 'textarea') return false;

  const attrs = node.attributes || {};
  const inputType = (attrs.type || '').toLowerCase();
  if (inputType && ['password', 'email', 'tel', 'number', 'checkbox', 'radio'].includes(inputType)) {
    return false;
  }

  const hint = normalizeText(
    [
      attrs.placeholder || '',
      attrs['aria-label'] || '',
      attrs.name || '',
      attrs.id || '',
      attrs.class || '',
    ].join(' ')
  ).toLowerCase();

  if (!hint) return true;
  return /(search|query|ask|question|prompt|chat)/i.test(hint);
}

function inferNewsDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return NEWS_DOMAIN_MARKERS.some((marker) => lower.includes(marker));
}

function extractCitationNumbers(raw: string): number[] {
  if (!raw) return [];
  const matches = raw.match(/\d+/g);
  if (!matches) return [];
  return Array.from(
    new Set(
      matches
        .map((it) => parseInt(it, 10))
        .filter((it) => Number.isFinite(it) && it > 0)
    )
  );
}

function indexSnapshotNode(
  node: SnapshotNodeLike,
  nodeMap: Map<number, SnapshotNodeLike>,
  parentId: number | undefined
): void {
  const copy: SnapshotNodeLike = {
    ...node,
    parentId,
    attributes: node.attributes ? { ...node.attributes } : {},
    childNodes: Array.isArray(node.childNodes) ? node.childNodes : [],
  };

  if (typeof node.id === 'number') {
    nodeMap.set(node.id, copy);
  }

  const children = Array.isArray(node.childNodes) ? node.childNodes : [];
  children.forEach((child) => {
    indexSnapshotNode(child, nodeMap, typeof node.id === 'number' ? node.id : parentId);
  });
}

function removeNodeFromMap(id: number, nodeMap: Map<number, SnapshotNodeLike>): void {
  const toDelete = new Set<number>([id]);
  let found = true;

  while (found) {
    found = false;
    nodeMap.forEach((node, nodeId) => {
      if (
        typeof node.parentId === 'number' &&
        toDelete.has(node.parentId) &&
        !toDelete.has(nodeId)
      ) {
        toDelete.add(nodeId);
        found = true;
      }
    });
  }

  toDelete.forEach((nodeId) => nodeMap.delete(nodeId));
}

function applyMutationsToNodeMap(
  mutationData: Record<string, unknown>,
  nodeMap: Map<number, SnapshotNodeLike>
): void {
  const removes = (mutationData.removes as Array<Record<string, unknown>> | undefined) || [];
  removes.forEach((remove) => {
    const id = toInt(remove.id);
    if (id !== null) removeNodeFromMap(id, nodeMap);
  });

  const adds = (mutationData.adds as Array<Record<string, unknown>> | undefined) || [];
  adds.forEach((add) => {
    const node = add.node as SnapshotNodeLike | undefined;
    const parentId = toInt(add.parentId ?? add.parentID);
    if (node) indexSnapshotNode(node, nodeMap, parentId ?? undefined);
  });

  const attributes = (mutationData.attributes as Array<Record<string, unknown>> | undefined) || [];
  attributes.forEach((change) => {
    const id = toInt(change.id);
    if (id === null) return;
    const target = nodeMap.get(id);
    if (!target) return;
    const incoming = (change.attributes as Record<string, string> | undefined) || {};
    target.attributes = {
      ...(target.attributes || {}),
      ...incoming,
    };
    nodeMap.set(id, target);
  });

  const texts = (mutationData.texts as Array<Record<string, unknown>> | undefined) || [];
  texts.forEach((change) => {
    const id = toInt(change.id);
    if (id === null) return;
    const target = nodeMap.get(id);
    if (!target) return;
    const nextText =
      (typeof change.value === 'string' ? change.value : undefined) ||
      (typeof change.text === 'string' ? change.text : undefined);
    if (nextText !== undefined) {
      target.textContent = nextText;
      nodeMap.set(id, target);
    }
  });
}

function extractTextFromNodeMap(nodeId: number, nodeMap: Map<number, SnapshotNodeLike>): string {
  const root = nodeMap.get(nodeId);
  if (!root) return '';

  const parts: string[] = [];
  const walk = (node: SnapshotNodeLike) => {
    if (node.type === 3 && typeof node.textContent === 'string') {
      parts.push(node.textContent);
    }
    if (node.type === 2 && typeof node.textContent === 'string') {
      parts.push(node.textContent);
    }
    const children = Array.isArray(node.childNodes) ? node.childNodes : [];
    children.forEach((child) => {
      if (typeof child.id === 'number' && nodeMap.has(child.id)) {
        const mapped = nodeMap.get(child.id);
        if (mapped) walk(mapped);
        return;
      }
      walk(child);
    });
  };

  walk(root);
  return normalizeText(parts.join(' '));
}

function findNearestNodeByTag(
  startId: number,
  nodeMap: Map<number, SnapshotNodeLike>,
  allowedTags: Set<string>,
  maxDepth: number = 12
): number | null {
  let currentId: number | undefined = startId;
  let depth = 0;

  while (typeof currentId === 'number' && depth < maxDepth) {
    const node = nodeMap.get(currentId);
    if (!node) break;
    const tagName = (node.tagName || '').toLowerCase();
    if (allowedTags.has(tagName)) return currentId;
    currentId = node.parentId;
    depth += 1;
  }

  return null;
}

function extractAttrFromAncestors(
  startId: number,
  attrName: string,
  nodeMap: Map<number, SnapshotNodeLike>,
  maxDepth: number = 12
): string | null {
  let currentId: number | undefined = startId;
  let depth = 0;
  while (typeof currentId === 'number' && depth < maxDepth) {
    const node = nodeMap.get(currentId);
    if (!node) break;
    const value = node.attributes?.[attrName];
    if (value) return value;
    currentId = node.parentId;
    depth += 1;
  }
  return null;
}

function isLikelySubmitButton(nodeId: number, nodeMap: Map<number, SnapshotNodeLike>): boolean {
  const node = nodeMap.get(nodeId);
  if (!node || node.type !== 2) return false;
  const tagName = (node.tagName || '').toLowerCase();
  if (tagName !== 'button' && tagName !== 'input') return false;

  const attrs = node.attributes || {};
  const text = extractTextFromNodeMap(nodeId, nodeMap).toLowerCase();
  const hint = normalizeText(
    [attrs.type || '', attrs['aria-label'] || '', attrs.title || '', text].join(' ')
  ).toLowerCase();

  if ((attrs.type || '').toLowerCase() === 'submit') return true;
  return /(search|send|submit|ask|go)/i.test(hint);
}

function isNodeInAIArea(nodeId: number, nodeMap: Map<number, SnapshotNodeLike>): boolean {
  let currentId: number | undefined = nodeId;
  let depth = 0;

  while (typeof currentId === 'number' && depth < 14) {
    const node = nodeMap.get(currentId);
    if (!node) break;
    const attrs = node.attributes || {};
    const tagName = (node.tagName || '').toLowerCase();
    const classId = normalizeText(`${attrs.class || ''} ${attrs.id || ''}`).toLowerCase();
    const label = normalizeText(
      `${attrs['aria-label'] || ''} ${attrs.title || ''} ${extractTextFromNodeMap(currentId, nodeMap)}`
    ).toLowerCase();

    if ('data-source-number' in attrs || 'data-citation-numbers' in attrs) {
      return true;
    }
    if (tagName === 'a' && /source|citation|reference/.test(classId + ' ' + label)) {
      return true;
    }
    if (/ai overview|sources|citation|show all|show more|show less/.test(classId + ' ' + label)) {
      return true;
    }

    currentId = node.parentId;
    depth += 1;
  }

  return false;
}

function findLatestQueryCandidate(
  candidates: Map<number, QueryCandidate>,
  timestamp: number,
  maxAgeMs: number = 30000
): QueryCandidate | null {
  let best: QueryCandidate | null = null;
  candidates.forEach((candidate) => {
    if (!candidate.value) return;
    if (timestamp - candidate.timestamp > maxAgeMs) return;
    if (!best || candidate.timestamp > best.timestamp) {
      best = candidate;
    }
  });
  return best;
}

function dedupeQueryEvents(queryEvents: QueryEventInternal[]): QueryEventInternal[] {
  if (queryEvents.length <= 1) return queryEvents;
  const deduped: QueryEventInternal[] = [];

  for (const event of queryEvents) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.query.toLowerCase() === event.query.toLowerCase() &&
      Math.abs(event.timestamp - prev.timestamp) <= 1200
    ) {
      continue;
    }
    deduped.push(event);
  }

  return deduped;
}

function findQueryIndexAtTime(queries: ParsedQueryMetric[], timestamp: number): number {
  if (queries.length === 0) return -1;
  let low = 0;
  let high = queries.length - 1;
  let ans = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (queries[mid].submittedAt <= timestamp) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
}

export function analyzeSearchABMetrics(events: eventWithTime[]): SearchABMetrics {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const start = sorted[0]?.timestamp || 0;
  const end = sorted[sorted.length - 1]?.timestamp || start;

  const nodeMap = new Map<number, SnapshotNodeLike>();
  const pagesVisited = new Set<string>();
  const queryCandidates = new Map<number, QueryCandidate>();
  const queryEvents: QueryEventInternal[] = [];
  const visibilityChanges: ParsedVisibilityMetric[] = [];
  const aiInteractionsRaw: Omit<ParsedAIInteractionMetric, 'queryId' | 'query'>[] = [];
  const resultClicksRaw: Omit<ParsedResultClickMetric, 'queryId' | 'query'>[] = [];
  const aiAreaScrollRaw: Array<{ timestamp: number; y: number }> = [];

  let currentUrl: string | null = null;
  let clickOrder = 0;
  let totalScrollEvents = 0;
  let pageScrollEvents = 0;
  let maxPageScrollY = 0;
  let aiAreaScrollEvents = 0;
  let aiAreaMaxScrollY = 0;

  for (const event of sorted) {
    const eventType = (event as unknown as Record<string, unknown>).type;
    const data = (event as unknown as Record<string, unknown>).data;
    const dataRecord = isRecord(data) ? data : undefined;

    if (eventType === 2) {
      nodeMap.clear();
      const root = (dataRecord?.node as SnapshotNodeLike | undefined) || (data as SnapshotNodeLike | undefined);
      if (root) {
        indexSnapshotNode(root, nodeMap, undefined);
      }
    }

    if (eventType === 3 && dataRecord?.source === 0) {
      applyMutationsToNodeMap(dataRecord, nodeMap);
    }

    if (eventType === 4 && typeof dataRecord?.href === 'string') {
      currentUrl = dataRecord.href;
      pagesVisited.add(currentUrl);
    }

    if (eventType === 6 && dataRecord?.plugin === 'page-visibility' && isRecord(dataRecord.payload)) {
      const hidden = Boolean(dataRecord.payload.hidden);
      visibilityChanges.push({
        timestamp: event.timestamp,
        hidden,
      });
    }

    if (eventType === 3 && dataRecord?.source === 5) {
      const targetId = toInt(dataRecord.id);
      const text = typeof dataRecord.text === 'string' ? normalizeText(dataRecord.text) : '';
      if (targetId === null) continue;

      const node = nodeMap.get(targetId);
      if (!isLikelyQueryInput(node)) continue;

      if (!text) {
        queryCandidates.delete(targetId);
      } else {
        queryCandidates.set(targetId, {
          nodeId: targetId,
          value: text,
          timestamp: event.timestamp,
        });
      }
    }

    if (eventType === 3 && dataRecord?.source === 2 && dataRecord.type === 6) {
      const key = typeof dataRecord.key === 'string' ? dataRecord.key : '';
      if (!['Enter', 'Return'].includes(key)) continue;
      const targetId = toInt(dataRecord.id);
      if (targetId === null) continue;

      const direct = queryCandidates.get(targetId);
      const fallback = findLatestQueryCandidate(queryCandidates, event.timestamp);
      const candidate = direct && direct.value ? direct : fallback;
      if (!candidate || !candidate.value) continue;

      queryEvents.push({
        timestamp: event.timestamp,
        query: candidate.value,
        trigger: 'enter',
        pageUrl: currentUrl,
      });
    }

    if (eventType === 3 && dataRecord?.source === 3) {
      totalScrollEvents += 1;

      const y = toInt(dataRecord.y) ?? 0;
      const targetId = toInt(dataRecord.id);

      if (targetId !== null && isNodeInAIArea(targetId, nodeMap)) {
        aiAreaScrollEvents += 1;
        aiAreaMaxScrollY = Math.max(aiAreaMaxScrollY, y);
        aiAreaScrollRaw.push({ timestamp: event.timestamp, y });
      } else {
        pageScrollEvents += 1;
        maxPageScrollY = Math.max(maxPageScrollY, y);
      }
    }

    if (!(eventType === 3 && dataRecord?.source === 2 && dataRecord.type === 2)) {
      continue;
    }

    const originalTargetId = toInt(dataRecord.id);
    if (originalTargetId === null) continue;
    const targetId =
      findNearestNodeByTag(originalTargetId, nodeMap, new Set(['a', 'button', 'input'])) || originalTargetId;
    const targetNode = nodeMap.get(targetId);
    if (!targetNode || targetNode.type !== 2) continue;

    const tagName = (targetNode.tagName || '').toLowerCase();
    const attrs = targetNode.attributes || {};
    const labelText = extractTextFromNodeMap(targetId, nodeMap);
    const label = normalizeText(attrs['aria-label'] || attrs.title || labelText || '');
    const aiArea = isNodeInAIArea(targetId, nodeMap);

    if (tagName === 'button' || (tagName === 'input' && (attrs.type || '').toLowerCase() === 'submit')) {
      if (isLikelySubmitButton(targetId, nodeMap)) {
        const candidate = findLatestQueryCandidate(queryCandidates, event.timestamp);
        if (candidate?.value) {
          queryEvents.push({
            timestamp: event.timestamp,
            query: candidate.value,
            trigger: 'submit_click',
            pageUrl: currentUrl,
          });
        }
      }

      const normalizedLabel = label.toLowerCase();
      const citationNumbers = extractCitationNumbers(
        attrs['data-citation-numbers'] || label || labelText || ''
      );
      const sourceNumber = toInt(attrs['data-source-number']);

      if (/\bshow\s+all\b/i.test(normalizedLabel)) {
        aiInteractionsRaw.push({
          timestamp: event.timestamp,
          type: 'show_all',
          label: label || 'Show all',
          citationNumbers: [],
          sourceNumber: sourceNumber ?? null,
        });
      } else if (/\bshow\s+more\b/i.test(normalizedLabel)) {
        aiInteractionsRaw.push({
          timestamp: event.timestamp,
          type: 'show_more',
          label: label || 'Show more',
          citationNumbers: [],
          sourceNumber: sourceNumber ?? null,
        });
      } else if (/\bshow\s+less\b|\bcollapse\b/i.test(normalizedLabel)) {
        aiInteractionsRaw.push({
          timestamp: event.timestamp,
          type: 'show_less',
          label: label || 'Show less',
          citationNumbers: [],
          sourceNumber: sourceNumber ?? null,
        });
      } else if (/\bsources?\b|\bhide\b/i.test(normalizedLabel) && aiArea) {
        aiInteractionsRaw.push({
          timestamp: event.timestamp,
          type: 'toggle_sources',
          label: label || 'Toggle sources',
          citationNumbers: [],
          sourceNumber: sourceNumber ?? null,
        });
      } else if (citationNumbers.length > 0) {
        aiInteractionsRaw.push({
          timestamp: event.timestamp,
          type: 'inline_citation_click',
          label: label || 'Inline citation',
          citationNumbers,
          sourceNumber: sourceNumber ?? null,
        });
      }
    }

    if (tagName === 'a') {
      clickOrder += 1;

      const href = attrs.href || '';
      const organicRank = toInt(extractAttrFromAncestors(targetId, 'data-result-index', nodeMap));
      const sourceNumber = toInt(extractAttrFromAncestors(targetId, 'data-source-number', nodeMap));
      const source: ClickSource =
        sourceNumber !== null ? 'ai_source' : organicRank !== null ? 'organic' : 'other_link';
      const fromAIOverview = sourceNumber !== null || aiArea;

      const parsedHref = parseUrl(href);
      const domain = parsedHref?.hostname || '';
      const isNewsDomain = domain ? inferNewsDomain(domain) : false;
      const { pageContext } = inferSurfaceAndTreatment(currentUrl);

      resultClicksRaw.push({
        timestamp: event.timestamp,
        clickOrder,
        source,
        fromAIOverview,
        aiCitationRank: sourceNumber ?? null,
        organicRank: organicRank ?? null,
        pageTitle: attrs['data-result-title'] || label || parsedHref?.pathname || href,
        url: href,
        domain,
        isNewsDomain,
        pageContext,
        elementLabel: label || href,
      });

      if (sourceNumber !== null) {
        aiInteractionsRaw.push({
          timestamp: event.timestamp,
          type: 'source_link_click',
          label: label || href,
          citationNumbers: [],
          sourceNumber,
        });
      }
    }
  }

  const dedupedQueries = dedupeQueryEvents(queryEvents);
  const queries: ParsedQueryMetric[] = dedupedQueries.map((queryEvent, index) => {
    const next = dedupedQueries[index + 1];
    const endedAt = next ? next.timestamp : end;
    const { surface, treatmentGroup } = inferSurfaceAndTreatment(queryEvent.pageUrl);

    return {
      queryId: `q${index + 1}`,
      query: queryEvent.query,
      submittedAt: queryEvent.timestamp,
      endedAt,
      searchDurationMs: Math.max(0, endedAt - queryEvent.timestamp),
      trigger: queryEvent.trigger,
      surface,
      treatmentGroup,
      pageUrl: queryEvent.pageUrl,
      organicClicks: 0,
      aiSourceClicks: 0,
      showAllClicks: 0,
      showMoreClicks: 0,
      showLessClicks: 0,
      aiAreaScrollEvents: 0,
      aiAreaMaxScrollY: 0,
    };
  });

  const resultClicks: ParsedResultClickMetric[] = resultClicksRaw.map((click) => {
    const queryIndex = findQueryIndexAtTime(queries, click.timestamp);
    const query = queryIndex >= 0 ? queries[queryIndex] : null;
    if (query) {
      if (click.source === 'organic') query.organicClicks += 1;
      if (click.source === 'ai_source') query.aiSourceClicks += 1;
    }
    return {
      ...click,
      queryId: query?.queryId || null,
      query: query?.query || null,
    };
  });

  const aiInteractions: ParsedAIInteractionMetric[] = aiInteractionsRaw.map((event) => {
    const queryIndex = findQueryIndexAtTime(queries, event.timestamp);
    const query = queryIndex >= 0 ? queries[queryIndex] : null;
    if (query) {
      if (event.type === 'show_all') query.showAllClicks += 1;
      if (event.type === 'show_more') query.showMoreClicks += 1;
      if (event.type === 'show_less') query.showLessClicks += 1;
    }
    return {
      ...event,
      queryId: query?.queryId || null,
      query: query?.query || null,
    };
  });

  const queryScrollBucket = new Map<string, { events: number; maxY: number }>();
  aiAreaScrollRaw.forEach((scrollEvent) => {
    const queryIndex = findQueryIndexAtTime(queries, scrollEvent.timestamp);
    if (queryIndex < 0) return;
    const query = queries[queryIndex];
    const bucket = queryScrollBucket.get(query.queryId) || { events: 0, maxY: 0 };
    bucket.events += 1;
    bucket.maxY = Math.max(bucket.maxY, scrollEvent.y);
    queryScrollBucket.set(query.queryId, bucket);
  });

  queries.forEach((query) => {
    const bucket = queryScrollBucket.get(query.queryId);
    if (!bucket) return;
    query.aiAreaScrollEvents = bucket.events;
    query.aiAreaMaxScrollY = bucket.maxY;
  });

  const participantRid = queries.find((q) => q.pageUrl)?.pageUrl || currentUrl;
  const inferredParticipantId = extractRidFromUrl(participantRid);

  const totals = {
    queryCount: queries.length,
    resultClickCount: resultClicks.length,
    organicClickCount: resultClicks.filter((it) => it.source === 'organic').length,
    aiSourceClickCount: resultClicks.filter((it) => it.source === 'ai_source').length,
    newsDomainClickCount: resultClicks.filter((it) => it.isNewsDomain).length,
    aiInteractionCount: aiInteractions.length,
    showAllClickCount: aiInteractions.filter((it) => it.type === 'show_all').length,
    showMoreClickCount: aiInteractions.filter((it) => it.type === 'show_more').length,
    showLessClickCount: aiInteractions.filter((it) => it.type === 'show_less').length,
  };

  return {
    sessionStart: start,
    sessionEnd: end,
    sessionDurationMs: Math.max(0, end - start),
    pagesVisited: Array.from(pagesVisited),
    inferredParticipantId,
    queries,
    resultClicks,
    aiInteractions,
    scroll: {
      totalScrollEvents,
      pageScrollEvents,
      maxPageScrollY,
      aiAreaScrollEvents,
      aiAreaMaxScrollY,
    },
    visibilityChanges,
    totals,
  };
}
