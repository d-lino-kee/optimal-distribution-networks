import type { SolverResult } from "../types";
import Card from "./Card";
import CostBreakdownChart from "./CostBreakdownChart";
import DCStatusGrid from "./DCStatusGrid";
import FlowTable from "./FlowTable";
import SensitivityPanel from "./SensitivityPanel";
import SummaryCards from "./SummaryCards";

interface Props {
  result: SolverResult;
}

export default function ResultView({ result }: Props) {
  return (
    <div className="space-y-6">
      <SummaryCards result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Cost breakdown">
          <CostBreakdownChart breakdown={result.cost_breakdown} />
        </Card>
        <Card title="DC status">
          <DCStatusGrid result={result} />
        </Card>
      </div>

      <Card title="Flows">
        <FlowTable flows={result.flows} />
      </Card>

      {result.sensitivity && (
        <SensitivityPanel sensitivity={result.sensitivity} />
      )}
    </div>
  );
}
