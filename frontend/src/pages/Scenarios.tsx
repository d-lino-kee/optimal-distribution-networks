import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { sampleProblem } from "../sampleProblem";
import type { Problem, ScenarioSummary } from "../types";
import Card from "../components/Card";
import WhatIfPanel from "../components/WhatIfPanel";

const fmt = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Scenarios() {
  const [name, setName] = useState("Baseline");
  const [problemText, setProblemText] = useState(JSON.stringify(sampleProblem, null, 2));
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listScenarios();
      setScenarios(list.scenarios ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const problem = JSON.parse(problemText) as Problem;
      await api.createScenario(name.trim() || "Untitled", problem);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Save a scenario">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={save}
              disabled={saving}
              className="mt-3 w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded"
            >
              {saving ? "Saving…" : "Save scenario"}
            </button>
            {error && <div className="mt-2 text-xs text-rose-700">{error}</div>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Problem JSON
            </label>
            <textarea
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded p-3"
            />
          </div>
        </div>
      </Card>

      <Card title="Saved scenarios">
        {loading && <div className="text-slate-500 text-sm">Loading…</div>}
        {!loading && scenarios.length === 0 && (
          <div className="text-slate-500 text-sm">No scenarios saved yet.</div>
        )}
        <ul className="divide-y divide-slate-100">
          {scenarios.map((s) => (
            <li key={s.scenario_id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{s.scenario_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm tabular-nums font-semibold text-slate-900">
                    {fmt(s.total_cost)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.open_dc_count} open DC{s.open_dc_count === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  className="text-sm text-brand-600 hover:text-brand-700 underline"
                  onClick={() =>
                    setOpenId((cur) => (cur === s.scenario_id ? null : s.scenario_id))
                  }
                >
                  {openId === s.scenario_id ? "Close" : "What-if"}
                </button>
              </div>

              {openId === s.scenario_id && (
                <div className="mt-4">
                  <WhatIfPanel scenarioId={s.scenario_id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
