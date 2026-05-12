import { useEffect, useState } from "react";
import { api } from "../api";
import type { Retailer, WhatIfResponse } from "../types";

interface Props {
  scenarioId: string;
}

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function WhatIfPanel({ scenarioId }: Props) {
  const [retailers, setRetailers] = useState<Retailer[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhatIfResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getScenario(scenarioId)
      .then((r) => {
        if (cancelled) return;
        setRetailers(r.result.problem?.retailers ?? []);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [scenarioId]);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const parsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(overrides)) {
        const trimmed = v.trim();
        if (trimmed === "") continue;
        const n = Number(trimmed);
        if (Number.isFinite(n)) parsed[k] = n;
      }
      const r = await api.whatIf(scenarioId, parsed);
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (!retailers && !error) {
    return <div className="text-sm text-slate-500">Loading retailers…</div>;
  }

  return (
    <div className="bg-slate-50 rounded border border-slate-200 p-4 space-y-3">
      <div className="text-sm text-slate-600">
        Override retailer demands (leave blank to keep baseline).
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(retailers ?? []).map((r) => (
          <label key={r.id} className="block">
            <span className="text-xs text-slate-500 font-mono">{r.id}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-14">
                base {r.demand}
              </span>
              <input
                type="number"
                step="any"
                placeholder={`${r.demand}`}
                value={overrides[r.id] ?? ""}
                onChange={(e) =>
                  setOverrides({ ...overrides, [r.id]: e.target.value })
                }
                className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm tabular-nums"
              />
            </div>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded"
        >
          {running ? "Running…" : "Run what-if"}
        </button>
        {error && <span className="text-sm text-rose-700">{error}</span>}
      </div>

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
          <Stat label="Baseline" value={money(result.baseline_cost)} />
          <Stat label="What-if"  value={money(result.whatif_cost)} />
          <Stat
            label="Delta"
            value={`${result.cost_delta >= 0 ? "+" : ""}${money(result.cost_delta)} (${result.cost_delta_pct.toFixed(2)}%)`}
            tone={result.cost_delta > 0 ? "red" : "green"}
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "red" | "green";
}) {
  const toneClass =
    tone === "red"   ? "text-rose-700"
    : tone === "green" ? "text-emerald-700"
                       : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded p-3">
      <div className="text-xs uppercase font-semibold text-slate-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
