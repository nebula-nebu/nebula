import type { Capability, SeriesPoint, YieldDataProvider, YieldProduct } from "@nebula/core";
import { OnchainosClient, type CommandRunner } from "./client.js";

interface RawProduct {
  investmentId: number | string;
  name: string;
  platformName: string;
  chainIndex: string;
  rate: string;
  tvl: string;
}

interface RawRatePoint {
  timestamp: number;
  rate: string;
}

interface RawTvlChart {
  chartVos: { timestamp: number; tvl: string }[];
}

/** Yield data backed by OKX-aggregated DeFi products. */
export class OkxDefiProvider implements YieldDataProvider {
  readonly name = "okx-defi";
  readonly capabilities: readonly Capability[] = ["yield.products", "yield.history"];

  constructor(private readonly client: CommandRunner = new OnchainosClient()) {}

  async searchProducts(query: {
    token: string;
    chain?: string;
    productGroup?: "SINGLE_EARN" | "DEX_POOL" | "LENDING";
  }): Promise<YieldProduct[]> {
    const args = ["defi", "search", "--token", query.token];
    if (query.chain) args.push("--chain", query.chain);
    if (query.productGroup) args.push("--product-group", query.productGroup);

    const data = await this.client.run<{ list: RawProduct[] }>(args);
    return (data.list ?? []).map((raw) => ({
      investmentId: String(raw.investmentId),
      name: raw.name,
      platform: raw.platformName,
      chain: raw.chainIndex,
      apy: Number(raw.rate),
      tvlUsd: Number(raw.tvl),
    }));
  }

  async apyHistory(investmentId: string, chain: string, range = "MONTH"): Promise<SeriesPoint[]> {
    const data = await this.client.run<RawRatePoint[]>([
      "defi",
      "rate-chart",
      "--investment-id",
      investmentId,
      "--chain",
      chain,
      "--time-range",
      range,
    ]);
    return (data ?? []).map((p) => ({ timestamp: p.timestamp, value: Number(p.rate) }));
  }

  async tvlHistory(investmentId: string, chain: string, range = "MONTH"): Promise<SeriesPoint[]> {
    const data = await this.client.run<RawTvlChart>([
      "defi",
      "tvl-chart",
      "--investment-id",
      investmentId,
      "--chain",
      chain,
      "--time-range",
      range,
    ]);
    return (data.chartVos ?? []).map((p) => ({ timestamp: p.timestamp, value: Number(p.tvl) }));
  }
}
