import { z } from "zod";
import { DerivedPolicySchema } from "./policy.js";

/**
 * Recommendation is computed deterministically from policy and feasibility
 * checks — never chosen freely by a language model.
 *
 * proceed              — all hard policies pass, goal feasible, risk within limits
 * proceed_with_caution — goal feasible, but a soft policy or risk factor needs approval
 * dont_proceed         — a hard policy is violated, the goal is unrealistic,
 *                        or the data is not safe enough to decide
 */
export const RecommendationSchema = z.enum(["proceed", "proceed_with_caution", "dont_proceed"]);
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/** Confidence is component-based, never a bare "model feeling". */
export const ConfidenceSchema = z.object({
  level: z.enum(["high", "medium", "low"]),
  data_completeness: z.number().min(0).max(1),
  data_freshness: z.number().min(0).max(1),
  policy_clarity: z.number().min(0).max(1),
  execution_readiness: z.number().min(0).max(1),
});
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const GoalFeasibilitySchema = z.object({
  achievable: z.boolean(),
  expected_completion: z.string().optional(),
  /** Offered when the goal is not realistic: extend time, raise risk, add funds. */
  alternatives: z.array(z.string()).default([]),
});
export type GoalFeasibility = z.infer<typeof GoalFeasibilitySchema>;

/** One step of the plan, mapped 1:1 to an onchainos command the buyer's agent runs. */
export const ExecutionStepSchema = z.object({
  step: z.number().int().positive(),
  action: z.enum(["defi_deposit", "defi_withdraw", "defi_claim", "swap", "bridge", "limit_order"]),
  protocol: z.string().optional(),
  token: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  amount: z.string().optional(),
  chain: z.string(),
  investment_id: z.string().optional(),
});
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;

export const DecisionRequestSchema = z.object({
  /** Wallet address or an explicit asset list. */
  portfolio: z.object({
    address: z.string().optional(),
    assets: z
      .array(z.object({ token: z.string(), amount: z.string(), chain: z.string() }))
      .optional(),
  }),
  /** The goal, in the user's own words. */
  goal: z.string(),
  /** Preferences, in the user's own words — Nebula derives policies from these. */
  preferences: z.array(z.string()).default([]),
  constraints: z
    .object({
      chains: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
});
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

export const DecisionSchema = z.object({
  decision_id: z.string(),
  /** Human layer — always in the user's language, never Web3 jargon first. */
  decision_summary: z.string(),
  human_summary: z.array(z.string()),
  recommendation: RecommendationSchema,
  risk: RiskLevelSchema,
  confidence: ConfidenceSchema,
  goal_feasibility: GoalFeasibilitySchema,
  derived_policies: z.array(DerivedPolicySchema),
  estimated_apy: z.number().optional(),
  estimated_costs: z.object({ gas: z.number().optional() }).optional(),
  /** Why each option was chosen or rejected — every claim backed by real data. */
  why: z.array(z.string()),
  history_note: z
    .object({
      prior_decision: z.string().nullable(),
      changed: z.boolean(),
      reason: z.string().nullable(),
    })
    .optional(),
  /**
   * Machine layer. Consistency with the human layer is non-negotiable:
   * if the summary says "your ETH will not be sold", the plan must not touch ETH.
   */
  execution_plan: z.array(ExecutionStepSchema),
  revalidate_after: z.string().optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;
