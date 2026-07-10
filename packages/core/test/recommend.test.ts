import { describe, expect, it } from "vitest";
import { computeConfidence, computeRecommendation } from "../src/engine/recommend.js";
import type { Confidence, GoalFeasibility } from "../src/contract/index.js";

const feasible: GoalFeasibility = { achievable: true, alternatives: [] };
const infeasible: GoalFeasibility = {
  achievable: false,
  alternatives: ["extend the timeframe"],
};

function confidence(level: Confidence["level"]): Confidence {
  return {
    level,
    data_completeness: 1,
    data_freshness: 1,
    policy_clarity: 1,
    execution_readiness: 1,
  };
}

describe("computeRecommendation", () => {
  it("proceeds when everything passes", () => {
    expect(
      computeRecommendation({
        policies: [],
        feasibility: feasible,
        hardViolations: [],
        cautionFlags: [],
        confidence: confidence("high"),
      }),
    ).toBe("proceed");
  });

  it("never proceeds past a hard policy violation", () => {
    expect(
      computeRecommendation({
        policies: [],
        feasibility: feasible,
        hardViolations: ["avoid_realizing_losses"],
        cautionFlags: [],
        confidence: confidence("high"),
      }),
    ).toBe("dont_proceed");
  });

  it("declines unrealistic goals", () => {
    expect(
      computeRecommendation({
        policies: [],
        feasibility: infeasible,
        hardViolations: [],
        cautionFlags: [],
        confidence: confidence("high"),
      }),
    ).toBe("dont_proceed");
  });

  it("declines when the data is not safe enough to decide", () => {
    expect(
      computeRecommendation({
        policies: [],
        feasibility: feasible,
        hardViolations: [],
        cautionFlags: [],
        confidence: confidence("low"),
      }),
    ).toBe("dont_proceed");
  });

  it("asks for approval when a caution flag is raised", () => {
    expect(
      computeRecommendation({
        policies: [],
        feasibility: feasible,
        hardViolations: [],
        cautionFlags: ["unrecognized preference"],
        confidence: confidence("high"),
      }),
    ).toBe("proceed_with_caution");
  });
});

describe("computeConfidence", () => {
  it("multiplies components into a level", () => {
    expect(
      computeConfidence({
        data_completeness: 1,
        data_freshness: 1,
        policy_clarity: 1,
        execution_readiness: 1,
      }).level,
    ).toBe("high");

    expect(
      computeConfidence({
        data_completeness: 0.9,
        data_freshness: 0.9,
        policy_clarity: 0.8,
        execution_readiness: 0.9,
      }).level,
    ).toBe("medium");

    expect(
      computeConfidence({
        data_completeness: 0.5,
        data_freshness: 0.9,
        policy_clarity: 0.8,
        execution_readiness: 0.9,
      }).level,
    ).toBe("low");
  });
});
