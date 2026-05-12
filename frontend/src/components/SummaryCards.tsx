import type { SolverResult } from "../types";

interface Props {
  result: SolverResult;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function SummaryCards({ result }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Stat label="Total cost"   value={fmt(result.total_cost)} accent="text-brand-600" />
      <Stat label="Open DCs"     value={result.open_dcs.length.toString()} accent="text-emerald-600" />
      <Stat label="Flows"        value={result.flows.length.toString()} accent="text-slate-800" />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}
