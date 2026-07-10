import type { SeriesPoint, YieldProduct } from "../plugin.js";

export interface SeriesStats {
  min: number;
  max: number;
  /** Percent change from the first to the last point, e.g. -0.4 for a 40% drop. */
  changePct: number;
}

export function analyzeSeries(points: SeriesPoint[]): SeriesStats | null {
  if (points.length < 2) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    if (point.value < min) min = point.value;
    if (point.value > max) max = point.value;
  }

  const first = points.at(0)!.value;
  const last = points.at(-1)!.value;
  const changePct = first === 0 ? 0 : (last - first) / first;

  return { min, max, changePct };
}

export interface ProductAnalysis {
  product: YieldProduct;
  /** 30-day APY stats when history is available. */
  apy30d: SeriesStats | null;
  /** 30-day TVL stats when history is available. */
  tvl30d: SeriesStats | null;
}

/** APY is considered stable when it never strayed far from its current value. */
export function isApyStable(analysis: ProductAnalysis): boolean {
  if (!analysis.apy30d) return false;
  const { min, max } = analysis.apy30d;
  const current = analysis.product.apy;
  if (current === 0) return false;
  return (max - min) / current <= 0.5;
}

/** TVL is considered collapsing past a 30% 30-day drawdown. */
export function isTvlCollapsing(analysis: ProductAnalysis): boolean {
  if (!analysis.tvl30d) return false;
  return analysis.tvl30d.changePct <= -0.3;
}
