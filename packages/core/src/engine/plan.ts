import type { ExecutionStep, GoalFeasibility } from "../contract/index.js";
import { chainName } from "../chains.js";
import type { ProductAnalysis } from "./analyze.js";
import type { PortfolioAsset } from "./context.js";

/**
 * The machine layer of the decision. Consistency with the human layer is
 * non-negotiable: held assets never appear here, only idle stable balances.
 */
export function buildPlan(
  chosen: ProductAnalysis | null,
  idleStable: PortfolioAsset[],
): ExecutionStep[] {
  if (!chosen) return [];
  return idleStable.map((asset, index) => ({
    step: index + 1,
    action: "defi_deposit" as const,
    protocol: chosen.product.platform,
    token: asset.token,
    amount: asset.amount,
    chain: chainName(chosen.product.chain),
    investment_id: chosen.product.investmentId,
  }));
}

export function buildFeasibility(chosen: ProductAnalysis | null): GoalFeasibility {
  if (chosen) return { achievable: true, alternatives: [] };
  return {
    achievable: false,
    alternatives: [
      "relax the trust threshold",
      "allow more chains",
      "wait for better market conditions",
    ],
  };
}
