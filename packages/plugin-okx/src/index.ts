import type { PluginRegistry } from "@nebula/core";
import { OnchainosClient, type CommandRunner } from "./client.js";
import { OkxDefiProvider } from "./defi.js";
import { OkxMarketProvider } from "./market.js";
import { OkxSecurityProvider } from "./security.js";

export { OnchainosClient, OnchainosError, type CommandRunner } from "./client.js";
export { OkxDefiProvider } from "./defi.js";
export { OkxMarketProvider } from "./market.js";
export { OkxSecurityProvider } from "./security.js";

/** Register every OKX provider on the given registry. */
export function registerOkxPlugins(
  registry: PluginRegistry,
  client: CommandRunner = new OnchainosClient(),
): PluginRegistry {
  return registry
    .register(new OkxDefiProvider(client))
    .register(new OkxMarketProvider(client))
    .register(new OkxSecurityProvider(client));
}
