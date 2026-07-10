export * from "./contract/index.js";
export * from "./plugin.js";
export { derivePolicies } from "./engine/policies.js";
export { computeRecommendation, computeConfidence } from "./engine/recommend.js";
export type { RecommendationInput } from "./engine/recommend.js";
export { decide } from "./engine/decide.js";
export { analyzeSeries, isApyStable, isTvlCollapsing } from "./engine/analyze.js";
export type { ProductAnalysis, SeriesStats } from "./engine/analyze.js";
