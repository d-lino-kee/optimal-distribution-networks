package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/distribution-optimizer/go-api/internal/api"
	"github.com/distribution-optimizer/go-api/internal/kafka"
	"github.com/distribution-optimizer/go-api/internal/solver"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

	cfg := loadConfig()

	solverClient := solver.NewRustClient(cfg.SolverBinaryPath, log)

	kafkaConsumer := kafka.NewDemandConsumer(kafka.Config{
		Brokers: cfg.KafkaBrokers,
		Topic:   cfg.KafkaDemandTopic,
		GroupID: "go-api-consumer",
	}, solverClient, log)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(requestLogger(log))
	router.Use(api.CORSMiddleware(cfg.AllowedOrigins))

	api.RegisterRoutes(router, solverClient, log)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 120 * time.Second,
	}

	ctx, cancel := context.WithCancel(context.Background())
	if cfg.KafkaEnabled {
		go kafkaConsumer.Run(ctx)
	} else {
		log.Info("kafka consumer disabled (set KAFKA_ENABLED=true to enable)")
	}

	go func() {
		log.Info("server listening", zap.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down...")
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
}

type Config struct {
	Port             string
	SolverBinaryPath string
	KafkaBrokers     []string
	KafkaDemandTopic string
	KafkaEnabled     bool
	AllowedOrigins   []string
}

func loadConfig() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	solverPath := os.Getenv("SOLVER_BINARY")
	if solverPath == "" {
		solverPath = "./solver"
	}
	kafkaBroker := os.Getenv("KAFKA_BROKERS")
	if kafkaBroker == "" {
		kafkaBroker = "localhost:9092"
	}
	kafkaEnabled := os.Getenv("KAFKA_ENABLED") == "true"

	origins := []string{"http://localhost:3000", "http://localhost:5173"}
	if extra := os.Getenv("ALLOWED_ORIGINS"); extra != "" {
		origins = append(origins, extra)
	}

	return Config{
		Port:             port,
		SolverBinaryPath: solverPath,
		KafkaBrokers:     []string{kafkaBroker},
		KafkaDemandTopic: "demand-updates",
		KafkaEnabled:     kafkaEnabled,
		AllowedOrigins:   origins,
	}
}

func requestLogger(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Info("request",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("duration", time.Since(start)),
		)
	}
}
