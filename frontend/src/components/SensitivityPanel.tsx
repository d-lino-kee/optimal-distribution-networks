import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Sensitivity } from "../types";
import Badge from "./Badge";
import Card from "./Card";

interface Props {
  sensitivity: Sensitivity;
}

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function SensitivityPanel({ sensitivity }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="DC marginal costs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 uppercase text-xs">
                <th className="py-2 pr-4">DC</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Cost to flip</th>
                <th className="py-2 pr-4">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sensitivity.dc_marginal_costs.map((m) => {
                const flip = m.recommendation === "consider flipping";
                return (
                  <tr key={m.dc_id}>
                    <td className="py-2 pr-4 font-mono">{m.dc_id}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={m.currently_open ? "green" : "gray"}>
                        {m.currently_open ? "open" : "closed"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {Number.isFinite(m.cost_to_flip) ? money(m.cost_to_flip) : "∞"}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge tone={flip ? "amber" : "green"}>
                        {flip ? "consider flipping" : "keep"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Demand elasticity (cost increase per +1%)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sensitivity.demand_elasticity.map((e) => ({
                retailer: e.retailer_id,
                cost: e.cost_increase_per_pct_demand,
              }))}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="retailer" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Bar dataKey="cost" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
