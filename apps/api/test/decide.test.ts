import { describe, expect, it } from "vitest";
import { PluginRegistry } from "@nebula/core";
import { createApp } from "../src/app.js";

const app = createApp(new PluginRegistry());

describe("POST /decide", () => {
  it("turns plain-language preferences into a policy-backed recommendation", async () => {
    const response = await app.request("/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portfolio: { assets: [{ token: "USDT", amount: "800", chain: "ethereum" }] },
        goal: "I want a family trip to Japan in 4 months",
        preferences: ["I don't want to lose money", "I want to withdraw anytime"],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.recommendation).toBe("proceed");
    expect(body.data.derived_policies.map((p: { policy: string }) => p.policy)).toEqual([
      "avoid_realizing_losses",
      "liquid_only",
    ]);
    expect(body.data.confidence.level).toBe("high");
  });

  it("flags unrecognized preferences as caution instead of ignoring them", async () => {
    const response = await app.request("/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portfolio: {},
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
    expect(Array.isArray(body.plugins)).toBe(true);
  });
});
