import type { DecisionRequest, DerivedPolicy } from "../contract/index.js";
import { derivePolicies } from "./policies.js";

const STABLECOINS = new Set(["USDT", "USDC", "DAI", "USDG"]);

export interface PortfolioAsset {
  token: string;
  amount: string;
  chain: string;
}

/** Everything the pipeline derives from the request before touching market data. */
export interface DecisionContext {
  policies: DerivedPolicy[];
  unmatched: string[];
  cautionFlags: string[];
  /** Stable balances that can be put to work. */
  idleStable: PortfolioAsset[];
  /** Volatile holdings the engine may only protect, never trade away. */
  heldVolatile: PortfolioAsset[];
}

export function buildContext(
  request: DecisionRequest,
  resolvedAssets?: PortfolioAsset[],
): DecisionContext {
  const { policies, unmatched } = derivePolicies(request.preferences);
  const assets = resolvedAssets ?? request.portfolio.assets ?? [];
  return {
    policies,
    unmatched,
    cautionFlags: unmatched.map((phrase) => `unrecognized preference: "${phrase}"`),
    idleStable: assets.filter((a) => STABLECOINS.has(a.token.toUpperCase())),
    heldVolatile: assets.filter((a) => !STABLECOINS.has(a.token.toUpperCase())),
  };
}

export function hasPolicy(policies: DerivedPolicy[], id: DerivedPolicy["policy"]): boolean {
  return policies.some((p) => p.policy === id);
}
