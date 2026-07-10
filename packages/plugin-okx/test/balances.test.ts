import { describe, expect, it } from "vitest";
import { OkxBalanceProvider } from "../src/balances.js";

describe("OkxBalanceProvider", () => {
  it("flattens token assets into typed balances with chain names", async () => {
    const provider = new OkxBalanceProvider({
      get: async () => [
        {
          tokenAssets: [
            {
              chainIndex: "1",
              symbol: "USDT",
              balance: "800",
              tokenContractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
              tokenPrice: "1.0",
            },
            { chainIndex: "196", symbol: "OKB", balance: "3.5", tokenPrice: "50" },
          ],
        },
      ],
    });

    const balances = await provider.balances("0xabc");
    expect(balances).toEqual([
      {
        token: "USDT",
        amount: "800",
        chain: "ethereum",
        tokenAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        valueUsd: 800,
      },
      { token: "OKB", amount: "3.5", chain: "xlayer", tokenAddress: undefined, valueUsd: 175 },
    ]);
  });

  it("translates chain names to indexes in the query", async () => {
    let captured: Record<string, string> | undefined;
    const provider = new OkxBalanceProvider({
      get: async (_path: string, query?: Record<string, string>) => {
        captured = query;
        return [];
      },
    });

    await provider.balances("0xabc", ["ethereum", "xlayer"]);
    expect(captured).toEqual({ address: "0xabc", chains: "1,196" });
  });
});
