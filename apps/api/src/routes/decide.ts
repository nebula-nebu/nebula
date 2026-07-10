import { Hono } from "hono";
import { DecisionRequestSchema, decide, type PluginRegistry } from "@nebula/core";

export function decideRoutes(registry: PluginRegistry): Hono {
  const app = new Hono();

  app.post("/decide", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = DecisionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.flatten() }, 400);
    }

    const decision = await decide(parsed.data, registry);
    return c.json({ ok: true, data: decision });
  });

  return app;
}
