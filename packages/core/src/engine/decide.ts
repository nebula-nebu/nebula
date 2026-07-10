import { randomUUID } from "node:crypto";
import type { Decision, DecisionRequest } from "../contract/index.js";
import type { PluginRegistry, YieldDataProvider } from "../plugin.js";
import {
  analyzeCandidates,
  collectProducts,
  dropCollapsingTvl,
  filterByChains,
  filterByTrust,
  markBindingPolicies,
  resolveAllowedChains,
  selectBest,
  type RejectedCandidate,
} from "./candidates.js";
import { buildContext, type DecisionContext } from "./context.js";
import { buildFeasibility, buildPlan } from "./plan.js";
import { buildHumanSummary, buildSummary, buildWhy } from "./presentation.js";
import { computeConfidence, computeRecommendation } from "./recommend.js";
import type { ProductAnalysis } from "./analyze.js";

function newDecisionId(): string {
  return `dec_${randomUUID().slice(0, 8)}`;
}

function refusalDecision(context: DecisionContext, hasProvider: boolean): Decision {
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
    decision_id: newDecisionId(),
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

function buildConfidence(context: DecisionContext, chosen: ProductAnalysis | null) {
  let dataCompleteness = 0.5;
  if (chosen) {
    dataCompleteness = chosen.apy30d && chosen.tvl30d ? 1 : 0.8;
  }
  return computeConfidence({
    data_completeness: dataCompleteness,
    data_freshness: 1,
    policy_clarity: context.unmatched.length === 0 ? 1 : 0.7,
    execution_readiness: chosen ? 1 : 0.4,
  });
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
  const context = buildContext(request);

  const provider = registry.find<YieldDataProvider>("yield.products");
  if (!provider || context.idleStable.length === 0) {
    return refusalDecision(context, Boolean(provider));
  }

  const rejected: RejectedCandidate[] = [];
  const allowedChains = resolveAllowedChains(request, context);
  const products = await collectProducts(provider, context);
  const onAllowedChains = filterByChains(products, allowedChains, rejected);
  const trusted = filterByTrust(onAllowedChains, context, rejected);
  const analyses = await analyzeCandidates(provider, trusted);
  const eligible = dropCollapsingTvl(analyses, rejected);
  const chosen = selectBest(eligible);

  const finalPolicies = markBindingPolicies(context.policies, rejected, chosen);
  const feasibility = buildFeasibility(chosen);
  const confidence = buildConfidence(context, chosen);

  const recommendation = computeRecommendation({
    policies: finalPolicies,
    feasibility,
    hardViolations: [],
    cautionFlags: context.cautionFlags,
    confidence,
  });

  return {
    decision_id: newDecisionId(),
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
