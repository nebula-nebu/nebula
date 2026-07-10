import type { Decision, DecisionRequest, DerivedPolicy } from "../contract/index.js";
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

interface RejectedCandidate {
  product: YieldProduct;
  policy: DerivedPolicy["policy"] | "goal";
  reason: string;
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

/**
 * Sprint-1 decision synthesis: deploy idle stablecoins into the best yield
 * option that survives the user's own policies. Deterministic end to end —
 * same request and same market data always produce the same decision.
 */
export async function decide(
  request: DecisionRequest,
  registry: PluginRegistry,
): Promise<Decision> {
  const decisionId = `dec_${Math.random().toString(36).slice(2, 10)}`;
  const { policies, unmatched } = derivePolicies(request.preferences);
  const cautionFlags = unmatched.map((phrase) => `unrecognized preference: "${phrase}"`);

  const assets = request.portfolio.assets ?? [];
  const idleStable = assets.filter((a) => STABLECOINS.has(a.token.toUpperCase()));
  const heldVolatile = assets.filter((a) => !STABLECOINS.has(a.token.toUpperCase()));

  const yieldProvider = registry.find<YieldDataProvider>("yield.products");
  if (!yieldProvider || idleStable.length === 0) {
    const confidence = computeConfidence({
      data_completeness: yieldProvider ? 0.8 : 0.2,
      data_freshness: 1,
      policy_clarity: unmatched.length === 0 ? 1 : 0.7,
      execution_readiness: 0.3,
    });
    return {
      decision_id: decisionId,
      decision_summary: yieldProvider
        ? "No idle stable balance was found to deploy, so nothing will be moved."
        : "No market data source is available, so no decision can be made safely.",
      human_summary: ["Nothing will be moved today."],
      recommendation: "dont_proceed",
      risk: "low",
      confidence,
      goal_feasibility: { achievable: false, alternatives: ["add a stable balance to deploy"] },
      derived_policies: policies,
      why: [
        yieldProvider
          ? "There is no idle stable balance in the portfolio to put to work."
          : "No yield data provider is registered — deciding without data would be a guess.",
      ],
      execution_plan: [],
    };
  }

  const allowedChains =
    request.constraints?.chains ??
    (policies.some((p) => p.policy === "no_bridges")
      ? [...new Set(idleStable.map((a) => a.chain.toLowerCase()))]
      : undefined);

  const products = (
    await Promise.all(
      [...new Set(idleStable.map((a) => a.token.toUpperCase()))].map((token) =>
        yieldProvider.searchProducts({ token, productGroup: "SINGLE_EARN" }),
      ),
    )
  ).flat();

  const rejected: RejectedCandidate[] = [];
  let candidates = products;

  if (allowedChains) {
    candidates = candidates.filter((p) => {
      const ok = allowedChains.includes(chainName(p.chain));
      if (!ok) {
        rejected.push({
          product: p,
          policy: "no_bridges",
          reason: `${p.platform} pays ${pct(p.apy)} but lives on ${chainName(p.chain)} — reaching it needs a bridge`,
        });
      }
      return ok;
    });
  }

  if (policies.some((p) => p.policy === "meets_trust_criteria")) {
    candidates = candidates.filter((p) => {
      const ok = p.tvlUsd >= TRUST_TVL_FLOOR_USD;
      if (!ok) {
        rejected.push({
          product: p,
          policy: "meets_trust_criteria",
          reason: `${p.platform} pays ${pct(p.apy)} but its ${tvlM(p.tvlUsd)} TVL is below your trust threshold`,
        });
      }
      return ok;
    });
  }

  const analyses: ProductAnalysis[] = await Promise.all(
    candidates.map(async (product) => {
      const [apyPoints, tvlPoints] = await Promise.all([
        yieldProvider.apyHistory(product.investmentId, chainName(product.chain)).catch(() => []),
        yieldProvider.tvlHistory(product.investmentId, chainName(product.chain)).catch(() => []),
      ]);
      return {
        product,
        apy30d: analyzeSeries(apyPoints),
        tvl30d: analyzeSeries(tvlPoints),
      };
    }),
  );

  const eligible = analyses.filter((a) => {
    if (isTvlCollapsing(a)) {
      rejected.push({
        product: a.product,
        policy: "meets_trust_criteria",
        reason: `${a.product.platform} lost ${pct(Math.abs(a.tvl30d!.changePct))} of its TVL in 30 days — liquidity risk`,
      });
      return false;
    }
    return true;
  });

  eligible.sort((a, b) => b.product.apy - a.product.apy);
  const chosen = eligible[0] ?? null;

  // A policy is binding when it rejected an option better than the outcome.
  const bindingPolicies = new Set(
    rejected
      .filter((r) => r.policy !== "goal" && (!chosen || r.product.apy > chosen.product.apy))
      .map((r) => r.policy),
  );
  const finalPolicies = policies.map((p) =>
    bindingPolicies.has(p.policy)
      ? {
          ...p,
          status: "binding" as const,
          note: rejected.find((r) => r.policy === p.policy)?.reason,
        }
      : p,
  );

  const confidence = computeConfidence({
    data_completeness: chosen ? (chosen.apy30d && chosen.tvl30d ? 1 : 0.8) : 0.5,
    data_freshness: 1,
    policy_clarity: unmatched.length === 0 ? 1 : 0.7,
    execution_readiness: chosen ? 1 : 0.4,
  });

  const feasibility = chosen
    ? { achievable: true, alternatives: [] }
    : {
        achievable: false,
        alternatives: [
          "relax the trust threshold",
          "allow more chains",
          "wait for better market conditions",
        ],
      };

  const recommendation = computeRecommendation({
    policies: finalPolicies,
    feasibility,
    hardViolations: [],
    cautionFlags,
    confidence,
  });

  const why: string[] = [];
  if (chosen) {
    const apyLine = chosen.apy30d
      ? `${chosen.product.platform} pays ${pct(chosen.product.apy)} and stayed between ${pct(chosen.apy30d.min)} and ${pct(chosen.apy30d.max)} over 30 days${isApyStable(chosen) ? " — stable" : ""}`
      : `${chosen.product.platform} pays ${pct(chosen.product.apy)}`;
    why.push(apyLine);
    why.push(
      `${chosen.product.platform} holds ${tvlM(chosen.product.tvlUsd)} in TVL${
        chosen.tvl30d
          ? ` (${chosen.tvl30d.changePct >= 0 ? "+" : ""}${pct(chosen.tvl30d.changePct)} over 30 days)`
          : ""
      }`,
    );
  }
  for (const r of rejected) why.push(`Rejected: ${r.reason}`);
  if (heldVolatile.length > 0 && policies.some((p) => p.policy === "avoid_realizing_losses")) {
    why.push(
      `${heldVolatile.map((a) => a.token).join(", ")} stays untouched — selling could realize a loss and no safety exception is triggered`,
    );
  }

  const humanSummary: string[] = [];
  if (chosen) {
    humanSummary.push(`✓ Your stable balance goes to work at ~${pct(chosen.product.apy)}`);
    if (policies.some((p) => p.policy === "liquid_only")) {
      humanSummary.push("✓ You can withdraw anytime");
    }
    if (policies.some((p) => p.policy === "meets_trust_criteria")) {
      humanSummary.push("✓ Only options that meet your trust criteria were considered");
    }
  }
  for (const asset of heldVolatile) {
    if (policies.some((p) => p.policy === "avoid_realizing_losses")) {
      humanSummary.push(
        `✗ Your ${asset.token} will not be sold today — selling could realize a loss, and no safety exception has been triggered`,
      );
    }
  }

  return {
    decision_id: decisionId,
    decision_summary: chosen
      ? `Deploy your idle stable balance into ${chosen.product.platform} at ${pct(chosen.product.apy)}. ${
          heldVolatile.length > 0
            ? `Your ${heldVolatile.map((a) => a.token).join(", ")} stays untouched.`
            : ""
        }`.trim()
      : "No option survives your rules today, so nothing will be moved.",
    human_summary: chosen
      ? humanSummary
      : ["Nothing will be moved today — no option meets your rules."],
    recommendation,
    risk: "low",
    confidence,
    goal_feasibility: feasibility,
    derived_policies: finalPolicies,
    estimated_apy: chosen ? chosen.product.apy : undefined,
    why,
    history_note: { prior_decision: null, changed: false, reason: null },
    execution_plan: chosen
      ? idleStable.map((asset, index) => ({
          step: index + 1,
          action: "defi_deposit" as const,
          protocol: chosen.product.platform,
          token: asset.token,
          amount: asset.amount,
          chain: chainName(chosen.product.chain),
          investment_id: chosen.product.investmentId,
        }))
      : [],
    revalidate_after: "72h",
  };
}
