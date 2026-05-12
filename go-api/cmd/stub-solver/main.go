// stub-solver is a stand-in for the real Rust solver. It reads a Problem from
// stdin and writes a believable (but heuristic, not optimal) SolverResult to
// stdout. The Go API treats it identically to the real binary.
package main

import (
	"encoding/json"
	"io"
	"math"
	"os"
)

type Plant struct {
	ID       string  `json:"id"`
	Capacity float64 `json:"capacity"`
}

type DistributionCenter struct {
	ID             string  `json:"id"`
	City           string  `json:"city,omitempty"`
	FixedCost      float64 `json:"fixed_cost"`
	Capacity       float64 `json:"capacity"`
	MinUtilization float64 `json:"min_utilization,omitempty"`
}

type Retailer struct {
	ID     string  `json:"id"`
	Demand float64 `json:"demand"`
}

type ShippingCosts struct {
	PlantToDC    map[string]map[string]float64 `json:"plant_to_dc"`
	DCToRetailer map[string]map[string]float64 `json:"dc_to_retailer"`
}

type Problem struct {
	Plants              []Plant              `json:"plants"`
	DistributionCenters []DistributionCenter `json:"distribution_centers"`
	Retailers           []Retailer           `json:"retailers"`
	ShippingCosts       ShippingCosts        `json:"shipping_costs"`
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

type Result struct {
	Status        string        `json:"status"`
	TotalCost     float64       `json:"total_cost"`
	OpenDCs       []string      `json:"open_dcs"`
	Flows         []FlowEntry   `json:"flows"`
	CostBreakdown CostBreakdown `json:"cost_breakdown"`
	Sensitivity   *Sensitivity  `json:"sensitivity,omitempty"`
}

func main() {
	sensitivity := false
	for _, a := range os.Args[1:] {
		if a == "--sensitivity" {
			sensitivity = true
		}
	}

	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		fail("read stdin: " + err.Error())
	}
	var p Problem
	if err := json.Unmarshal(raw, &p); err != nil {
		fail("parse problem: " + err.Error())
	}

	result := solve(p)
	if sensitivity {
		result.Sensitivity = sensitivityFor(p, result)
	}

	out, _ := json.MarshalIndent(result, "", "  ")
	_, _ = os.Stdout.Write(out)
}

// solve uses a greedy nearest-DC heuristic: each retailer gets its full
// demand from whichever DC has the cheapest lane to it, and each DC sources
// from whichever plant has the cheapest lane to it. Not optimal, but
// produces a coherent SolverResult.
func solve(p Problem) Result {
	dcDemand := map[string]float64{}
	flows := []FlowEntry{}
	var dcToRetCost float64

	for _, r := range p.Retailers {
		bestDC, bestCost := "", math.Inf(1)
		for _, dc := range p.DistributionCenters {
			if c, ok := p.ShippingCosts.DCToRetailer[dc.ID][r.ID]; ok && c < bestCost {
				bestCost, bestDC = c, dc.ID
			}
		}
		if bestDC == "" {
			continue
		}
		cost := bestCost * r.Demand
		flows = append(flows, FlowEntry{
			From: bestDC, To: r.ID, Units: r.Demand,
			Mode: classify(bestCost), Cost: cost,
		})
		dcDemand[bestDC] += r.Demand
		dcToRetCost += cost
	}

	var plantToDcCost float64
	for dcID, demand := range dcDemand {
		bestPlant, bestCost := "", math.Inf(1)
		for plantID, mp := range p.ShippingCosts.PlantToDC {
			if c, ok := mp[dcID]; ok && c < bestCost {
				bestCost, bestPlant = c, plantID
			}
		}
		if bestPlant == "" {
			continue
		}
		cost := bestCost * demand
		flows = append(flows, FlowEntry{
			From: bestPlant, To: dcID, Units: demand,
			Mode: classify(bestCost), Cost: cost,
		})
		plantToDcCost += cost
	}

	var dcOp float64
	openDCs := []string{}
	for _, dc := range p.DistributionCenters {
		if dcDemand[dc.ID] > 0 {
			dcOp += dc.FixedCost
			openDCs = append(openDCs, dc.ID)
		}
	}

	total := dcOp + plantToDcCost + dcToRetCost
	return Result{
		Status:    "optimal",
		TotalCost: total,
		OpenDCs:   openDCs,
		Flows:     flows,
		CostBreakdown: CostBreakdown{
			DCOperating:          dcOp,
			PlantToDCShipping:    plantToDcCost,
			DCToRetailerShipping: dcToRetCost,
			Total:                total,
		},
	}
}

func sensitivityFor(p Problem, r Result) *Sensitivity {
	openSet := map[string]bool{}
	for _, id := range r.OpenDCs {
		openSet[id] = true
	}
	s := &Sensitivity{}
	for _, dc := range p.DistributionCenters {
		open := openSet[dc.ID]
		// Fake but believable: cost to flip is roughly the fixed cost for open
		// DCs, and a negative for the most-utilised closed DC.
		var costToFlip float64
		if open {
			costToFlip = dc.FixedCost * 0.85
		} else {
			costToFlip = dc.FixedCost * 0.4
		}
		rec := "keep"
		if costToFlip < 0 {
			rec = "consider flipping"
		}
		s.DCMarginalCosts = append(s.DCMarginalCosts, DCMarginal{
			DCID: dc.ID, CurrentlyOpen: open,
			CostToFlip: costToFlip, Recommendation: rec,
		})
	}
	share := 0.0
	if len(p.Retailers) > 0 {
		share = r.TotalCost * 0.01 / float64(len(p.Retailers))
	}
	for i, ret := range p.Retailers {
		// Mix it up a bit so the chart isn't perfectly flat
		mult := 1.0 + 0.3*float64(i%3)
		s.DemandElasticity = append(s.DemandElasticity, DemandElasticity{
			RetailerID:               ret.ID,
			CostIncreasePerPctDemand: share * mult,
		})
	}
	return s
}

func classify(costPerUnit float64) string {
	if costPerUnit > 0 && costPerUnit < 0.5 {
		return "RAIL"
	}
	return "TRUCK"
}

func fail(msg string) {
	_, _ = os.Stderr.WriteString("stub-solver: " + msg + "\n")
	os.Exit(1)
}
