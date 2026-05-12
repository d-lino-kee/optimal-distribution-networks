# Optimal Distribution Networks

A polyglot supply-chain optimizer with four layers, plus a React dashboard.

```
            +----------------+     POST /api/v1/optimize     +-----------------+
  Frontend  |  React + Vite  | ---------------------------> |   Go REST API   |
  (3000)    |   + Tailwind   | <-- SolverResult + sensitivity --|  (Gin, 8080) |
            +----------------+                              +--------+--------+
                                                                     |
                                                  stdin/stdout JSON  |
                                                                     v
                                                          +---------------------+
                                                          |  Rust MIP solver    |
                                                          |  (good_lp + HiGHS)  |
                                                          +---------------------+

  Scala Kafka Streams  ----publishes DemandEvent---->  Go API consumer
  (demand thresholding)                                (re-solves on signal)

  Ruby reporting CLI  ----HTTP--->  Go API   (CSV + PDF artifacts under output/)
```

## Layers

| Layer            | Path             | Purpose                                            |
|------------------|------------------|----------------------------------------------------|
| Rust solver      | `rust-solver/`   | Reads a `Problem` on stdin, prints `SolverResult`. |
| Go REST API      | `go-api/`        | HTTP front for the solver + scenario store.        |
| Scala Kafka      | `scala-kafka/`   | Demand-signal stream → `demand-updates` topic.     |
| Ruby reporting   | `ruby-reporting/`| CLI: CSV + PDF reports and what-if DSL.            |
| React frontend   | `frontend/`      | Vite + TS + Tailwind + Recharts dashboard.         |

## Run locally

```bash
# 1. Build the Rust solver
cd rust-solver && cargo build --release

# 2. Run the Go API (points at the compiled solver)
cd ../go-api
SOLVER_BINARY=../rust-solver/target/release/solver go run ./cmd/server

# 3. Run the frontend in dev mode
cd ../frontend && npm install && npm run dev
# open http://localhost:5173

# 4. Reporting (after API is up)
cd ../ruby-reporting && bundle install && bundle exec ruby run_reports.rb
```

## Run with Docker Compose

```bash
docker compose up --build
# Frontend: http://localhost:3000
# API:      http://localhost:8080/api/v1/health
```

## API routes

| Method | Path                                  | Notes                                |
|--------|---------------------------------------|--------------------------------------|
| GET    | `/api/v1/health`                      | `{"status":"ok"}`                    |
| POST   | `/api/v1/optimize`                    | Body: `Problem` JSON                 |
| POST   | `/api/v1/optimize/sensitivity`        | Same, returns sensitivity block.     |
| POST   | `/api/v1/scenarios`                   | Body: `{name, problem}`              |
| GET    | `/api/v1/scenarios`                   | List saved scenarios.                |
| GET    | `/api/v1/scenarios/:id`               | Fetch one scenario.                  |
| POST   | `/api/v1/scenarios/:id/whatif`        | Body: `{demand_overrides: {…}}`      |

CORS is open to `http://localhost:3000` and `http://localhost:5173` by default;
override with `ALLOWED_ORIGINS=https://yourhost`.
