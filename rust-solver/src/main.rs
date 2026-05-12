use anyhow::{Context, Result};
use clap::Parser;
use good_lp::{
    constraint, default_solver, variable, Expression, ProblemVariables, Solution as LpSolution,
    SolverModel, Variable,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Parser)]
#[command(name = "distribution-solver")]
struct Cli {
    #[arg(short, long)]
    input: Option<String>,

    #[arg(short, long)]
    output: Option<String>,

    #[arg(long, default_value_t = false)]
    sensitivity: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Problem {
    pub plants: Vec<Plant>,
    pub distribution_centers: Vec<DistributionCenter>,
    pub retailers: Vec<Retailer>,
    pub shipping_costs: ShippingCosts,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Plant {
    pub id: String,
    pub capacity: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DistributionCenter {
    pub id: String,
    #[serde(default)]
    pub city: String,
    pub fixed_cost: f64,
    pub capacity: f64,
    #[serde(default)]
    pub min_utilization: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Retailer {
    pub id: String,
    pub demand: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ShippingCosts {
    pub plant_to_dc: HashMap<String, HashMap<String, f64>>,
    pub dc_to_retailer: HashMap<String, HashMap<String, f64>>,
}

#[derive(Debug, Serialize)]
pub struct SolverResult {
    pub status: String,
    pub total_cost: f64,
    pub open_dcs: Vec<String>,
    pub flows: Vec<FlowEntry>,
    pub cost_breakdown: CostBreakdown,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sensitivity: Option<Sensitivity>,
}

#[derive(Debug, Serialize)]
pub struct FlowEntry {
    pub from: String,
    pub to: String,
    pub units: f64,
    pub mode: String,
    pub cost: f64,
}

#[derive(Debug, Serialize, Default)]
pub struct CostBreakdown {
    pub dc_operating: f64,
    pub plant_to_dc_shipping: f64,
    pub dc_to_retailer_shipping: f64,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct Sensitivity {
    pub dc_marginal_costs: Vec<DCMarginal>,
    pub demand_elasticity: Vec<DemandElasticity>,
}

#[derive(Debug, Serialize)]
pub struct DCMarginal {
    pub dc_id: String,
    pub currently_open: bool,
    pub cost_to_flip: f64,
    pub recommendation: String,
}

#[derive(Debug, Serialize)]
pub struct DemandElasticity {
    pub retailer_id: String,
    pub cost_increase_per_pct_demand: f64,
}

fn cost_pd(problem: &Problem, plant_id: &str, dc_id: &str) -> f64 {
    problem
        .shipping_costs
        .plant_to_dc
        .get(plant_id)
        .and_then(|m| m.get(dc_id))
        .copied()
        .unwrap_or(0.0)
}

fn cost_dr(problem: &Problem, dc_id: &str, retailer_id: &str) -> f64 {
    problem
        .shipping_costs
        .dc_to_retailer
        .get(dc_id)
        .and_then(|m| m.get(retailer_id))
        .copied()
        .unwrap_or(0.0)
}

// Pick a mode based on cost — large shipments at low per-unit cost are likely rail.
fn classify_mode(cost_per_unit: f64) -> &'static str {
    if cost_per_unit > 0.0 && cost_per_unit < 0.5 {
        "RAIL"
    } else {
        "TRUCK"
    }
}

pub fn solve_core(problem: &Problem) -> Result<SolverResult> {
    let n_plants = problem.plants.len();
    let n_dcs = problem.distribution_centers.len();
    let n_retailers = problem.retailers.len();

    let mut vars = ProblemVariables::new();

    // y[j] = 1 if DC j is open
    let y: Vec<Variable> = (0..n_dcs).map(|_| vars.add(variable().binary())).collect();

    // x_pd[i][j] = flow from plant i to DC j (continuous, >= 0)
    let x_pd: Vec<Vec<Variable>> = (0..n_plants)
        .map(|_| {
            (0..n_dcs)
                .map(|_| vars.add(variable().min(0.0)))
                .collect()
        })
        .collect();

    // x_dr[j][k] = flow from DC j to retailer k
    let x_dr: Vec<Vec<Variable>> = (0..n_dcs)
        .map(|_| {
            (0..n_retailers)
                .map(|_| vars.add(variable().min(0.0)))
                .collect()
        })
        .collect();

    // Objective: fixed DC costs + plant->dc shipping + dc->retailer shipping
    let mut obj = Expression::from(0);
    for (j, dc) in problem.distribution_centers.iter().enumerate() {
        obj += dc.fixed_cost * y[j];
    }
    for (i, plant) in problem.plants.iter().enumerate() {
        for (j, dc) in problem.distribution_centers.iter().enumerate() {
            let c = cost_pd(problem, &plant.id, &dc.id);
            if c != 0.0 {
                obj += c * x_pd[i][j];
            }
        }
    }
    for (j, dc) in problem.distribution_centers.iter().enumerate() {
        for (k, ret) in problem.retailers.iter().enumerate() {
            let c = cost_dr(problem, &dc.id, &ret.id);
            if c != 0.0 {
                obj += c * x_dr[j][k];
            }
        }
    }

    let mut model = vars.minimise(obj).using(default_solver);

    // C1: Plant capacity — total outflow <= plant.capacity
    for (i, plant) in problem.plants.iter().enumerate() {
        let outflow: Expression = x_pd[i].iter().sum();
        model = model.with(constraint!(outflow <= plant.capacity));
    }

    // C2: DC throughput — inflow <= capacity * y[j]
    for (j, dc) in problem.distribution_centers.iter().enumerate() {
        let inflow: Expression = (0..n_plants).map(|i| x_pd[i][j]).sum();
        model = model.with(constraint!(inflow <= dc.capacity * y[j]));
    }

    // C3: Flow conservation at DC — inflow == outflow
    for j in 0..n_dcs {
        let inflow: Expression = (0..n_plants).map(|i| x_pd[i][j]).sum();
        let outflow: Expression = (0..n_retailers).map(|k| x_dr[j][k]).sum();
        model = model.with(constraint!(inflow - outflow == 0));
    }

    // C4: Retailer demand — supply == demand
    for (k, retailer) in problem.retailers.iter().enumerate() {
        let supply: Expression = (0..n_dcs).map(|j| x_dr[j][k]).sum();
        model = model.with(constraint!(supply == retailer.demand));
    }

    let solution = model.solve().context("Solver failed")?;

    let mut open_dcs = Vec::new();
    for (j, dc) in problem.distribution_centers.iter().enumerate() {
        if solution.value(y[j]) > 0.5 {
            open_dcs.push(dc.id.clone());
        }
    }

    let mut flows = Vec::new();
    let mut plant_to_dc_total = 0.0;
    let mut dc_to_retailer_total = 0.0;

    for (i, plant) in problem.plants.iter().enumerate() {
        for (j, dc) in problem.distribution_centers.iter().enumerate() {
            let units = solution.value(x_pd[i][j]);
            if units > 1e-6 {
                let cpu = cost_pd(problem, &plant.id, &dc.id);
                let cost = cpu * units;
                plant_to_dc_total += cost;
                flows.push(FlowEntry {
                    from: plant.id.clone(),
                    to: dc.id.clone(),
                    units,
                    mode: classify_mode(cpu).to_string(),
                    cost,
                });
            }
        }
    }

    for (j, dc) in problem.distribution_centers.iter().enumerate() {
        for (k, ret) in problem.retailers.iter().enumerate() {
            let units = solution.value(x_dr[j][k]);
            if units > 1e-6 {
                let cpu = cost_dr(problem, &dc.id, &ret.id);
                let cost = cpu * units;
                dc_to_retailer_total += cost;
                flows.push(FlowEntry {
                    from: dc.id.clone(),
                    to: ret.id.clone(),
                    units,
                    mode: classify_mode(cpu).to_string(),
                    cost,
                });
            }
        }
    }

    let dc_operating: f64 = problem
        .distribution_centers
        .iter()
        .enumerate()
        .filter(|(j, _)| solution.value(y[*j]) > 0.5)
        .map(|(_, dc)| dc.fixed_cost)
        .sum();

    let total = dc_operating + plant_to_dc_total + dc_to_retailer_total;

    Ok(SolverResult {
        status: "optimal".to_string(),
        total_cost: total,
        open_dcs,
        flows,
        cost_breakdown: CostBreakdown {
            dc_operating,
            plant_to_dc_shipping: plant_to_dc_total,
            dc_to_retailer_shipping: dc_to_retailer_total,
            total,
        },
        sensitivity: None,
    })
}

// Sensitivity analysis: re-solve with forced flips of each DC and with each
// retailer's demand bumped by 1% to estimate marginal effects.
pub fn run_sensitivity(problem: &Problem, baseline: &SolverResult) -> Sensitivity {
    let mut dc_marginal_costs = Vec::new();
    for dc in &problem.distribution_centers {
        let currently_open = baseline.open_dcs.iter().any(|id| id == &dc.id);
        let mut perturbed = problem.clone();
        if currently_open {
            // Force closed by zeroing capacity
            for d in perturbed.distribution_centers.iter_mut() {
                if d.id == dc.id {
                    d.capacity = 0.0;
                    d.fixed_cost = 0.0;
                }
            }
        } else {
            // Already closed — solve as-is to estimate "if we forced it open"
            // we don't have an "open" indicator other than y, so just skip flip cost
        }
        let flipped = solve_core(&perturbed).ok();
        let cost_to_flip = match flipped {
            Some(s) => s.total_cost - baseline.total_cost,
            None => f64::INFINITY,
        };
        let recommendation = if cost_to_flip.is_finite() && cost_to_flip < 0.0 {
            "consider flipping".to_string()
        } else {
            "keep".to_string()
        };
        dc_marginal_costs.push(DCMarginal {
            dc_id: dc.id.clone(),
            currently_open,
            cost_to_flip,
            recommendation,
        });
    }

    let mut demand_elasticity = Vec::new();
    for retailer in &problem.retailers {
        let mut perturbed = problem.clone();
        for r in perturbed.retailers.iter_mut() {
            if r.id == retailer.id {
                r.demand *= 1.01;
            }
        }
        if let Ok(bumped) = solve_core(&perturbed) {
            demand_elasticity.push(DemandElasticity {
                retailer_id: retailer.id.clone(),
                cost_increase_per_pct_demand: bumped.total_cost - baseline.total_cost,
            });
        }
    }

    Sensitivity {
        dc_marginal_costs,
        demand_elasticity,
    }
}

pub fn solve(problem: &Problem, sensitivity: bool) -> Result<SolverResult> {
    let mut result = solve_core(problem)?;
    if sensitivity {
        result.sensitivity = Some(run_sensitivity(problem, &result));
    }
    Ok(result)
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    let input_str = match &cli.input {
        Some(path) => std::fs::read_to_string(path)
            .with_context(|| format!("Could not read: {path}"))?,
        None => {
            use std::io::Read;
            let mut s = String::new();
            std::io::stdin().read_to_string(&mut s)?;
            s
        }
    };

    let problem: Problem =
        serde_json::from_str(&input_str).context("Failed to parse input JSON")?;

    eprintln!(
        "Solving: {} plants, {} DC candidates, {} retailers",
        problem.plants.len(),
        problem.distribution_centers.len(),
        problem.retailers.len()
    );

    let result = solve(&problem, cli.sensitivity)?;
    let output = serde_json::to_string_pretty(&result)?;

    match &cli.output {
        Some(path) => std::fs::write(path, &output)?,
        None => println!("{output}"),
    }

    Ok(())
}
