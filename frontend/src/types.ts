export interface Plant {
  id: string;
  capacity: number;
}

export interface DistributionCenter {
  id: string;
  city?: string;
  fixed_cost: number;
  capacity: number;
  min_utilization?: number;
}

export interface Retailer {
  id: string;
  demand: number;
}

export interface ShippingCosts {
  plant_to_dc: Record<string, Record<string, number>>;
  dc_to_retailer: Record<string, Record<string, number>>;
}

export interface Problem {
  plants: Plant[];
  distribution_centers: DistributionCenter[];
  retailers: Retailer[];
  shipping_costs: ShippingCosts;
}

export interface FlowEntry {
  from: string;
  to: string;
  units: number;
  mode: string;
  cost: number;
}

export interface CostBreakdown {
  dc_operating: number;
  plant_to_dc_shipping: number;
  dc_to_retailer_shipping: number;
  total: number;
}

export interface DCMarginal {
  dc_id: string;
  currently_open: boolean;
  cost_to_flip: number;
  recommendation: string;
}

export interface DemandElasticity {
  retailer_id: string;
  cost_increase_per_pct_demand: number;
}

export interface Sensitivity {
  dc_marginal_costs: DCMarginal[];
  demand_elasticity: DemandElasticity[];
}

export interface SolverResult {
  status: string;
  total_cost: number;
  open_dcs: string[];
  flows: FlowEntry[];
  cost_breakdown: CostBreakdown;
  sensitivity?: Sensitivity;
  problem?: Problem;
}

export interface ScenarioSummary {
  scenario_id: string;
  name: string;
  total_cost: number;
  open_dc_count: number;
}

export interface ScenarioListResponse {
  scenarios: ScenarioSummary[];
  count: number;
}

export interface CreateScenarioResponse {
  scenario_id: string;
  name: string;
  result: SolverResult;
}

export interface WhatIfResponse {
  baseline_cost: number;
  whatif_cost: number;
  cost_delta: number;
  cost_delta_pct: number;
  result: SolverResult;
}
