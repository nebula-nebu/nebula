import type { DerivedPolicy } from "../contract/index.js";

interface PolicyRule {
  /** Case-insensitive phrases that signal this intent in plain language. */
  signals: RegExp[];
  derive: (from: string) => DerivedPolicy;
}

/**
 * Plain language in, machine policies out.
 * The user never writes "avoid_realizing_losses" — they say "I don't want to
 * lose money". This table is the translator between the two layers.
 */
const RULES: PolicyRule[] = [
  {
    signals: [/lose money/i, /don'?t want.*loss/i, /jangan.*rugi/i, /tidak.*rugi/i],
    derive: (from) => ({
      from,
      policy: "avoid_realizing_losses",
      status: "pass",
      exceptions: ["material_security_risk", "liquidity_collapse", "portfolio_risk_limit_breached"],
      hard: false,
    }),
  },
  {
    signals: [/withdraw.*anytime/i, /any ?time/i, /kapan (saja|aja)/i, /liquid/i],
    derive: (from) => ({
      from,
      policy: "liquid_only",
      status: "pass",
      exceptions: [],
      hard: false,
    }),
  },
  {
    signals: [/trust/i, /terpercaya/i, /aman/i, /safe/i],
    derive: (from) => ({
      from,
      policy: "meets_trust_criteria",
      status: "pass",
      exceptions: [],
      hard: false,
    }),
  },
  {
    signals: [/simple/i, /ribet/i, /hassle/i, /satu (chain|jaringan)/i],
    derive: (from) => ({
      from,
      policy: "no_bridges",
      status: "pass",
      exceptions: [],
      hard: false,
    }),
  },
];

/** Derive machine policies from the user's own words. Unmatched phrases are kept for review. */
export function derivePolicies(preferences: string[]): {
  policies: DerivedPolicy[];
  unmatched: string[];
} {
  const policies: DerivedPolicy[] = [];
  const unmatched: string[] = [];

  for (const preference of preferences) {
    const matched = RULES.filter((rule) => rule.signals.some((s) => s.test(preference)));
    if (matched.length === 0) {
      unmatched.push(preference);
      continue;
    }
    for (const rule of matched) {
      const derived = rule.derive(preference);
      if (!policies.some((p) => p.policy === derived.policy)) {
        policies.push(derived);
      }
    }
  }

  return { policies, unmatched };
}
