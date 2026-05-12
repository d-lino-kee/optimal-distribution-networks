use anyhow::{Context, Result};
use clap::Parser;
use good_lp::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// CLI defintion - clap reads the struct fields and builds --help for free
#[derive(Parser)]
#[command(name = "distribution-solver")]
struct Cli {
    #[arg(short, long)]
    input: Option<String>, // Option<T> means "might be None"

    #[arg(short, long)]
    output: Option<String>,

    #[arg(long, default_value_t = false)]
    sensitivity: bool, 
}

// Input types - #[Derive(Deserialize)] means serde_verde can fill these from Json
#[derive(Debug, Deserialize, Clone)]
pub struct Problem {
    pub plants: Vec<Plant>,// Vec = growable array
    pub distribution_centers: Vec<DistributionCenter>,
    pub retailers: Vec<Retailer>,
    pub shipping_costs: ShippingCosts, 
}

#[derive(Debug, Deserialize, Clone)]
pub struct Plant {
    pub id: String,
    pub capacity: f64 // f64 = 64-bit float
}

#[derive(Debug, Deserialize, Clone)]
pub struct ShippingCosts {
    // Nested HashMap: plant_id -> dc_id -> cost per unit
    pub plant_to_dc: HashMap<String, HashMap<String, f64>>,
    pub dc_to_retailer: HashMap<String, HashMap<String, f64>>,
}

pub fn solve(problem: &Problem, run_sensitivity: bool) -> Result<Solution> {
    let mut vars = ProblemVariables::new();

    // y[j] = 1 if DC j is open(binary integer variable)
    let y: Vec<Variable> = (0..n_dcs)
    .map(|_| vars.add(variable().binary()))
    .collect();

    // x_pd[i][j] = flow from plant i to DC j (continuous, >= 0)
    let x_pd: Vec<Vec<Variable>> = (0..n_plants)
    .map(|_| {
        (0..n_dcs)
            .map(|_| vars.add(variable().min(0.0)))
            .collect()
    })
    .collect();


    // Build objective: sum of DC fixed costs + all shipping costs
    let mut obj = Expression::default();
    for (j, dc) in problem.distribution_centers.iter().enumerate() {
        obj += dc.fixed_cost * y[j]; // fixed_cost * binary = pay only if open
    }

    let mut model = vars.minimise(obj).using(default_solver);

    // Constraint C1: Plant Capacity - total outflow <= plant.capacity
    for (i, plant) in problem.plants.iter().enumerate() {
        let outflow: Expression = x_pd[i].iter().sum();
        model = model.with(constraint!(outflow <= plant.capacity));
    }

    // Constraint C2: DC throughput linked to open/close decision
    // If y[j]=0 (closed), right side = 0, so no flow allowed
    for (j, dc) in problem.distribution_centers.iter().enumerate() {
        let inflow: Expression = (0..n_plants).map(|i| x_pd[i][j]).sum();
        model = model.with(constraint!(inflow <= dc.capacity * y[j]));
    }

    // COnstraint C4: Every retailer's demand must be exactly met
    for (k, retailer) in problem.reatilers.iter().enumerate() {
        let supply: Expression = (0..n_dcs).map(|j| x_dr[j][k]).sum();
        model = model.with(constraint!(supply == retailer.demand));
    }

    // Solve - returns error if infeasible
    let solution - model.solve().context("Solver failed")?;
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Read input: either from a file path or from stdin
    let input_str = match &cli.input {
        Some(path) => std::fs::read_to_string(path)
            .with_context(|| format! ("Could not read: {path}"))?,
        None => {
            use std::io::Read;
            let mut s = String::new();
            std::io::stdin().read_to_string(&mut s)?' // ? = propagate error
            s
        }
    }
};

// Parse JSON into our Problem struct
// If the JSON is malformed, this returns an error with context
let problem: Problem = 
    