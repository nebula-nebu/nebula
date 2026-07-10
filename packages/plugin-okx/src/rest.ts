import { createHmac } from "node:crypto";

export interface OkxRestConfig {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  /** Project ID from the OKX Developer Portal — sent as OK-ACCESS-PROJECT. */
  projectId?: string;
  baseUrl?: string;
}

export class OkxRestError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "OkxRestError";
  }
}

interface OkxEnvelope<T> {
  code: string;
  msg?: string;
  data: T;
}

/**
 * Signed client for the OKX Open API (web3.okx.com).
 *
 * Signature: Base64(HMAC-SHA256(timestamp + METHOD + requestPath + body, secret)),
 * where requestPath includes the query string and body is the JSON payload
 * (empty string for GET), per the Onchain OS API access docs.
 */
export class OkxRestClient {
  private readonly config: Required<Pick<OkxRestConfig, "apiKey" | "secretKey" | "passphrase">> &
    OkxRestConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(
    config: OkxRestConfig,
    fetchImpl: typeof fetch = fetch,
    now: () => Date = () => new Date(),
  ) {
    this.config = { baseUrl: "https://web3.okx.com", ...config };
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): OkxRestClient | null {
    const { OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE, OKX_PROJECT_ID, OKX_API_BASE_URL } = env;
    if (!OKX_API_KEY || !OKX_SECRET_KEY || !OKX_PASSPHRASE) return null;
    return new OkxRestClient({
      apiKey: OKX_API_KEY,
      secretKey: OKX_SECRET_KEY,
      passphrase: OKX_PASSPHRASE,
      projectId: OKX_PROJECT_ID,
      baseUrl: OKX_API_BASE_URL,
    });
  }

  async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const search = query ? `?${new URLSearchParams(query).toString()}` : "";
    return this.request<T>("GET", `${path}${search}`, "");
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, JSON.stringify(body));
  }

  private headers(method: string, requestPath: string, body: string): Record<string, string> {
    const timestamp = this.now().toISOString();
    const signature = createHmac("sha256", this.config.secretKey)
      .update(`${timestamp}${method}${requestPath}${body}`)
      .digest("base64");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": this.config.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.config.passphrase,
    };
    if (this.config.projectId) headers["OK-ACCESS-PROJECT"] = this.config.projectId;
    return headers;
  }

  private async request<T>(method: "GET" | "POST", requestPath: string, body: string): Promise<T> {
    const response = await this.fetchImpl(`${this.config.baseUrl}${requestPath}`, {
      method,
      headers: this.headers(method, requestPath, body),
      body: body === "" ? undefined : body,
    });

    if (!response.ok) {
      throw new OkxRestError(`HTTP ${response.status}`, requestPath);
    }

    const envelope = (await response.json()) as OkxEnvelope<T>;
    if (envelope.code !== "0") {
      throw new OkxRestError(
        envelope.msg ?? `OKX error ${envelope.code}`,
        requestPath,
        envelope.code,
      );
    }
    return envelope.data;
  }
}
