package solver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"

	"go.uber.org/zap"
)

// Domain types mirror the Rust solver schema so that the JSON wire format is
// the same on both sides.

type Problem struct {
	Plants              []Plant              `json:"plants"`
	DistributionCenters []DistributionCenter `json:"distribution_centers"`
	Retailers           []Retailer           `json:"retailers"`
	ShippingCosts       ShippingCosts        `json:"shipping_costs"`
}

type Plant struct {
	ID       string  `json:"id"`
	Capacity float64 `json:"capacity"`
}

type DistributionCenter struct {
	ID             string  `json:"id"`
	City           string  `json:"city"`
	FixedCost      float64 `json:"fixed_cost"`
	Capacity       float64 `json:"capacity"`
	MinUtilization float64 `json:"min_utilization"`
}

type Retailer struct {
	ID     string  `json:"id"`
	Demand float64 `json:"demand"`
}

// ShippingCosts uses the same nested-map shape the Rust solver consumes:
//   plant_id  -> dc_id       -> per-unit cost
//   dc_id     -> retailer_id -> per-unit cost
type ShippingCosts struct {
	PlantToDC    map[string]map[string]float64 `json:"plant_to_dc"`
	DCToRetailer map[string]map[string]float64 `json:"dc_to_retailer"`
}

type FlowEntry struct {
	From  string  `json:"from"`
	To    string  `json:"to"`
	Units float64 `json:"units"`
	Mode  string  `json:"mode"`
	Cost  float64 `json:"cost"`
}

type CostBreakdown struct {
	DCOperating          float64 `json:"dc_operating"`
	PlantToDCShipping    float64 `json:"plant_to_dc_shipping"`
	DCToRetailerShipping float64 `json:"dc_to_retailer_shipping"`
	Total                float64 `json:"total"`
}

type DCMarginal struct {
	DCID           string  `json:"dc_id"`
	CurrentlyOpen  bool    `json:"currently_open"`
	CostToFlip     float64 `json:"cost_to_flip"`
	Recommendation string  `json:"recommendation"`
}

type DemandElasticity struct {
	RetailerID               string  `json:"retailer_id"`
	CostIncreasePerPctDemand float64 `json:"cost_increase_per_pct_demand"`
}

type Sensitivity struct {
	DCMarginalCosts  []DCMarginal       `json:"dc_marginal_costs"`
	DemandElasticity []DemandElasticity `json:"demand_elasticity"`
}

// SolverResult is what the Rust solver writes to stdout. We tack the original
// Problem onto the Go-side copy so that what-if scenarios can re-solve against
// the same baseline without forcing the caller to resend the inputs.
type SolverResult struct {
	Status        string        `json:"status"`
	TotalCost     float64       `json:"total_cost"`
	OpenDCs       []string      `json:"open_dcs"`
	Flows         []FlowEntry   `json:"flows"`
	CostBreakdown CostBreakdown `json:"cost_breakdown"`
	Sensitivity   *Sensitivity  `json:"sensitivity,omitempty"`

	// Problem is the input that produced this result. Stored server-side for
	// what-if; serialized so callers can also reuse it.
	Problem Problem `json:"problem,omitempty"`
}

// RustClient invokes the compiled Rust solver as a subprocess. Problem JSON
// goes in via stdin and solution JSON comes back on stdout.
type RustClient struct {
	binaryPath string
	log        *zap.Logger
	timeout    time.Duration
}

func NewRustClient(binaryPath string, log *zap.Logger) *RustClient {
	return &RustClient{
		binaryPath: binaryPath,
		log:        log,
		timeout:    5 * time.Minute,
	}
}

func (c *RustClient) Solve(ctx context.Context, prob Problem, sensitivity bool) (*SolverResult, error) {
	input, err := json.Marshal(prob)
	if err != nil {
		return nil, fmt.Errorf("marshal problem: %w", err)
	}

	args := []string{}
	if sensitivity {
		args = append(args, "--sensitivity")
	}

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, c.binaryPath, args...)
	cmd.Stdin = bytes.NewReader(input)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	c.log.Info("invoking rust solver",
		zap.Int("problem_bytes", len(input)),
		zap.Bool("sensitivity", sensitivity),
	)

	if err := cmd.Run(); err != nil {
		c.log.Error("solver subprocess failed",
			zap.Error(err),
			zap.String("stderr", stderr.String()),
		)
		return nil, fmt.Errorf("solver binary failed: %w\nstderr: %s", err, stderr.String())
	}

	var result SolverResult
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return nil, fmt.Errorf("unmarshal solution: %w\nraw: %s", err, stdout.String())
	}

	result.Problem = prob

	c.log.Info("solver completed",
		zap.String("status", result.Status),
		zap.Float64("total_cost", result.TotalCost),
		zap.Strings("open_dcs", result.OpenDCs),
	)

	return &result, nil
}
