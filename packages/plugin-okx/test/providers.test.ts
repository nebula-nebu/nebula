import { describe, expect, it } from "vitest";
import type { CommandRunner } from "../src/client.js";
import { OkxDefiProvider } from "../src/defi.js";
import { OkxSecurityProvider } from "../src/security.js";

function stubRunner(responses: Record<string, unknown>): CommandRunner {
  return {
    run<T>(args: string[]): Promise<T> {
      const key = args.slice(0, 2).join(" ");
      if (!(key in responses)) throw new Error(`unexpected command: ${args.join(" ")}`);
      return Promise.resolve(responses[key] as T);
    },
  };
}

describe("OkxDefiProvider", () => {
  it("maps raw products into typed yield products", async () => {
    const provider = new OkxDefiProvider(
      stubRunner({
        "defi search": {
          list: [
            {
              investmentId: 31806066,
              name: "USDT",
              platformName: "Aave V3",
              chainIndex: "1",
              rate: "0.03110",
              tvl: "2319029682.72623",
            },
          ],
        },
      }),
    );

    const products = await provider.searchProducts({ token: "USDT", chain: "ethereum" });
    expect(products).toEqual([
      {
        investmentId: "31806066",
        name: "USDT",
        platform: "Aave V3",
        chain: "1",
        apy: 0.0311,
        tvlUsd: 2319029682.72623,
      },
    ]);
  });

  it("normalizes APY history points", async () => {
    const provider = new OkxDefiProvider(
      stubRunner({
        "defi rate-chart": [
          { timestamp: 1783072800000, rate: "0.0264" },
          { timestamp: 1783076400000, rate: "0.0265" },
        ],
      }),
    );

    const points = await provider.apyHistory("31806066", "ethereum");
    expect(points).toEqual([
      { timestamp: 1783072800000, value: 0.0264 },
      { timestamp: 1783076400000, value: 0.0265 },
    ]);
  });
});

describe("OkxSecurityProvider", () => {
  it("collects true risk flags from the raw scan", async () => {
    const provider = new OkxSecurityProvider(
      stubRunner({
        "security token-scan": [
          {
            tokenAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
            chainId: "1",
            riskLevel: "LOW",
            isHoneypot: false,
            isMintable: true,
            buyTaxes: "0.0",
          },
        ],
      }),
    );

    const reports = await provider.scanTokens([
      { chainId: "1", address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.riskLevel).toBe("LOW");
    expect(reports[0]?.flags).toEqual(["isMintable"]);
  });

  it("returns empty for an empty token list without calling the CLI", async () => {
    const provider = new OkxSecurityProvider(stubRunner({}));
    await expect(provider.scanTokens([])).resolves.toEqual([]);
  });
});
