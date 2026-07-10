import type { DecisionRequest, DerivedPolicy } from "../contract/index.js";
import type { YieldDataProvider, YieldProduct } from "../plugin.js";
import { chainName } from "../chains.js";
import { formatPercent, formatTvl } from "../format.js";
import { analyzeSeries, isTvlCollapsing, type ProductAnalysis } from "./analyze.js";
import { hasPolicy, type DecisionContext } from "./context.js";

const TRUST_TVL_FLOOR_USD = 50_000_000;

export interface RejectedCandidate {
  product: YieldProduct;
  policy: DerivedPolicy["policy"];
  reason: string;
}

export function resolveAllowedChains(
  request: DecisionRequest,
  context: DecisionContext,
): string[] | undefined {
  if (request.constraints?.chains) return request.constraints.chains;
  if (hasPolicy(context.policies, "no_bridges")) {
    return [...new Set(context.idleStable.map((a) => a.chain.toLowerCase()))];
  }
  return undefined;
}

export async function collectProducts(
  provider: YieldDataProvider,
  context: DecisionContext,
): Promise<YieldProduct[]> {
  const tokens = [...new Set(context.idleStable.map((a) => a.token.toUpperCase()))];
  const results = await Promise.all(
    tokens.map((token) => provider.searchProducts({ token, productGroup: "SINGLE_EARN" })),
  );
  return results.flat();
}

export function filterByChains(
  products: YieldProduct[],
  allowedChains: string[] | undefined,
  rejected: RejectedCandidate[],
): YieldProduct[] {
  if (!allowedChains) return products;
  return products.filter((product) => {
    if (allowedChains.includes(chainName(product.chain))) return true;
    rejected.push({
      product,
      policy: "no_bridges",
      reason: `${product.platform} pays ${formatPercent(product.apy)} but lives on ${chainName(product.chain)} — reaching it needs a bridge`,
    });
    return false;
  });
}

export function filterByTrust(
  products: YieldProduct[],
  context: DecisionContext,
  rejected: RejectedCandidate[],
): YieldProduct[] {
  if (!hasPolicy(context.policies, "meets_trust_criteria")) return products;
  return products.filter((product) => {
    if (product.tvlUsd >= TRUST_TVL_FLOOR_USD) return true;
    rejected.push({
      product,
      policy: "meets_trust_criteria",
      reason: `${product.platform} pays ${formatPercent(product.apy)} but its ${formatTvl(product.tvlUsd)} TVL is below your trust threshold`,
    });
    return false;
  });
}

export async function analyzeCandidates(
  provider: YieldDataProvider,
  candidates: YieldProduct[],
): Promise<ProductAnalysis[]> {
  return Promise.all(
    candidates.map(async (product) => {
      const chain = chainName(product.chain);
      const [apyPoints, tvlPoints] = await Promise.all([
        provider.apyHistory(product.investmentId, chain).catch(() => []),
        provider.tvlHistory(product.investmentId, chain).catch(() => []),
      ]);
      return { product, apy30d: analyzeSeries(apyPoints), tvl30d: analyzeSeries(tvlPoints) };
    }),
  );
}

export function dropCollapsingTvl(
  analyses: ProductAnalysis[],
  rejected: RejectedCandidate[],
): ProductAnalysis[] {
  return analyses.filter((analysis) => {
    if (!isTvlCollapsing(analysis)) return true;
    rejected.push({
      product: analysis.product,
      policy: "meets_trust_criteria",
      reason: `${analysis.product.platform} lost ${formatPercent(Math.abs(analysis.tvl30d!.changePct))} of its TVL in 30 days — liquidity risk`,
    });
    return false;
  });
}

/** Pick the best eligible candidate by current APY. */
export function selectBest(eligible: ProductAnalysis[]): ProductAnalysis | null {
  return eligible.toSorted((a, b) => b.product.apy - a.product.apy).at(0) ?? null;
}

/** A policy is binding when it rejected an option better than the outcome. */
export function markBindingPolicies(
  policies: DerivedPolicy[],
  rejected: RejectedCandidate[],
  chosen: ProductAnalysis | null,
): DerivedPolicy[] {
  const binding = new Set(
    rejected.filter((r) => !chosen || r.product.apy > chosen.product.apy).map((r) => r.policy),
  );
  return policies.map((policy) => {
    if (!binding.has(policy.policy)) return policy;
    return {
      ...policy,
      status: "binding" as const,
      note: rejected.find((r) => r.policy === policy.policy)?.reason,
    };
  });
}
