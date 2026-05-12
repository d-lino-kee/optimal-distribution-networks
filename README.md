# Optimal Distribution Networks

This is a planning tool for any company that ships goods from factories to retail stores through a network of warehouses. The question it answers is, which warehouses should we keep open, and how much should flow through each of them, so that we pay the lowest total cost while still meeting every store's demand.

Under the hood it is a mixed integer linear program. The integer part is a single yes or no for each candidate warehouse. The continuous part is the flow volume on every plant to warehouse lane and every warehouse to retailer lane. The solver minimises the sum of the fixed operating cost for any warehouse that is open plus the per unit shipping cost on every lane that actually carries volume.

## What the solver decides

It picks which of the candidate warehouses to open. A closed warehouse pays no fixed cost and carries no flow. An open one pays its fixed cost and can carry up to its capacity.

It picks the flow on every lane. Each plant has a total output it cannot exceed. Each retailer has a demand that must be met exactly. Whatever flows into a warehouse must flow back out, so nothing is created or destroyed inside the network.

## The constraints, in plain English

Plants can ship no more than their capacity in total. An 8000 unit plant cannot send out 8001.

A warehouse only carries flow if it is open. A closed one is forced to zero throughput.

Every retailer's demand is met exactly. Not more, not less.

Whatever arrives at a warehouse leaves it again. The warehouse does not store anything across the planning horizon.

## The layers

| Folder           | What it is |
|------------------|------------|
| `rust-solver`    | The actual solver. Reads a problem on stdin and writes a solution on stdout. Built with good_lp on top of HiGHS. |
| `go-api`         | A small Gin HTTP server that wraps the Rust binary as a subprocess. Also reads demand events off Kafka and runs the solver again when one arrives. |
| `scala-kafka`    | A Kafka Streams job that watches raw demand signals and emits a richer event whenever the shift crosses a threshold. |
| `ruby-reporting` | A command line tool. Calls the Go API, prints a coloured table to the terminal, and saves CSV and PDF reports. |
| `frontend`       | A single page React app with three views (Dashboard, Optimize, Scenarios) and a sensitivity panel. Built with Vite, TypeScript, Tailwind and Recharts. |

## What the API gives you

| Method | Path                                    | What it does |
|--------|------------------------------------------|--------------|
| GET    | `/api/v1/health`                         | Returns `{"status":"ok"}`. Useful for compose health checks. |
| POST   | `/api/v1/optimize`                       | Body is a problem. Returns the optimal plan with no sensitivity. |
| POST   | `/api/v1/optimize/sensitivity`           | Same, plus marginal cost per warehouse and demand elasticity per retailer. |
| POST   | `/api/v1/scenarios`                      | Save a named scenario. Body is `{ name, problem }`. Returns an id. |
| GET    | `/api/v1/scenarios`                      | List saved scenarios with their total cost. |
| GET    | `/api/v1/scenarios/:id`                  | Fetch one scenario, including the original problem. |
| POST   | `/api/v1/scenarios/:id/whatif`           | Body is `{ demand_overrides }`. Returns baseline cost, what if cost, and the delta. |

CORS is open to `http://localhost:3000` and `http://localhost:5173` by default. Override it with the `ALLOWED_ORIGINS` environment variable if you serve the frontend somewhere else.

## What you need on the host

You need each of these installed if you want to build that layer locally.

A Rust toolchain (cargo). The good_lp crate pulls in HiGHS, so cmake and a C++ compiler need to be on the box too.

Go 1.22 or newer for the API.

sbt and a JDK 21 for the Scala streams job.

Ruby 3 with bundler for the reporting CLI. Prawn produces the PDF reports and httparty does the HTTP calls.

Node 20 and npm for the frontend.

If you do not want to install all of these, Docker on its own is enough. The compose file builds every layer from source inside a container.

## Running it on your laptop, piece by piece

```bash
# 1. Build the Rust solver
cd rust-solver
cargo build --release

# 2. Run the Go API and point it at the binary you just built
cd ../go-api
SOLVER_BINARY=../rust-solver/target/release/solver go run ./cmd/server

# 3. Start the frontend in dev mode
cd ../frontend
npm install
npm run dev
# open http://localhost:5173
```

If you want to see the Ruby reporting in action, with the API still running:

```bash
cd ruby-reporting
bundle install
bundle exec ruby run_reports.rb
# look in ruby-reporting/output for the CSV and PDF
```

## Running the whole stack with Docker compose

```bash
docker compose up --build
```

Then visit `http://localhost:3000` for the dashboard, or `http://localhost:8080/api/v1/health` to confirm the API is up. The compose file also starts Kafka, Zookeeper, and the Scala consumer, so the full event flow is live and the API will rerun the solver whenever the Scala job emits a demand event.

## Some notes on the shape of the data

A problem JSON looks like this.

```json
{
  "plants": [{ "id": "plant_chicago", "capacity": 8000 }],
  "distribution_centers": [
    { "id": "dc_dallas", "city": "Dallas",
      "fixed_cost": 12000, "capacity": 5000, "min_utilization": 0 }
  ],
  "retailers": [{ "id": "ret_nyc", "demand": 2000 }],
  "shipping_costs": {
    "plant_to_dc":    { "plant_chicago": { "dc_dallas": 0.35 } },
    "dc_to_retailer": { "dc_dallas":     { "ret_nyc": 1.40 } }
  }
}
```

`shipping_costs` is a nested map. The outer key is the source id and the inner key is the destination id, and the value is the cost per unit on that lane. Anything missing is treated as a lane that does not exist, so the solver simply will not use it.

A solver result looks like this.

```json
{
  "status": "optimal",
  "total_cost": 16234.5,
  "open_dcs": ["dc_dallas", "dc_columbus"],
  "flows": [
    { "from": "plant_chicago", "to": "dc_columbus",
      "units": 3800, "mode": "RAIL", "cost": 684.0 }
  ],
  "cost_breakdown": {
    "dc_operating": 22000,
    "plant_to_dc_shipping": 4234.5,
    "dc_to_retailer_shipping": 5320.0,
    "total": 31554.5
  },
  "sensitivity": {
    "dc_marginal_costs":  [ ... ],
    "demand_elasticity":  [ ... ]
  }
}
```

A `mode` of `RAIL` means a per unit shipping cost low enough to look like bulk rail (roughly under 0.50). Anything more expensive is reported as `TRUCK`. That distinction is a label rather than a constraint, since the solver itself only sees a single per unit cost.

## A quick tour of the dashboard

The Dashboard view loads the bundled sample problem on first open and shows a total cost card, an open warehouse count, a donut for the cost split (warehouse operating versus plant to warehouse shipping versus warehouse to retailer shipping), the full flow table with RAIL and TRUCK badges, and a green or grey status badge for each warehouse.

The Optimize view lets you paste or upload a problem JSON, send it to the API, and see the result on the same page.

The Scenarios view lets you save a baseline and then run what if changes against it. For each saved scenario there is a What if button that opens an inline panel with one input per retailer. Leave a box empty to use the baseline demand. The result shows baseline cost, what if cost, and the percentage delta with a colour cue.

If the result contains sensitivity data, you also get a table of warehouse marginal costs with a keep or consider flipping recommendation, and a bar chart showing how much the total cost rises for each retailer per one percent of extra demand.
