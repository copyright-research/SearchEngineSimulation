export const MIN_EXPERIMENT_VISIBLE_TIME_MS = 15_000;
export const MIN_EXPERIMENT_MEANINGFUL_MOUSEMOVES = 5;

export interface ExperimentActivityTotals {
  visibleTimeMs: number;
  clickCount: number;
  scrollCount: number;
  mousemoveCount: number;
}

export interface ExperimentQualificationStatus extends ExperimentActivityTotals {
  qualified: boolean;
  hasEnoughTime: boolean;
  hasEnoughActivity: boolean;
}

export function clampNonNegativeInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

export function getExperimentQualificationStatus(
  totals: ExperimentActivityTotals
): ExperimentQualificationStatus {
  const normalized: ExperimentActivityTotals = {
    visibleTimeMs: clampNonNegativeInt(totals.visibleTimeMs),
    clickCount: clampNonNegativeInt(totals.clickCount),
    scrollCount: clampNonNegativeInt(totals.scrollCount),
    mousemoveCount: clampNonNegativeInt(totals.mousemoveCount),
  };

  const hasEnoughTime = normalized.visibleTimeMs >= MIN_EXPERIMENT_VISIBLE_TIME_MS;
  const hasEnoughActivity =
    normalized.clickCount > 0 ||
    normalized.scrollCount > 0 ||
    normalized.mousemoveCount >= MIN_EXPERIMENT_MEANINGFUL_MOUSEMOVES;

  return {
    ...normalized,
    qualified: hasEnoughTime && hasEnoughActivity,
    hasEnoughTime,
    hasEnoughActivity,
  };
}
