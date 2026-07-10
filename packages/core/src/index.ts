// Decision contract — types and schemas
export * from "./contract/index.js";

// Plugin system — capabilities, providers, registry
export * from "./plugin.js";

// Engine — policy derivation, analysis, synthesis
export { decide } from "./engine/decide.js";
export { derivePolicies } from "./engine/policies.js";
export { computeRecommendation, computeConfidence } from "./engine/recommend.js";
export type { RecommendationInput } from "./engine/recommend.js";
export { analyzeSeries, isApyStable, isTvlCollapsing } from "./engine/analyze.js";
export type { ProductAnalysis, SeriesStats } from "./engine/analyze.js";

// Shared helpers
export { chainName, chainIndex } from "./chains.js";
export { formatPercent, formatTvl } from "./format.js";
