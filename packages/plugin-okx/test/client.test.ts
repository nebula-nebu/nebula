import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OnchainosClient, OnchainosError } from "../src/client.js";

async function fakeBinary(script: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nebula-okx-"));
  const path = join(dir, "onchainos");
  await writeFile(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return path;
}

describe("OnchainosClient", () => {
  it("parses the JSON envelope and returns data", async () => {
    const binary = await fakeBinary(`echo '{"ok":true,"data":{"value":42}}'`);
    const client = new OnchainosClient({ binary });
    await expect(client.run<{ value: number }>(["anything"])).resolves.toEqual({ value: 42 });
  });

  it("skips status lines printed before the JSON envelope", async () => {
    const binary = await fakeBinary(
      `echo '[onchainos] checking readiness...'\necho '{"ok":true,"data":{"ready":true}}'`,
    );
    const client = new OnchainosClient({ binary });
    await expect(client.run<{ ready: boolean }>(["anything"])).resolves.toEqual({ ready: true });
  });

  it("throws OnchainosError when the CLI reports failure", async () => {
    const binary = await fakeBinary(`echo '{"ok":false}'`);
    const client = new OnchainosClient({ binary });
    await expect(client.run(["anything"])).rejects.toBeInstanceOf(OnchainosError);
  });

  it("throws OnchainosError when no JSON is produced", async () => {
    const binary = await fakeBinary(`echo 'plain text only'`);
    const client = new OnchainosClient({ binary });
    await expect(client.run(["anything"])).rejects.toBeInstanceOf(OnchainosError);
  });
});
