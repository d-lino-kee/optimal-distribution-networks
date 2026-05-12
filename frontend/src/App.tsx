import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Optimize from "./pages/Optimize";
import Scenarios from "./pages/Scenarios";
import { ResultProvider } from "./state/ResultContext";

const navLink = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-2 rounded-md text-sm font-medium",
    isActive
      ? "bg-brand-600 text-white"
      : "text-slate-700 hover:bg-slate-200",
  ].join(" ");

export default function App() {
  return (
    <ResultProvider>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
            <div className="font-bold text-lg text-slate-900">
              Distribution Optimizer
            </div>
            <nav className="flex gap-2">
              <NavLink to="/dashboard"  className={navLink}>Dashboard</NavLink>
              <NavLink to="/optimize"   className={navLink}>Optimize</NavLink>
              <NavLink to="/scenarios"  className={navLink}>Scenarios</NavLink>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/optimize"   element={<Optimize />} />
            <Route path="/scenarios"  element={<Scenarios />} />
          </Routes>
        </main>
      </div>
    </ResultProvider>
  );
}
