import { describe, expect, it } from "vitest";
import { decide } from "../src/engine/decide.js";
import { PluginRegistry } from "../src/plugin.js";
import type {
  BalanceProvider,
  Capability,
  SeriesPoint,
  YieldDataProvider,
  YieldProduct,
} from "../src/plugin.js";

const PRODUCTS: YieldProduct[] = [
  // Solid, on the user's chain.
  {
    investmentId: "27200",
    name: "USDT",
    platform: "Fluid",
    chain: "1",
    apy: 0.0559,
    tvlUsd: 126_044_186,
  },
  // Higher APY but tiny TVL — must fall to the trust filter.
  {
    investmentId: "666",
    name: "USDT",
    platform: "SketchyFarm",
    chain: "1",
    apy: 0.11,
    tvlUsd: 3_000_000,
  },
  // Higher APY but on another chain — must fall to the no-bridges filter.
  {
    investmentId: "777",
    name: "USDT",
    platform: "FarChain",
    chain: "196",
    apy: 0.08,
    tvlUsd: 900_000_000,
  },
];

function series(values: number[]): SeriesPoint[] {
  return values.map((value, i) => ({ timestamp: 1_783_000_000_000 + i * 3_600_000, value }));
}

class StubYieldProvider implements YieldDataProvider {
  readonly name = "stub-yield";
  readonly capabilities: readonly Capability[] = ["yield.products", "yield.history"];

  constructor(
    private readonly products: YieldProduct[] = PRODUCTS,
    private readonly tvlSeries: SeriesPoint[] = series([120_000_000, 124_000_000, 126_000_000]),
  ) {}

  searchProducts(): Promise<YieldProduct[]> {
    return Promise.resolve(this.products);
  }
  apyHistory(): Promise<SeriesPoint[]> {
    return Promise.resolve(series([0.052, 0.055, 0.0559]));
  }
  tvlHistory(): Promise<SeriesPoint[]> {
    return Promise.resolve(this.tvlSeries);
  }
}

function registryWith(provider?: YieldDataProvider): PluginRegistry {
  const registry = new PluginRegistry();
  if (provider) registry.register(provider);
  return registry;
}

const REQUEST = {
  portfolio: {
    assets: [
      { token: "ETH", amount: "2", chain: "ethereum" },
      { token: "USDT", amount: "800", chain: "ethereum" },
    ],
  },
  goal: "I want a family trip to Japan in 4 months",
  preferences: [
    "I don't want to lose money",
    "I want to withdraw anytime",
    "only trusted investments",
    "keep it simple",
  ],
};

describe("decide", () => {
  it("deploys idle stables into the best option that survives the user's rules", async () => {
    const decision = await decide(REQUEST, registryWith(new StubYieldProvider()));

    expect(decision.recommendation).toBe("proceed");
    expect(decision.estimated_apy).toBeCloseTo(0.0559, 6);
    expect(decision.execution_plan).toEqual([
      {
        step: 1,
        action: "defi_deposit",
        protocol: "Fluid",
        token: "USDT",
        amount: "800",
        chain: "ethereum",
        investment_id: "27200",
      },
    ]);
  });

  it("marks policies binding when they rejected a higher-yield option", async () => {
    const decision = await decide(REQUEST, registryWith(new StubYieldProvider()));

    const byPolicy = Object.fromEntries(decision.derived_policies.map((p) => [p.policy, p]));
    expect(byPolicy.meets_trust_criteria?.status).toBe("binding");
    expect(byPolicy.no_bridges?.status).toBe("binding");
    expect(decision.why.join("\n")).toContain("SketchyFarm");
    expect(decision.why.join("\n")).toContain("FarChain");
  });

  it("keeps the human and machine layers consistent — held assets never appear in the plan", async () => {
    const decision = await decide(REQUEST, registryWith(new StubYieldProvider()));

    expect(decision.human_summary.join("\n")).toContain("ETH will not be sold");
    for (const step of decision.execution_plan) {
      expect(step.action).not.toBe("swap");
      expect(step.token).not.toBe("ETH");
    }
  });

  it("declines when nothing survives a TVL collapse", async () => {
    const collapsing = new StubYieldProvider(
      [PRODUCTS[0]!],
      series([200_000_000, 150_000_000, 120_000_000]),
    );
    const decision = await decide(REQUEST, registryWith(collapsing));

    expect(decision.recommendation).toBe("dont_proceed");
    expect(decision.execution_plan).toEqual([]);
    expect(decision.goal_feasibility.achievable).toBe(false);
    expect(decision.goal_feasibility.alternatives.length).toBeGreaterThan(0);
  });

  it("declines when there is no idle stable balance", async () => {
    const decision = await decide(
      { ...REQUEST, portfolio: { assets: [{ token: "ETH", amount: "2", chain: "ethereum" }] } },
      registryWith(new StubYieldProvider()),
    );
    expect(decision.recommendation).toBe("dont_proceed");
    expect(decision.execution_plan).toEqual([]);
  });

  it("declines rather than guessing when no data provider is registered", async () => {
    const decision = await decide(REQUEST, registryWith());
    expect(decision.recommendation).toBe("dont_proceed");
    expect(decision.why.join("\n")).toContain("data provider");
  });

  it("resolves holdings from an address when a balance provider is registered", async () => {
    const stubBalances: BalanceProvider = {
      name: "stub-balances",
      capabilities: ["portfolio.balances"],
      balances: async () => [
        { token: "USDT", amount: "500", chain: "ethereum" },
        { token: "ETH", amount: "1", chain: "ethereum" },
      ],
    };
    const registry = registryWith(new StubYieldProvider()).register(stubBalances);

    const decision = await decide(
      { ...REQUEST, portfolio: { address: "0xb4d66641bdd4e8b1d6b9adc8367a37d409f117f3" } },
      registry,
    );

    expect(decision.recommendation).toBe("proceed");
    expect(decision.execution_plan[0]).toMatchObject({ token: "USDT", amount: "500" });
    expect(decision.human_summary.join("\n")).toContain("ETH will not be sold");
  });
});
