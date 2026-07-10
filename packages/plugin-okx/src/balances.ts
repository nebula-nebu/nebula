import type { BalanceProvider, Capability, PortfolioBalance } from "@nebula/core";
import { chainIndex, chainName } from "@nebula/core";
import type { OkxRestClient } from "./rest.js";

type RestGetter = Pick<OkxRestClient, "get">;

interface RawTokenAsset {
  chainIndex: string;
  symbol: string;
  balance: string;
  tokenContractAddress?: string;
  tokenPrice?: string;
}

interface RawBalanceEntry {
  tokenAssets?: RawTokenAsset[];
}

/**
 * Wallet balances via the OKX Open API —
 * GET /api/v6/dex/balance/all-token-balances-by-address.
 */
export class OkxBalanceProvider implements BalanceProvider {
  readonly name = "okx-balances";
  readonly capabilities: readonly Capability[] = ["portfolio.balances"];

  constructor(private readonly client: RestGetter) {}

  async balances(address: string, chains?: string[]): Promise<PortfolioBalance[]> {
    const query: Record<string, string> = { address };
    if (chains && chains.length > 0) {
      query.chains = chains.map((c) => chainIndex(c)).join(",");
    }

    const data = await this.client.get<RawBalanceEntry[]>(
      "/api/v6/dex/balance/all-token-balances-by-address",
      query,
    );

    return (data ?? []).flatMap((entry) =>
      (entry.tokenAssets ?? []).map((asset) => {
        const price = Number(asset.tokenPrice ?? 0);
        const amount = Number(asset.balance);
        return {
          token: asset.symbol,
          amount: asset.balance,
          chain: chainName(asset.chainIndex),
          tokenAddress: asset.tokenContractAddress,
          valueUsd: price > 0 ? price * amount : undefined,
        };
      }),
    );
  }
}
