package optimizer

import com.typesafe.scalalogging.LazyLogging
import io.circe.parser.decode
import io.circe.syntax.*
import optimizer.Codecs.given
import org.apache.kafka.streams.{KafkaStreams, StreamsBuilder, Topology}
import org.apache.kafka.streams.kstream.{Consumed, Produced}
import org.apache.kafka.common.serialization.Serdes

object DemandStreamApp extends LazyLogging:

    def main(args: Array[String]): Unit =
        val cfg = AppConfig.load()
        val topo = buildTopology(cfg)
        val streams = new KafkaStreams(topo, KafkaProps.streams(cfg))
        sys.addShutdownHook { streams.close() }
        streams.start()
        logger.info("Demand stream processor started")

    // buildTopology is exposed for unit testing with kafka-streams-test-utils.
    def buildTopology(cfg: AppConfig): Topology =
        val builder = new StreamsBuilder()
        val strSerde = Serdes.String()

        // Read raw signals, parse, decide whether to emit a DemandEvent.
        builder
            .stream[String, String](
                Topics.DemandSignals,
                Consumed.`with`(strSerde, strSerde)
            )
            .flatMapValues { raw =>
                decode[RetailDemandSignal](raw) match
                    case Right(sig) =>
                        threshold(sig, cfg) match
                            case Some(event) => java.util.Collections.singletonList(event.asJson.noSpaces)
                            case None        => java.util.Collections.emptyList[String]()
                    case Left(err) =>
                        logger.warn(s"Bad signal: $err")
                        java.util.Collections.emptyList[String]()
            }
            .to(Topics.DemandUpdates, Produced.`with`(strSerde, strSerde))

        builder.build()

    // A real implementation would compare against a windowed baseline. Here we
    // emit when |demand| exceeds the configured threshold magnitude, just so
    // the topology has an emit-path the tests can exercise.
    private def threshold(signal: RetailDemandSignal, cfg: AppConfig): Option[DemandEvent] =
        if signal.demand <= 0 then None
        else
            val delta = math.abs(signal.demand) * cfg.thresholdPct
            if delta < 1.0 then None
            else Some(DemandEvent(
                eventId    = java.util.UUID.randomUUID().toString,
                occurredAt = signal.reportedAt,
                problem    = OptimizationProblem(Nil, Nil, Nil, ShippingCosts(Map.empty, Map.empty)),
                trigger    = "threshold_breach",
                deltaPct   = cfg.thresholdPct
            ))
