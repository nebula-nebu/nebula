import { serve } from "@hono/node-server";
import { PluginRegistry } from "@nebula/core";
import { registerOkxPlugins, registerOkxRestPlugins } from "@nebula/plugin-okx";
import { createApp } from "./app.js";

const registry = registerOkxPlugins(new PluginRegistry());
if (registerOkxRestPlugins(registry)) {
  console.log("OKX Open API credentials found — REST providers registered");
}
const app = createApp(registry);

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`nebula-api listening on :${info.port}`);
});
