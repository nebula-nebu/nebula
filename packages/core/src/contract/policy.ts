import { z } from "zod";

/**
 * Machine-readable policies derived from the user's plain-language preferences.
 * The engine derives these; it never asks the user to write them.
 */
export const PolicyIdSchema = z.enum([
  "avoid_realizing_losses",
  "liquid_only",
  "no_lockup",
  "meets_trust_criteria",
  "no_bridges",
  "single_chain",
  "min_apy_floor",
  "max_risk_level",
  "min_stablecoin_ratio",
]);
export type PolicyId = z.infer<typeof PolicyIdSchema>;

/** Safety exceptions under which a binding policy may be overridden. */
export const PolicyExceptionSchema = z.enum([
  "material_security_risk",
  "liquidity_collapse",
  "portfolio_risk_limit_breached",
]);
export type PolicyException = z.infer<typeof PolicyExceptionSchema>;

export const DerivedPolicySchema = z.object({
  /** The user's own words this policy was derived from. */
  from: z.string(),
  policy: PolicyIdSchema,
  /** Optional parameter, e.g. the APY floor or stablecoin ratio. */
  value: z.union([z.string(), z.number()]).optional(),
  /**
   * pass    — satisfied by the chosen plan
   * binding — actively constrained the outcome (an option was rejected because of it)
   */
  status: z.enum(["pass", "binding"]),
  /** Human-readable note, in the user's language. */
  note: z.string().optional(),
  exceptions: z.array(PolicyExceptionSchema).default([]),
  /** True when the user insisted on an absolute rule against Nebula's advice. */
  hard: z.boolean().default(false),
});
export type DerivedPolicy = z.infer<typeof DerivedPolicySchema>;
