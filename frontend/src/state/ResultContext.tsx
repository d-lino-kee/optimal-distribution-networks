import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { SolverResult } from "../types";

interface ResultContextValue {
  result: SolverResult | null;
  setResult: (r: SolverResult | null) => void;
}

const ResultContext = createContext<ResultContextValue | undefined>(undefined);

export function ResultProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<SolverResult | null>(null);
  return (
    <ResultContext.Provider value={{ result, setResult }}>
      {children}
    </ResultContext.Provider>
  );
}

export function useResult(): ResultContextValue {
  const ctx = useContext(ResultContext);
  if (!ctx) throw new Error("useResult must be used inside <ResultProvider>");
  return ctx;
}
