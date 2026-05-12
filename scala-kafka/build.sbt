ThisBuild / scalaVersion := "3.3.3"
ThisBuild / organization := "com.distribution"

lazy val root = (project in file("."))
    .settings(
        name := "distribution-kafka-streams",
        libraryDependencies ++= Seq(
            // %% appends Scala version; %% uses _3 for Scala 3, % uses the raw artifact
            "org.apache.kafka" %  "kafka-clients"  % "3.7.0",
            "org.apache.kafka" %  "kafka-streams"  % "3.7.0",

            // Circe — Scala's most popular JSON library
            "io.circe" %% "circe-core"    % "0.14.9",
            "io.circe" %% "circe-generic" % "0.14.9",
            "io.circe" %% "circe-parser"  % "0.14.9",

            // SLF4J logging facade
            "org.slf4j"      %  "slf4j-api"       % "2.0.13",
            "ch.qos.logback" %  "logback-classic" % "1.5.6",
            "com.typesafe.scala-logging" %% "scala-logging" % "3.9.5",

            // Test
            "org.scalatest" %% "scalatest" % "3.2.19" % Test,
            "org.apache.kafka" % "kafka-streams-test-utils" % "3.7.0" % Test
        ),
        assembly / mainClass := Some("optimizer.DemandStreamApp")
    )
