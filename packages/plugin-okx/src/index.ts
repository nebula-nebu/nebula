import type { PluginRegistry } from "@nebula/core";
import { OnchainosClient, type CommandRunner } from "./client.js";
import { OkxBalanceProvider } from "./balances.js";
import { OkxDefiProvider } from "./defi.js";
import { OkxMarketProvider } from "./market.js";
import { OkxRestClient } from "./rest.js";
import { OkxSecurityProvider } from "./security.js";

export { OnchainosClient, OnchainosError, type CommandRunner } from "./client.js";
export { OkxDefiProvider } from "./defi.js";
export { OkxMarketProvider } from "./market.js";
export { OkxSecurityProvider } from "./security.js";
export { OkxRestClient, OkxRestError, type OkxRestConfig } from "./rest.js";
export { OkxBalanceProvider } from "./balances.js";

/** Register every CLI-backed OKX provider on the given registry. */
export function registerOkxPlugins(
  registry: PluginRegistry,
  client: CommandRunner = new OnchainosClient(),
): PluginRegistry {
  return registry
    .register(new OkxDefiProvider(client))
    .register(new OkxMarketProvider(client))
    .register(new OkxSecurityProvider(client));
}

/**
 * Register REST-backed providers when OKX Open API credentials are available
 * (OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE, optional OKX_PROJECT_ID).
 * Returns false when credentials are absent — callers may fall back to CLI-only.
 */
export function registerOkxRestPlugins(
  registry: PluginRegistry,
  client: OkxRestClient | null = OkxRestClient.fromEnv(),
): boolean {
  if (!client) return false;
  registry.register(new OkxBalanceProvider(client));
  return true;
}
