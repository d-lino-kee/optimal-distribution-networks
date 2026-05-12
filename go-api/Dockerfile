# ---------- Stage 1: build the Rust solver ----------
FROM rust:1.79-bookworm AS rust-build
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake build-essential pkg-config && rm -rf /var/lib/apt/lists/*
COPY rust-solver/Cargo.toml /src/rust-solver/Cargo.toml
COPY rust-solver/src /src/rust-solver/src
WORKDIR /src/rust-solver
RUN cargo build --release

# ---------- Stage 2: build the Go API ----------
FROM golang:1.22-bookworm AS go-build
WORKDIR /src/go-api
COPY go-api/go.mod go-api/go.sum* ./
RUN go mod download || true
COPY go-api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

# ---------- Stage 3: runtime ----------
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=rust-build /src/rust-solver/target/release/solver /usr/local/bin/solver
COPY --from=go-build  /out/server /usr/local/bin/server
COPY rust-solver/sample_problem.json /opt/sample_problem.json
EXPOSE 8080
ENV SOLVER_BINARY=/usr/local/bin/solver
ENTRYPOINT ["/usr/local/bin/server"]
