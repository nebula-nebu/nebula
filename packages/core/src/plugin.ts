/**
 * Nebula plugin system.
 *
 * The core is vendor-neutral: it knows how to derive policies, judge
 * feasibility, and compute recommendations — but every fact about the outside
 * world (yields, prices, security) enters through a plugin.
 */

export type Capability =
  | "yield.products"
  | "yield.history"
  | "market.price"
  | "market.pnl"
  | "security.token-scan";

export interface NebulaPlugin {
  readonly name: string;
  readonly capabilities: readonly Capability[];
}

/* ── Yield data ────────────────────────────────────────────── */

export interface YieldProduct {
  investmentId: string;
  name: string;
  platform: string;
  chain: string;
  /** Current APY as a fraction, e.g. 0.0311 for 3.11%. */
  apy: number;
  tvlUsd: number;
}

export interface SeriesPoint {
  timestamp: number;
  value: number;
}

export interface YieldDataProvider extends NebulaPlugin {
  searchProducts(query: {
    token: string;
    chain?: string;
    productGroup?: "SINGLE_EARN" | "DEX_POOL" | "LENDING";
  }): Promise<YieldProduct[]>;
  apyHistory(investmentId: string, chain: string, range?: string): Promise<SeriesPoint[]>;
  tvlHistory(investmentId: string, chain: string, range?: string): Promise<SeriesPoint[]>;
}

/* ── Market data ───────────────────────────────────────────── */

export interface TokenPnl {
  token: string;
  chain: string;
  unrealizedPnlUsd: number;
  costBasisUsd: number;
}

export interface MarketDataProvider extends NebulaPlugin {
  price(token: string, chain: string): Promise<number>;
  tokenPnl(address: string, token: string, chain: string): Promise<TokenPnl | null>;
}

/* ── Security ──────────────────────────────────────────────── */

export interface TokenRiskReport {
  tokenAddress: string;
  chainId: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  /** Raw risk flags that evaluated true, e.g. "isHoneypot". */
  flags: string[];
}

export interface SecurityProvider extends NebulaPlugin {
  scanTokens(tokens: { chainId: string; address: string }[]): Promise<TokenRiskReport[]>;
}

/* ── Registry ──────────────────────────────────────────────── */

export class PluginRegistry {
  private plugins: NebulaPlugin[] = [];

  register(plugin: NebulaPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /** First plugin providing the capability, or null. */
  find<T extends NebulaPlugin>(capability: Capability): T | null {
    return (this.plugins.find((p) => p.capabilities.includes(capability)) as T) ?? null;
  }

  list(): readonly NebulaPlugin[] {
    return this.plugins;
  }
}
