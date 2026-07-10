import type { Confidence, DerivedPolicy, GoalFeasibility, Recommendation } from "@nebula/shared";

export interface RecommendationInput {
  policies: DerivedPolicy[];
  feasibility: GoalFeasibility;
  /** Policies violated by every available option (hard blockers). */
  hardViolations: string[];
  /** Soft concerns that need the user's sign-off. */
  cautionFlags: string[];
  confidence: Confidence;
}

/**
 * The recommendation is computed, never guessed:
 *
 * proceed              — all hard policies pass, goal feasible, risk within limits
 * proceed_with_caution — feasible, but a soft policy or risk factor needs approval
 * dont_proceed         — a hard policy is violated, the goal is unrealistic,
 *                        or the data is not safe enough to decide
 */
export function computeRecommendation(input: RecommendationInput): Recommendation {
  if (input.hardViolations.length > 0) return "dont_proceed";
  if (!input.feasibility.achievable) return "dont_proceed";
  if (input.confidence.level === "low") return "dont_proceed";
  if (input.cautionFlags.length > 0) return "proceed_with_caution";
  if (input.confidence.level === "medium") return "proceed_with_caution";
  return "proceed";
}

/** Confidence from measurable components — never a bare model feeling. */
export function computeConfidence(components: Omit<Confidence, "level">): Confidence {
  const overall =
    components.data_completeness *
    components.data_freshness *
    components.policy_clarity *
    components.execution_readiness;

  const level = overall >= 0.75 ? "high" : overall >= 0.5 ? "medium" : "low";
  return { level, ...components };
}
