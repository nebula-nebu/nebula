import { describe, expect, it } from "vitest";
import { PluginRegistry } from "@nebula/core";
import type { Capability, SeriesPoint, YieldDataProvider, YieldProduct } from "@nebula/core";
import { createApp } from "../src/app.js";

class StubYieldProvider implements YieldDataProvider {
  readonly name = "stub-yield";
  readonly capabilities: readonly Capability[] = ["yield.products", "yield.history"];

  searchProducts(): Promise<YieldProduct[]> {
    return Promise.resolve([
      {
        investmentId: "27200",
        name: "USDT",
        platform: "Fluid",
        chain: "1",
        apy: 0.0559,
        tvlUsd: 126_044_186,
      },
    ]);
  }
  apyHistory(): Promise<SeriesPoint[]> {
    return Promise.resolve([
      { timestamp: 1, value: 0.052 },
      { timestamp: 2, value: 0.0559 },
    ]);
  }
  tvlHistory(): Promise<SeriesPoint[]> {
    return Promise.resolve([
      { timestamp: 1, value: 120_000_000 },
      { timestamp: 2, value: 126_000_000 },
    ]);
  }
}

const app = createApp(new PluginRegistry().register(new StubYieldProvider()));

describe("POST /decide", () => {
  it("returns a full two-layer decision for a plain-language request", async () => {
    const response = await app.request("/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portfolio: {
          assets: [
            { token: "ETH", amount: "2", chain: "ethereum" },
            { token: "USDT", amount: "800", chain: "ethereum" },
          ],
        },
        goal: "I want a family trip to Japan in 4 months",
        preferences: ["I don't want to lose money", "I want to withdraw anytime"],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.recommendation).toBe("proceed");
    expect(body.data.decision_id).toMatch(/^dec_/);
    expect(body.data.human_summary.length).toBeGreaterThan(0);
    expect(body.data.why.length).toBeGreaterThan(0);
    expect(body.data.execution_plan[0]).toMatchObject({
      action: "defi_deposit",
      token: "USDT",
      protocol: "Fluid",
    });
  });

  it("asks for approval when a preference is not understood", async () => {
    const response = await app.request("/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portfolio: { assets: [{ token: "USDT", amount: "500", chain: "ethereum" }] },
        goal: "grow my savings",
        preferences: ["something completely unintelligible"],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.recommendation).toBe("proceed_with_caution");
  });

  it("rejects malformed requests with 400", async () => {
    const response = await app.request("/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: 123 }),
    });
    expect(response.status).toBe(400);
  });
});

describe("GET /health", () => {
  it("reports service identity and registered plugins", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.service).toBe("nebula-api");
    expect(body.plugins).toEqual([
      { name: "stub-yield", capabilities: ["yield.products", "yield.history"] },
    ]);
  });
});
