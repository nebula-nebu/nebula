import { useState } from "react";
import type { DecisionRequest } from "../lib/api.js";

const PRESET_PREFERENCES = [
  "I don't want to lose money",
  "I want to withdraw anytime",
  "Only trusted investments",
  "Keep it simple",
];

interface AssetRow {
  token: string;
  amount: string;
  chain: string;
}

const DEFAULT_ASSETS: AssetRow[] = [
  { token: "ETH", amount: "2", chain: "ethereum" },
  { token: "USDT", amount: "800", chain: "ethereum" },
];

interface Props {
  busy: boolean;
  onSubmit: (request: DecisionRequest) => void;
}

export function DecisionForm({ busy, onSubmit }: Props) {
  const [goal, setGoal] = useState("I want to take my family to Japan in 4 months");
  const [selected, setSelected] = useState<string[]>(PRESET_PREFERENCES.slice(0, 2));
  const [customPreference, setCustomPreference] = useState("");
  const [mode, setMode] = useState<"assets" | "address">("assets");
  const [assets, setAssets] = useState<AssetRow[]>(DEFAULT_ASSETS);
  const [address, setAddress] = useState("");

  function togglePreference(preference: string) {
    setSelected((current) =>
      current.includes(preference)
        ? current.filter((p) => p !== preference)
        : [...current, preference],
    );
  }

  function updateAsset(index: number, patch: Partial<AssetRow>) {
    setAssets((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function submit() {
    const preferences = [...selected];
    if (customPreference.trim()) preferences.push(customPreference.trim());

    const portfolio =
      mode === "address"
        ? { address: address.trim() }
        : { assets: assets.filter((a) => a.token && a.amount) };

    onSubmit({ portfolio, goal, preferences });
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-void/60 px-3 py-2 text-sm text-ink placeholder:text-ink-dim/60 focus:border-brand focus:outline-none";

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Your goal</h2>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={2}
        className={`${inputClass} mt-3 resize-none text-base`}
        placeholder="Tell Nebula what you want to achieve…"
      />

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-widest text-ink-dim">
        Your rules
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESET_PREFERENCES.map((preference) => {
          const active = selected.includes(preference);
          return (
            <button
              key={preference}
              type="button"
              onClick={() => togglePreference(preference)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-brand bg-brand/15 text-ink"
                  : "border-line text-ink-dim hover:border-brand/50"
              }`}
            >
              {preference}
            </button>
          );
        })}
      </div>
      <input
        value={customPreference}
        onChange={(e) => setCustomPreference(e.target.value)}
        className={`${inputClass} mt-3`}
        placeholder="Add your own rule, in your own words…"
      />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">
          Your portfolio
        </h2>
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {(["assets", "address"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 capitalize transition ${
                mode === m ? "bg-brand/20 text-ink" : "text-ink-dim"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "assets" ? (
        <div className="mt-3 space-y-2">
          {assets.map((asset, index) => (
            <div key={index} className="grid grid-cols-3 gap-2">
              <input
                value={asset.token}
                onChange={(e) => updateAsset(index, { token: e.target.value })}
                className={inputClass}
                placeholder="Token"
              />
              <input
                value={asset.amount}
                onChange={(e) => updateAsset(index, { amount: e.target.value })}
                className={inputClass}
                placeholder="Amount"
              />
              <input
                value={asset.chain}
                onChange={(e) => updateAsset(index, { chain: e.target.value })}
                className={inputClass}
                placeholder="Chain"
              />
            </div>
          ))}
        </div>
      ) : (
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={`${inputClass} mt-3 font-mono`}
          placeholder="0x… — Nebula reads your holdings itself"
        />
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !goal.trim()}
        className="mt-8 w-full rounded-xl bg-gradient-to-r from-brand to-brand-2 py-3 text-sm font-semibold text-void transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Nebula is deliberating…" : "Ask Nebula to decide"}
      </button>
    </section>
  );
}
