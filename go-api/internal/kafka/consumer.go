package kafka

import (
	"context"
	"encoding/json"
	"time"

	"github.com/distribution-optimizer/go-api/internal/solver"
	kafka "github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

// Config holds Kafka connection settings.
type Config struct {
	Brokers []string
	Topic   string
	GroupID string
}

// DemandEvent is published by the Scala layer whenever retail demand changes.
type DemandEvent struct {
	EventID    string             `json:"event_id"`
	OccurredAt time.Time          `json:"occurred_at"`
	Problem    solver.Problem     `json:"problem"`
	Trigger    string             `json:"trigger"` // "scheduled" | "threshold_breach" | "manual"
	DeltaPct   float64            `json:"delta_pct"` // demand change that triggered this event
}

// DemandConsumer reads DemandEvents from Kafka and re-runs the solver.
type DemandConsumer struct {
	reader *kafka.Reader
	solver *solver.RustClient
	log    *zap.Logger
}

func NewDemandConsumer(cfg Config, s *solver.RustClient, log *zap.Logger) *DemandConsumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        cfg.Brokers,
		Topic:          cfg.Topic,
		GroupID:        cfg.GroupID,
		MinBytes:       1,
		MaxBytes:       10 << 20, // 10 MB
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	return &DemandConsumer{reader: reader, solver: s, log: log}
}

// Run blocks and processes demand events until ctx is cancelled.
func (c *DemandConsumer) Run(ctx context.Context) {
	c.log.Info("kafka consumer started")
	defer c.reader.Close()

	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				c.log.Info("kafka consumer shutting down")
				return
			}
			c.log.Error("kafka read error", zap.Error(err))
			time.Sleep(2 * time.Second)
			continue
		}

		c.processMessage(ctx, msg)
	}
}

func (c *DemandConsumer) processMessage(ctx context.Context, msg kafka.Message) {
	var event DemandEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		c.log.Error("failed to decode demand event",
			zap.Error(err),
			zap.ByteString("raw", msg.Value),
		)
		return
	}

	c.log.Info("demand event received",
		zap.String("event_id", event.EventID),
		zap.String("trigger", event.Trigger),
		zap.Float64("delta_pct", event.DeltaPct),
	)

	// Re-run solver with updated demand; run sensitivity so Ruby layer can report
	result, err := c.solver.Solve(ctx, event.Problem, true)
	if err != nil {
		c.log.Error("solver failed for demand event",
			zap.String("event_id", event.EventID),
			zap.Error(err),
		)
		return
	}

	c.log.Info("re-optimization complete",
		zap.String("event_id", event.EventID),
		zap.String("status", result.Status),
		zap.Float64("total_cost", result.TotalCost),
		zap.Strings("open_dcs", result.OpenDCs),
	)

	// In production: publish result to "optimization-results" Kafka topic
	// or persist to Postgres for Ruby to pick up.
}