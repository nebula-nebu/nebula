/**
 * OKX chainIndex → canonical chain name, as accepted by the Onchain OS CLI
 * and shown to users. Unknown indexes fall back to the raw value.
 */
const CHAIN_NAMES: Record<string, string> = {
  "1": "ethereum",
  "10": "optimism",
  "56": "bsc",
  "137": "polygon",
  "196": "xlayer",
  "501": "solana",
  "8453": "base",
  "9745": "plasma",
  "42161": "arbitrum",
  "43114": "avalanche",
  "59144": "linea",
  "534352": "scroll",
};

export function chainName(chainIndex: string): string {
  return CHAIN_NAMES[chainIndex] ?? chainIndex;
}
