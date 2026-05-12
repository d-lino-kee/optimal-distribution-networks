import type { SolverResult } from "../types";
import Badge from "./Badge";

interface Props {
  result: SolverResult;
}

export default function DCStatusGrid({ result }: Props) {
  const dcs = result.problem?.distribution_centers ?? [];
  if (dcs.length === 0) {
    // Fallback: show only the open ones
    return (
      <div className="flex flex-wrap gap-2">
        {result.open_dcs.map((id) => (
          <span key={id} className="font-mono text-sm flex items-center gap-2">
            <Badge tone="green">OPEN</Badge> {id}
          </span>
        ))}
      </div>
    );
  }

  const openSet = new Set(result.open_dcs);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
      {dcs.map((dc) => {
        const open = openSet.has(dc.id);
        return (
          <div
            key={dc.id}
            className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 bg-white"
          >
            <div>
              <div className="font-mono text-sm text-slate-800">{dc.id}</div>
              {dc.city && <div className="text-xs text-slate-500">{dc.city}</div>}
            </div>
            <Badge tone={open ? "green" : "gray"}>{open ? "OPEN" : "CLOSED"}</Badge>
          </div>
        );
      })}
    </div>
  );
}
