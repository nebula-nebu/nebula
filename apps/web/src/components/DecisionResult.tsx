import type { Decision } from "../lib/api.js";

const RECOMMENDATION_STYLES: Record<
  Decision["recommendation"],
  { label: string; className: string }
> = {
  proceed: { label: "Proceed", className: "border-ok/40 bg-ok/10 text-ok" },
  proceed_with_caution: {
    label: "Proceed with caution",
    className: "border-warn/40 bg-warn/10 text-warn",
  },
  dont_proceed: { label: "Don't proceed", className: "border-stop/40 bg-stop/10 text-stop" },
};

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-ink-dim">
      {children}
    </h3>
  );
}

export function DecisionResult({ decision }: { decision: Decision }) {
  const rec = RECOMMENDATION_STYLES[decision.recommendation];

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${rec.className}`}>
          {rec.label}
        </span>
        <span className="text-sm text-ink-dim">
          Risk <span className="capitalize text-ink">{decision.risk}</span>
        </span>
        <span className="text-sm text-ink-dim">
          Confidence <span className="capitalize text-ink">{decision.confidence.level}</span>
        </span>
        {decision.estimated_apy !== undefined && (
          <span className="ml-auto bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-xl font-bold text-transparent">
            ~{(decision.estimated_apy * 100).toFixed(2)}%
          </span>
        )}
      </div>

      <p className="mt-5 text-base leading-relaxed">{decision.decision_summary}</p>

      <SectionTitle>Your money will</SectionTitle>
      <ul className="mt-2 space-y-1.5">
        {decision.human_summary.map((line) => (
          <li
            key={line}
            className={`text-sm leading-relaxed ${line.startsWith("✗") ? "text-warn" : "text-ink"}`}
          >
            {line}
          </li>
        ))}
      </ul>

      <SectionTitle>Your rules, applied</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">
        {decision.derived_policies.map((policy) => (
          <span
            key={policy.policy}
            title={policy.note ?? policy.from}
            className={`rounded-full border px-3 py-1 text-xs ${
              policy.status === "binding"
                ? "border-warn/50 bg-warn/10 text-warn"
                : "border-ok/40 bg-ok/10 text-ok"
            }`}
          >
            {policy.policy.replaceAll("_", " ")}
            {policy.status === "binding" && " · shaped this decision"}
          </span>
        ))}
      </div>

      <SectionTitle>Why</SectionTitle>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        {decision.why.map((reason) => (
          <li key={reason} className="text-sm leading-relaxed text-ink-dim">
            {reason}
          </li>
        ))}
      </ul>

      {decision.execution_plan.length > 0 && (
        <>
          <SectionTitle>Execution plan — ready for your agent</SectionTitle>
          <ol className="mt-2 space-y-2">
            {decision.execution_plan.map((step) => (
              <li
                key={step.step}
                className="flex items-center gap-3 rounded-lg border border-line bg-void/50 px-3 py-2 font-mono text-xs"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/20 font-sans font-semibold text-brand">
                  {step.step}
                </span>
                <span className="text-ink">
                  {step.action} {step.amount} {step.token} → {step.protocol}
                  <span className="text-ink-dim"> · {step.chain}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <SectionTitle>Confidence, measured</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["completeness", decision.confidence.data_completeness],
            ["freshness", decision.confidence.data_freshness],
            ["policy clarity", decision.confidence.policy_clarity],
            ["readiness", decision.confidence.execution_readiness],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
                style={{ width: `${value * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] capitalize text-ink-dim">{label}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-right font-mono text-[11px] text-ink-dim/60">
        {decision.decision_id}
        {decision.revalidate_after && ` · revalidate in ${decision.revalidate_after}`}
      </p>
    </section>
  );
}
