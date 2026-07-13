import type { Decision, DecisionRequest } from "@nebula/core";

export type { Decision, DecisionRequest };

interface DecideResponse {
  ok: boolean;
  data?: Decision;
  error?: unknown;
}

export async function requestDecision(request: DecisionRequest): Promise<Decision> {
  const response = await fetch("/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  const body = (await response.json()) as DecideResponse;
  if (!response.ok || !body.ok || !body.data) {
    throw new Error("Nebula could not produce a decision. Check that the API is running.");
  }
  return body.data;
}
