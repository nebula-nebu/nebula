import type { Capability, MarketDataProvider, TokenPnl } from "@nebula/core";
import { OnchainosClient, type CommandRunner } from "./client.js";

interface RawPrice {
  price?: string;
}

interface RawTokenPnl {
  unrealizedPnl?: string;
  costBasis?: string;
}

/** Prices and wallet PnL backed by OKX market data. */
export class OkxMarketProvider implements MarketDataProvider {
  readonly name = "okx-market";
  readonly capabilities: readonly Capability[] = ["market.price", "market.pnl"];

  constructor(private readonly client: CommandRunner = new OnchainosClient()) {}

  async price(token: string, chain: string): Promise<number> {
    const data = await this.client.run<RawPrice>([
      "market",
      "price",
      "--token",
      token,
      "--chain",
      chain,
    ]);
    return Number(data.price ?? 0);
  }

  async tokenPnl(address: string, token: string, chain: string): Promise<TokenPnl | null> {
    try {
      const data = await this.client.run<RawTokenPnl>([
        "market",
        "portfolio-token-pnl",
        "--address",
        address,
        "--token",
        token,
        "--chain",
        chain,
      ]);
      if (data.unrealizedPnl === undefined) return null;
      return {
        token,
        chain,
        unrealizedPnlUsd: Number(data.unrealizedPnl),
        costBasisUsd: Number(data.costBasis ?? 0),
      };
    } catch {
      // No trading history for this token — not an error for decision-making.
      return null;
    }
  }
}
