# Build the fat JAR with sbt-assembly, then run on a slim JRE.
FROM sbtscala/scala-sbt:eclipse-temurin-21.0.2_13_1.10.0_3.4.2 AS build
WORKDIR /src
COPY build.sbt project ./
COPY project ./project
RUN sbt update
COPY src ./src
RUN sbt assembly

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/scala-3.3.3/*-assembly-*.jar /app/app.jar
ENV KAFKA_BROKERS=kafka:29092
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
