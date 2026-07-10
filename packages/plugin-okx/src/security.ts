import type { Capability, SecurityProvider, TokenRiskReport } from "@nebula/core";
import { OnchainosClient } from "./client.js";

type RawScanEntry = {
  tokenAddress: string;
  chainId: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
} & Record<string, unknown>;

/** Token security scans backed by OKX risk detection. */
export class OkxSecurityProvider implements SecurityProvider {
  readonly name = "okx-security";
  readonly capabilities: readonly Capability[] = ["security.token-scan"];

  constructor(private readonly client = new OnchainosClient()) {}

  async scanTokens(tokens: { chainId: string; address: string }[]): Promise<TokenRiskReport[]> {
    if (tokens.length === 0) return [];

    const spec = tokens.map((t) => `${t.chainId}:${t.address}`).join(",");
    const data = await this.client.run<RawScanEntry[]>([
      "security",
      "token-scan",
      "--tokens",
      spec,
    ]);

    return (data ?? []).map((entry) => ({
      tokenAddress: entry.tokenAddress,
      chainId: entry.chainId,
      riskLevel: entry.riskLevel,
      flags: Object.entries(entry)
        .filter(([key, value]) => key.startsWith("is") && value === true)
        .map(([key]) => key),
    }));
  }
}
