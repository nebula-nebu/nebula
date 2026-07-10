import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { OkxRestClient, OkxRestError } from "../src/rest.js";

const CONFIG = {
  apiKey: "test-key",
  secretKey: "test-secret",
  passphrase: "test-pass",
  projectId: "test-project",
};

const FIXED_NOW = new Date("2026-07-10T12:00:00.000Z");

function fakeFetch(payload: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

describe("OkxRestClient", () => {
  it("signs GET requests over timestamp + method + path-with-query", async () => {
    const fetchImpl = fakeFetch({ code: "0", data: [] });
    const client = new OkxRestClient(CONFIG, fetchImpl, () => FIXED_NOW);

    await client.get("/api/v6/dex/balance/all-token-balances-by-address", { address: "0xabc" });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(
      "https://web3.okx.com/api/v6/dex/balance/all-token-balances-by-address?address=0xabc",
    );

    const headers = init.headers as Record<string, string>;
    const expectedSign = createHmac("sha256", CONFIG.secretKey)
      .update(
        `${FIXED_NOW.toISOString()}GET/api/v6/dex/balance/all-token-balances-by-address?address=0xabc`,
      )
      .digest("base64");
    expect(headers["OK-ACCESS-KEY"]).toBe(CONFIG.apiKey);
    expect(headers["OK-ACCESS-PASSPHRASE"]).toBe(CONFIG.passphrase);
    expect(headers["OK-ACCESS-PROJECT"]).toBe(CONFIG.projectId);
    expect(headers["OK-ACCESS-TIMESTAMP"]).toBe(FIXED_NOW.toISOString());
    expect(headers["OK-ACCESS-SIGN"]).toBe(expectedSign);
  });

  it("includes the JSON body in POST signatures", async () => {
    const fetchImpl = fakeFetch({ code: "0", data: { ok: true } });
    const client = new OkxRestClient(CONFIG, fetchImpl, () => FIXED_NOW);

    await client.post("/api/v6/dex/market/price", [{ chainIndex: "1" }]);

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = init.body as string;
    expect(body).toBe(JSON.stringify([{ chainIndex: "1" }]));

    const headers = init.headers as Record<string, string>;
    const expectedSign = createHmac("sha256", CONFIG.secretKey)
      .update(`${FIXED_NOW.toISOString()}POST/api/v6/dex/market/price${body}`)
      .digest("base64");
    expect(headers["OK-ACCESS-SIGN"]).toBe(expectedSign);
  });

  it("throws OkxRestError on a non-zero envelope code", async () => {
    const client = new OkxRestClient(
      CONFIG,
      fakeFetch({ code: "50111", msg: "Invalid OK-ACCESS-KEY" }),
      () => FIXED_NOW,
    );
    await expect(client.get("/api/v6/anything")).rejects.toBeInstanceOf(OkxRestError);
  });

  it("throws OkxRestError on HTTP failure", async () => {
    const client = new OkxRestClient(CONFIG, fakeFetch({}, 401), () => FIXED_NOW);
    await expect(client.get("/api/v6/anything")).rejects.toBeInstanceOf(OkxRestError);
  });

  it("fromEnv returns null when credentials are incomplete", () => {
    expect(OkxRestClient.fromEnv({ OKX_API_KEY: "k", OKX_SECRET_KEY: "s" })).toBeNull();
    expect(
      OkxRestClient.fromEnv({ OKX_API_KEY: "k", OKX_SECRET_KEY: "s", OKX_PASSPHRASE: "p" }),
    ).not.toBeNull();
  });
});
