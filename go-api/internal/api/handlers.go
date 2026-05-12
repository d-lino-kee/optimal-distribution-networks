package api

import (
	"net/http"
	"sync"

	"github.com/distribution-optimizer/go-api/internal/solver"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RegisterRoutes wires all HTTP endpoints onto the router.
func RegisterRoutes(r *gin.Engine, s *solver.RustClient, log *zap.Logger) {
	h := &handler{
		solver:    s,
		log:       log,
		scenarios: make(map[string]*scenarioRecord),
	}

	v1 := r.Group("/api/v1")
	{
		v1.GET("/health", h.health)

		// Core optimization
		v1.POST("/optimize", h.optimize)
		v1.POST("/optimize/sensitivity", h.optimizeWithSensitivity)

		// Scenario management
		v1.POST("/scenarios", h.createScenario)
		v1.GET("/scenarios", h.listScenarios)
		v1.GET("/scenarios/:id", h.getScenario)
		v1.POST("/scenarios/:id/whatif", h.whatIf)
	}
}

type scenarioRecord struct {
	ID     string
	Name   string
	Result *solver.SolverResult
}

type handler struct {
	solver    *solver.RustClient
	log       *zap.Logger
	scenarios map[string]*scenarioRecord
	mu        sync.RWMutex
}

// GET /api/v1/health
func (h *handler) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// POST /api/v1/optimize
func (h *handler) optimize(c *gin.Context) {
	var prob solver.Problem
	if err := c.ShouldBindJSON(&prob); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.solver.Solve(c.Request.Context(), prob, false)
	if err != nil {
		h.log.Error("solver error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "solver failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// POST /api/v1/optimize/sensitivity
func (h *handler) optimizeWithSensitivity(c *gin.Context) {
	var prob solver.Problem
	if err := c.ShouldBindJSON(&prob); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.solver.Solve(c.Request.Context(), prob, true)
	if err != nil {
		h.log.Error("solver error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "solver failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// POST /api/v1/scenarios — save a named problem + solution pair.
func (h *handler) createScenario(c *gin.Context) {
	var req struct {
		Name    string         `json:"name" binding:"required"`
		Problem solver.Problem `json:"problem" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.solver.Solve(c.Request.Context(), req.Problem, true)
	if err != nil {
		h.log.Error("solver error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id := uuid.NewString()
	rec := &scenarioRecord{ID: id, Name: req.Name, Result: result}

	h.mu.Lock()
	h.scenarios[id] = rec
	h.mu.Unlock()

	c.JSON(http.StatusCreated, gin.H{
		"scenario_id": id,
		"name":        req.Name,
		"result":      result,
	})
}

// GET /api/v1/scenarios/:id
func (h *handler) getScenario(c *gin.Context) {
	id := c.Param("id")
	h.mu.RLock()
	rec, ok := h.scenarios[id]
	h.mu.RUnlock()
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "scenario not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"scenario_id": rec.ID,
		"name":        rec.Name,
		"result":      rec.Result,
	})
}

// GET /api/v1/scenarios
func (h *handler) listScenarios(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	type item struct {
		ID        string  `json:"scenario_id"`
		Name      string  `json:"name"`
		TotalCost float64 `json:"total_cost"`
		OpenDCs   int     `json:"open_dc_count"`
	}
	out := make([]item, 0, len(h.scenarios))
	for _, rec := range h.scenarios {
		out = append(out, item{
			ID:        rec.ID,
			Name:      rec.Name,
			TotalCost: rec.Result.TotalCost,
			OpenDCs:   len(rec.Result.OpenDCs),
		})
	}
	c.JSON(http.StatusOK, gin.H{"scenarios": out, "count": len(out)})
}

// POST /api/v1/scenarios/:id/whatif
//
// Body: { "demand_overrides": { "ret_nyc": 2400, ... } }
// Returns: baseline cost, what-if cost, delta, and the full re-solved result.
type WhatIfRequest struct {
	DemandOverrides map[string]float64 `json:"demand_overrides"`
}

func (h *handler) whatIf(c *gin.Context) {
	id := c.Param("id")

	h.mu.RLock()
	rec, ok := h.scenarios[id]
	h.mu.RUnlock()
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "scenario not found"})
		return
	}

	var req WhatIfRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Clone baseline problem and apply overrides
	modified := cloneProblem(rec.Result.Problem)
	for i, r := range modified.Retailers {
		if newDemand, ok := req.DemandOverrides[r.ID]; ok {
			modified.Retailers[i].Demand = newDemand
		}
	}

	result, err := h.solver.Solve(c.Request.Context(), modified, true)
	if err != nil {
		h.log.Error("solver error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	baselineCost := rec.Result.TotalCost
	delta := result.TotalCost - baselineCost
	deltaPct := 0.0
	if baselineCost != 0 {
		deltaPct = delta / baselineCost * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"baseline_cost":  baselineCost,
		"whatif_cost":    result.TotalCost,
		"cost_delta":     delta,
		"cost_delta_pct": deltaPct,
		"result":         result,
	})
}

// cloneProblem deep-copies the slices/maps we mutate so what-if overrides
// don't bleed back into the stored baseline.
func cloneProblem(p solver.Problem) solver.Problem {
	out := p
	out.Retailers = append([]solver.Retailer(nil), p.Retailers...)
	out.Plants = append([]solver.Plant(nil), p.Plants...)
	out.DistributionCenters = append([]solver.DistributionCenter(nil), p.DistributionCenters...)
	return out
}
