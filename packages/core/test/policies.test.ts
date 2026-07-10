import { describe, expect, it } from "vitest";
import { derivePolicies } from "../src/engine/policies.js";

describe("derivePolicies", () => {
  it("translates plain language into machine policies", () => {
    const { policies, unmatched } = derivePolicies([
      "I don't want to lose money",
      "I want to withdraw anytime",
      "only investments that meet my trust criteria",
    ]);

    expect(unmatched).toEqual([]);
    expect(policies.map((p) => p.policy)).toEqual([
      "avoid_realizing_losses",
      "liquid_only",
      "meets_trust_criteria",
    ]);
  });

  it("keeps safety exceptions on loss-avoidance", () => {
    const { policies } = derivePolicies(["I don't want to lose money"]);
    expect(policies[0]?.exceptions).toContain("material_security_risk");
    expect(policies[0]?.hard).toBe(false);
  });

  it("understands Indonesian phrasing", () => {
    const { policies } = derivePolicies(["jangan sampai aku rugi", "bisa tarik kapan saja"]);
    expect(policies.map((p) => p.policy)).toEqual(["avoid_realizing_losses", "liquid_only"]);
  });

  it("reports unmatched preferences instead of guessing", () => {
    const { policies, unmatched } = derivePolicies(["make me rich overnight"]);
    expect(policies).toEqual([]);
    expect(unmatched).toEqual(["make me rich overnight"]);
  });

  it("deduplicates policies derived from different phrases", () => {
    const { policies } = derivePolicies(["I don't want to lose money", "jangan sampai rugi"]);
    expect(policies.filter((p) => p.policy === "avoid_realizing_losses")).toHaveLength(1);
  });
});
