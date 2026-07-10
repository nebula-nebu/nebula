import { Hono } from "hono";
import { DecisionRequestSchema, PluginRegistry, decide } from "@nebula/core";

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

    const decision = await decide(parsed.data, registry);
    return c.json({ ok: true, data: decision });
  });

  return app;
}
