import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { CostBreakdown } from "../types";

const COLORS = ["#2563eb", "#10b981", "#f59e0b"];

interface Props {
  breakdown: CostBreakdown;
}

export default function CostBreakdownChart({ breakdown }: Props) {
  const data = [
    { name: "DC operating",        value: breakdown.dc_operating },
    { name: "Plant -> DC",         value: breakdown.plant_to_dc_shipping },
    { name: "DC -> Retailer",      value: breakdown.dc_to_retailer_shipping },
  ];

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => v.toLocaleString(undefined, {
              style: "currency", currency: "USD", maximumFractionDigits: 0,
            })}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
