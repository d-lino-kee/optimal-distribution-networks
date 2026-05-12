package optimizer

import io.circe.*
import io.circe.generic.semiauto.*

// Case classes are immutable data containers like Rust structs and Copy
case class RetailDemandSignal(
    retailerId: String,
    demand: Double,
    reportedAt: java.time.Instant,
    source: String
)

case class Plant(id: String, capacity: Double)

case class DistributionCenter(
    id: String,
    city: String,
    fixedCost: Double,
    capacity: Double,
    minUtilization: Double
)

case class Retailer(id: String, demand: Double)

case class ShippingCosts(
    plantToDc: Map[String, Map[String, Double]],
    dcToRetailer: Map[String, Map[String, Double]]
)

case class OptimizationProblem(
    plants: List[Plant],
    distributionCenters: List[DistributionCenter],
    retailers: List[Retailer],
    shippingCosts: ShippingCosts
)

// DemandEvent is what gets published to Kafka -> consumed by Go API
case class DemandEvent(
    eventId: String,
    occurredAt: java.time.Instant,
    problem: OptimizationProblem,
    trigger: String,
    deltaPct: Double
)

object Codecs:
    // Manual codec for java.time.Instant (not auto-derivable) - declare BEFORE
    // the case-class codecs so they can resolve it as a `given`.
    given Encoder[java.time.Instant] = Encoder.encodeString.contramap(_.toString)
    given Decoder[java.time.Instant] = Decoder.decodeString.map(java.time.Instant.parse)

    given Codec[Plant]                  = deriveCodec
    given Codec[DistributionCenter]     = deriveCodec
    given Codec[Retailer]               = deriveCodec
    given Codec[ShippingCosts]          = deriveCodec
    given Codec[OptimizationProblem]    = deriveCodec
    given Codec[RetailDemandSignal]     = deriveCodec
    given Codec[DemandEvent]            = deriveCodec
