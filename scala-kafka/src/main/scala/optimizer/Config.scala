package optimizer

import java.util.Properties
import org.apache.kafka.streams.StreamsConfig

object Topics:
    val DemandSignals: String = sys.env.getOrElse("TOPIC_DEMAND_SIGNALS", "demand-signals")
    val DemandUpdates: String = sys.env.getOrElse("TOPIC_DEMAND_UPDATES", "demand-updates")

case class AppConfig(
    bootstrapServers: String,
    applicationId: String,
    thresholdPct: Double
)

object AppConfig:
    def load(): AppConfig = AppConfig(
        bootstrapServers = sys.env.getOrElse("KAFKA_BROKERS", "localhost:9092"),
        applicationId    = sys.env.getOrElse("KAFKA_APP_ID", "demand-stream-app"),
        thresholdPct     = sys.env.getOrElse("DEMAND_THRESHOLD_PCT", "0.10").toDouble
    )

object KafkaProps:
    def streams(cfg: AppConfig): Properties =
        val p = new Properties()
        p.put(StreamsConfig.APPLICATION_ID_CONFIG, cfg.applicationId)
        p.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, cfg.bootstrapServers)
        p.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG,
            "org.apache.kafka.common.serialization.Serdes$StringSerde")
        p.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG,
            "org.apache.kafka.common.serialization.Serdes$StringSerde")
        p
