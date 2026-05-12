import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { sampleProblem } from "../sampleProblem";
import ResultView from "../components/ResultView";
import Card from "../components/Card";
import { useResult } from "../state/ResultContext";

export default function Dashboard() {
  const { result, setResult } = useResult();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (result) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .optimize(sampleProblem, true)
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [result, setResult]);

  if (loading) {
    return (
      <Card>
        <div className="text-slate-500">Solving baseline problem…</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-rose-700">
          <div className="font-semibold">Could not reach the API</div>
          <div className="text-sm mt-1">{error}</div>
          <div className="text-sm mt-3 text-slate-600">
            Make sure the Go API is running on{" "}
            <code className="bg-slate-100 px-1 rounded">http://localhost:8080</code>{" "}
            or set <code className="bg-slate-100 px-1 rounded">VITE_API_URL</code>.
          </div>
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <div className="text-slate-700">
          No result yet —{" "}
          <Link to="/optimize" className="text-brand-600 underline">
            run an optimization
          </Link>
          .
        </div>
      </Card>
    );
  }

  return <ResultView result={result} />;
}
