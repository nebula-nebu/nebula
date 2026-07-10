import { randomUUID } from "node:crypto";
import type {
  Decision,
  DecisionRequest,
  DerivedPolicy,
  ExecutionStep,
  GoalFeasibility,
} from "../contract/index.js";
import type { PluginRegistry, YieldDataProvider, YieldProduct } from "../plugin.js";
import { analyzeSeries, isApyStable, isTvlCollapsing, type ProductAnalysis } from "./analyze.js";
import { derivePolicies } from "./policies.js";
import { computeConfidence, computeRecommendation } from "./recommend.js";

const STABLECOINS = new Set(["USDT", "USDC", "DAI", "USDG"]);
const TRUST_TVL_FLOOR_USD = 50_000_000;

const CHAIN_NAMES: Record<string, string> = {
  "1": "ethereum",
  "196": "xlayer",
};

interface PortfolioAsset {
  token: string;
  amount: string;
  chain: string;
}

interface RejectedCandidate {
  product: YieldProduct;
  policy: DerivedPolicy["policy"];
  reason: string;
}

interface DecisionContext {
  policies: DerivedPolicy[];
  unmatched: string[];
  cautionFlags: string[];
  idleStable: PortfolioAsset[];
  heldVolatile: PortfolioAsset[];
}

function chainName(chainIndex: string): string {
  return CHAIN_NAMES[chainIndex] ?? chainIndex;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function tvlM(value: number): string {
  return `$${(value / 1_000_000).toFixed(0)}M`;
}

function hasPolicy(policies: DerivedPolicy[], id: DerivedPolicy["policy"]): boolean {
  return policies.some((p) => p.policy === id);
}

function buildContext(request: DecisionRequest): DecisionContext {
  const { policies, unmatched } = derivePolicies(request.preferences);
  const assets = request.portfolio.assets ?? [];
  return {
    policies,
    unmatched,
    cautionFlags: unmatched.map((phrase) => `unrecognized preference: "${phrase}"`),
    idleStable: assets.filter((a) => STABLECOINS.has(a.token.toUpperCase())),
    heldVolatile: assets.filter((a) => !STABLECOINS.has(a.token.toUpperCase())),
  };
}

function refusalDecision(
  decisionId: string,
  context: DecisionContext,
  hasProvider: boolean,
): Decision {
  const confidence = computeConfidence({
    data_completeness: hasProvider ? 0.8 : 0.2,
    data_freshness: 1,
    policy_clarity: context.unmatched.length === 0 ? 1 : 0.7,
    execution_readiness: 0.3,
  });
  const summary = hasProvider
    ? "No idle stable balance was found to deploy, so nothing will be moved."
    : "No market data source is available, so no decision can be made safely.";
  const why = hasProvider
    ? "There is no idle stable balance in the portfolio to put to work."
    : "No yield data provider is registered — deciding without data would be a guess.";

  return {
    decision_id: decisionId,
    decision_summary: summary,
    human_summary: ["Nothing will be moved today."],
    recommendation: "dont_proceed",
    risk: "low",
    confidence,
    goal_feasibility: { achievable: false, alternatives: ["add a stable balance to deploy"] },
    derived_policies: context.policies,
    why: [why],
    execution_plan: [],
  };
}

function resolveAllowedChains(
  request: DecisionRequest,
  context: DecisionContext,
): string[] | undefined {
  if (request.constraints?.chains) return request.constraints.chains;
  if (hasPolicy(context.policies, "no_bridges")) {
    return [...new Set(context.idleStable.map((a) => a.chain.toLowerCase()))];
  }
  return undefined;
}

async function collectProducts(
  provider: YieldDataProvider,
  idleStable: PortfolioAsset[],
): Promise<YieldProduct[]> {
  const tokens = [...new Set(idleStable.map((a) => a.token.toUpperCase()))];
  const results = await Promise.all(
    tokens.map((token) => provider.searchProducts({ token, productGroup: "SINGLE_EARN" })),
  );
  return results.flat();
}

function filterByChains(
  products: YieldProduct[],
  allowedChains: string[] | undefined,
  rejected: RejectedCandidate[],
): YieldProduct[] {
  if (!allowedChains) return products;
  return products.filter((p) => {
    if (allowedChains.includes(chainName(p.chain))) return true;
    rejected.push({
      product: p,
      policy: "no_bridges",
      reason: `${p.platform} pays ${pct(p.apy)} but lives on ${chainName(p.chain)} — reaching it needs a bridge`,
    });
    return false;
  });
}

function filterByTrust(
  products: YieldProduct[],
  context: DecisionContext,
  rejected: RejectedCandidate[],
): YieldProduct[] {
  if (!hasPolicy(context.policies, "meets_trust_criteria")) return products;
  return products.filter((p) => {
    if (p.tvlUsd >= TRUST_TVL_FLOOR_USD) return true;
    rejected.push({
      product: p,
      policy: "meets_trust_criteria",
      reason: `${p.platform} pays ${pct(p.apy)} but its ${tvlM(p.tvlUsd)} TVL is below your trust threshold`,
    });
    return false;
  });
}

async function analyzeCandidates(
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

function dropCollapsingTvl(
  analyses: ProductAnalysis[],
  rejected: RejectedCandidate[],
): ProductAnalysis[] {
  return analyses.filter((a) => {
    if (!isTvlCollapsing(a)) return true;
    rejected.push({
      product: a.product,
      policy: "meets_trust_criteria",
      reason: `${a.product.platform} lost ${pct(Math.abs(a.tvl30d!.changePct))} of its TVL in 30 days — liquidity risk`,
    });
    return false;
  });
}

/** A policy is binding when it rejected an option better than the outcome. */
function markBindingPolicies(
  policies: DerivedPolicy[],
  rejected: RejectedCandidate[],
  chosen: ProductAnalysis | null,
): DerivedPolicy[] {
  const binding = new Set(
    rejected.filter((r) => !chosen || r.product.apy > chosen.product.apy).map((r) => r.policy),
  );
  return policies.map((p) => {
    if (!binding.has(p.policy)) return p;
    return {
      ...p,
      status: "binding" as const,
      note: rejected.find((r) => r.policy === p.policy)?.reason,
    };
  });
}

function describeChosen(chosen: ProductAnalysis): string[] {
  const lines: string[] = [];
  if (chosen.apy30d) {
    const stable = isApyStable(chosen) ? " — stable" : "";
    lines.push(
      `${chosen.product.platform} pays ${pct(chosen.product.apy)} and stayed between ${pct(chosen.apy30d.min)} and ${pct(chosen.apy30d.max)} over 30 days${stable}`,
    );
  } else {
    lines.push(`${chosen.product.platform} pays ${pct(chosen.product.apy)}`);
  }

  let tvlTrend = "";
  if (chosen.tvl30d) {
    const sign = chosen.tvl30d.changePct >= 0 ? "+" : "";
    tvlTrend = ` (${sign}${pct(chosen.tvl30d.changePct)} over 30 days)`;
  }
  lines.push(`${chosen.product.platform} holds ${tvlM(chosen.product.tvlUsd)} in TVL${tvlTrend}`);
  return lines;
}

function buildWhy(
  chosen: ProductAnalysis | null,
  rejected: RejectedCandidate[],
  context: DecisionContext,
): string[] {
  const why: string[] = chosen ? describeChosen(chosen) : [];
  for (const r of rejected) why.push(`Rejected: ${r.reason}`);

  const protectsLosses = hasPolicy(context.policies, "avoid_realizing_losses");
  if (context.heldVolatile.length > 0 && protectsLosses) {
    const held = context.heldVolatile.map((a) => a.token).join(", ");
    why.push(
      `${held} stays untouched — selling could realize a loss and no safety exception is triggered`,
    );
  }
  return why;
}

function buildHumanSummary(chosen: ProductAnalysis | null, context: DecisionContext): string[] {
  if (!chosen) return ["Nothing will be moved today — no option meets your rules."];

  const lines = [`✓ Your stable balance goes to work at ~${pct(chosen.product.apy)}`];
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

function buildSummary(chosen: ProductAnalysis | null, context: DecisionContext): string {
  if (!chosen) return "No option survives your rules today, so nothing will be moved.";
  let summary = `Deploy your idle stable balance into ${chosen.product.platform} at ${pct(chosen.product.apy)}.`;
  if (context.heldVolatile.length > 0) {
    summary += ` Your ${context.heldVolatile.map((a) => a.token).join(", ")} stays untouched.`;
  }
  return summary;
}

function buildPlan(chosen: ProductAnalysis | null, idleStable: PortfolioAsset[]): ExecutionStep[] {
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

function buildFeasibility(chosen: ProductAnalysis | null): GoalFeasibility {
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

/**
 * Sprint-1 decision synthesis: deploy idle stablecoins into the best yield
 * option that survives the user's own policies. Deterministic end to end —
 * same request and same market data always produce the same decision.
 */
export async function decide(
  request: DecisionRequest,
  registry: PluginRegistry,
): Promise<Decision> {
  const decisionId = `dec_${randomUUID().slice(0, 8)}`;
  const context = buildContext(request);

  const provider = registry.find<YieldDataProvider>("yield.products");
  if (!provider || context.idleStable.length === 0) {
    return refusalDecision(decisionId, context, Boolean(provider));
  }

  const rejected: RejectedCandidate[] = [];
  const allowedChains = resolveAllowedChains(request, context);
  const products = await collectProducts(provider, context.idleStable);
  const onAllowedChains = filterByChains(products, allowedChains, rejected);
  const trusted = filterByTrust(onAllowedChains, context, rejected);
  const analyses = await analyzeCandidates(provider, trusted);
  const eligible = dropCollapsingTvl(analyses, rejected);

  eligible.sort((a, b) => b.product.apy - a.product.apy);
  const chosen = eligible[0] ?? null;

  const finalPolicies = markBindingPolicies(context.policies, rejected, chosen);
  const feasibility = buildFeasibility(chosen);

  let dataCompleteness = 0.5;
  if (chosen) {
    dataCompleteness = chosen.apy30d && chosen.tvl30d ? 1 : 0.8;
  }
  const confidence = computeConfidence({
    data_completeness: dataCompleteness,
    data_freshness: 1,
    policy_clarity: context.unmatched.length === 0 ? 1 : 0.7,
    execution_readiness: chosen ? 1 : 0.4,
  });

  const recommendation = computeRecommendation({
    policies: finalPolicies,
    feasibility,
    hardViolations: [],
    cautionFlags: context.cautionFlags,
    confidence,
  });

  return {
    decision_id: decisionId,
    decision_summary: buildSummary(chosen, context),
    human_summary: buildHumanSummary(chosen, context),
    recommendation,
    risk: "low",
    confidence,
    goal_feasibility: feasibility,
    derived_policies: finalPolicies,
    estimated_apy: chosen ? chosen.product.apy : undefined,
    why: buildWhy(chosen, rejected, context),
    history_note: { prior_decision: null, changed: false, reason: null },
    execution_plan: buildPlan(chosen, context.idleStable),
    revalidate_after: "72h",
  };
}
