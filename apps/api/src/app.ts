import { Hono } from "hono";
import {
  DecisionRequestSchema,
  PluginRegistry,
  computeConfidence,
  computeRecommendation,
  derivePolicies,
} from "@nebula/core";

export function createApp(registry: PluginRegistry): Hono {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "nebula-api",
      plugins: registry.list().map((p) => ({ name: p.name, capabilities: p.capabilities })),
    }),
  );

  app.post("/decide", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = DecisionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.flatten() }, 400);
    }

    const request = parsed.data;
    const { policies, unmatched } = derivePolicies(request.preferences);

    const confidence = computeConfidence({
      data_completeness: 1,
      data_freshness: 1,
      policy_clarity: unmatched.length === 0 ? 1 : 0.7,
      execution_readiness: 1,
    });

    const recommendation = computeRecommendation({
      policies,
      feasibility: { achievable: true, alternatives: [] },
      hardViolations: [],
      cautionFlags: unmatched.map((phrase) => `unrecognized preference: "${phrase}"`),
      confidence,
    });

    // Market data integration and decision synthesis land here next.
    return c.json({
      ok: true,
      data: {
        goal: request.goal,
        derived_policies: policies,
        recommendation,
        confidence,
      },
    });
  });

  return app;
}
