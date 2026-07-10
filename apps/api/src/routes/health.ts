import { Hono } from "hono";
import type { PluginRegistry } from "@nebula/core";

export function healthRoutes(registry: PluginRegistry): Hono {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "nebula-api",
      plugins: registry.list().map((p) => ({ name: p.name, capabilities: p.capabilities })),
    }),
  );

  return app;
}
