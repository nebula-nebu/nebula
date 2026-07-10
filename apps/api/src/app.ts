import { Hono } from "hono";
import type { PluginRegistry } from "@nebula/core";
import { decideRoutes } from "./routes/decide.js";
import { healthRoutes } from "./routes/health.js";

export function createApp(registry: PluginRegistry): Hono {
  return new Hono().route("/", healthRoutes(registry)).route("/", decideRoutes(registry));
}
