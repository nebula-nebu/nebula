import { formatPercent, formatTvl } from "../format.js";
import { isApyStable, type ProductAnalysis } from "./analyze.js";
import { hasPolicy, type DecisionContext } from "./context.js";
import type { RejectedCandidate } from "./candidates.js";

function describeChosen(chosen: ProductAnalysis): string[] {
  const lines: string[] = [];
  if (chosen.apy30d) {
    const stable = isApyStable(chosen) ? " — stable" : "";
    lines.push(
      `${chosen.product.platform} pays ${formatPercent(chosen.product.apy)} and stayed between ${formatPercent(chosen.apy30d.min)} and ${formatPercent(chosen.apy30d.max)} over 30 days${stable}`,
    );
  } else {
    lines.push(`${chosen.product.platform} pays ${formatPercent(chosen.product.apy)}`);
  }

  let tvlTrend = "";
  if (chosen.tvl30d) {
    const sign = chosen.tvl30d.changePct >= 0 ? "+" : "";
    tvlTrend = ` (${sign}${formatPercent(chosen.tvl30d.changePct)} over 30 days)`;
  }
  lines.push(
    `${chosen.product.platform} holds ${formatTvl(chosen.product.tvlUsd)} in TVL${tvlTrend}`,
  );
  return lines;
}

/** Machine-facing evidence: why the choice was made, why others were rejected. */
export function buildWhy(
  chosen: ProductAnalysis | null,
  rejected: RejectedCandidate[],
  context: DecisionContext,
): string[] {
  const why: string[] = chosen ? describeChosen(chosen) : [];
  for (const r of rejected) why.push(`Rejected: ${r.reason}`);

  if (context.heldVolatile.length > 0 && hasPolicy(context.policies, "avoid_realizing_losses")) {
    const held = context.heldVolatile.map((a) => a.token).join(", ");
    why.push(
      `${held} stays untouched — selling could realize a loss and no safety exception is triggered`,
    );
  }
  return why;
}

/** Human-facing lines — always in the user's terms, never Web3 jargon first. */
export function buildHumanSummary(
  chosen: ProductAnalysis | null,
  context: DecisionContext,
): string[] {
  if (!chosen) return ["Nothing will be moved today — no option meets your rules."];

  const lines = [`✓ Your stable balance goes to work at ~${formatPercent(chosen.product.apy)}`];
  if (hasPolicy(context.policies, "liquid_only")) {
    lines.push("✓ You can withdraw anytime");
  }
  if (hasPolicy(context.policies, "meets_trust_criteria")) {
    lines.push("✓ Only options that meet your trust criteria were considered");
  }
  if (hasPolicy(context.policies, "avoid_realizing_losses")) {
    for (const asset of context.heldVolatile) {
      lines.push(
        `✗ Your ${asset.token} will not be sold today — selling could realize a loss, and no safety exception has been triggered`,
      );
    }
  }
  return lines;
}

export function buildSummary(chosen: ProductAnalysis | null, context: DecisionContext): string {
  if (!chosen) return "No option survives your rules today, so nothing will be moved.";
  let summary = `Deploy your idle stable balance into ${chosen.product.platform} at ${formatPercent(chosen.product.apy)}.`;
  if (context.heldVolatile.length > 0) {
    summary += ` Your ${context.heldVolatile.map((a) => a.token).join(", ")} stays untouched.`;
  }
  return summary;
}
