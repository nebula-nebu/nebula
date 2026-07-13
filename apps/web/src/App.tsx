import { useState } from "react";
import { DecisionForm } from "./components/DecisionForm.js";
import { DecisionResult } from "./components/DecisionResult.js";
import { requestDecision, type Decision, type DecisionRequest } from "./lib/api.js";

function OrbitMark() {
  return (
    <svg viewBox="0 0 100 100" className="h-9 w-9" aria-hidden>
      <rect width="100" height="100" rx="28" fill="#0f0f1a" />
      <ellipse
        cx="50"
        cy="50"
        rx="38"
        ry="22"
        fill="none"
        stroke="url(#g)"
        strokeWidth="7"
        transform="rotate(-32 50 50)"
      />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b7cff" />
          <stop offset="100%" stopColor="#38d3f5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function App() {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(request: DecisionRequest) {
    setBusy(true);
    setError(null);
    try {
      setDecision(await requestDecision(request));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center gap-3">
        <OrbitMark />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nebula</h1>
          <p className="text-sm text-ink-dim">Your AI Financial Decision Engine</p>
        </div>
      </header>

      <p className="mt-10 max-w-2xl text-2xl font-light leading-snug text-ink-dim">
        Today's AI can execute transactions.{" "}
        <span className="font-medium text-ink">
          Nebula decides whether they should happen at all.
        </span>
      </p>

      <main className="mt-10 grid gap-6 lg:grid-cols-2">
        <DecisionForm busy={busy} onSubmit={handleSubmit} />

        <div>
          {decision && <DecisionResult decision={decision} />}
          {!decision && !error && (
            <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-ink-dim">
              Nebula's decision will appear here — reasoned, rule-checked, ready to execute.
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-stop/40 bg-stop/10 p-6 text-sm text-stop">
              {error}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-xs text-ink-dim/60">
        Nebula never holds your funds. It decides; your agent executes. · ASP #4930 on OKX.AI
      </footer>
    </div>
  );
}
