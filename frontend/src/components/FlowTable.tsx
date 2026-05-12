import type { FlowEntry } from "../types";
import Badge from "./Badge";

interface Props {
  flows: FlowEntry[];
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function FlowTable({ flows }: Props) {
  if (flows.length === 0) {
    return <p className="text-sm text-slate-500">No flows.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 uppercase text-xs">
            <th className="py-2 pr-4">From</th>
            <th className="py-2 pr-4">To</th>
            <th className="py-2 pr-4">Mode</th>
            <th className="py-2 pr-4 text-right">Units</th>
            <th className="py-2 pr-4 text-right">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {flows.map((f, i) => (
            <tr key={i}>
              <td className="py-2 pr-4 font-mono text-slate-700">{f.from}</td>
              <td className="py-2 pr-4 font-mono text-slate-700">{f.to}</td>
              <td className="py-2 pr-4">
                <Badge tone={f.mode === "RAIL" ? "blue" : "amber"}>{f.mode}</Badge>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{f.units.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{fmt(f.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
