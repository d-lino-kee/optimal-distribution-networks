import { useState, type ChangeEvent } from "react";
import { api } from "../api";
import { sampleProblem } from "../sampleProblem";
import type { Problem, SolverResult } from "../types";
import Card from "../components/Card";
import ResultView from "../components/ResultView";
import { useResult } from "../state/ResultContext";

export default function Optimize() {
  const { setResult } = useResult();
  const [text, setText] = useState<string>(() => JSON.stringify(sampleProblem, null, 2));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<SolverResult | null>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    setLocal(null);
    try {
      const problem = JSON.parse(text) as Problem;
      const result = await api.optimize(problem, true);
      setLocal(result);
      setResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Problem input">
        <div className="flex items-center gap-3 mb-3">
          <input
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="text-sm"
          />
          <button
            onClick={() => setText(JSON.stringify(sampleProblem, null, 2))}
            className="text-xs text-brand-600 underline"
          >
            Load sample
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={run}
            disabled={running}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded"
          >
            {running ? "Solving…" : "Run optimization"}
          </button>
          {error && <span className="text-sm text-rose-700">{error}</span>}
        </div>
      </Card>

      {local && <ResultView result={local} />}
    </div>
  );
}
