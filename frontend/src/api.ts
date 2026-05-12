import type {
  Problem,
  SolverResult,
  CreateScenarioResponse,
  ScenarioListResponse,
  WhatIfResponse,
} from "./types";

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  optimize: (problem: Problem, sensitivity = true) =>
    request<SolverResult>(
      sensitivity ? "/optimize/sensitivity" : "/optimize",
      { method: "POST", body: JSON.stringify(problem) },
    ),

  createScenario: (name: string, problem: Problem) =>
    request<CreateScenarioResponse>("/scenarios", {
      method: "POST",
      body: JSON.stringify({ name, problem }),
    }),

  listScenarios: () => request<ScenarioListResponse>("/scenarios"),

  getScenario: (id: string) =>
    request<{ scenario_id: string; name: string; result: SolverResult }>(
      `/scenarios/${id}`,
    ),

  whatIf: (id: string, demand_overrides: Record<string, number>) =>
    request<WhatIfResponse>(`/scenarios/${id}/whatif`, {
      method: "POST",
      body: JSON.stringify({ demand_overrides }),
    }),
};

export { API_URL };
