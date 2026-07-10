/** 0.0559 → "5.59%" */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** 126_044_186 → "$126M" */
export function formatTvl(value: number): string {
  return `$${(value / 1_000_000).toFixed(0)}M`;
}
