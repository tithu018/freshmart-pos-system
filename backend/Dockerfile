# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /build
COPY pom.xml mvnw ./
COPY .mvn .mvn
COPY src src
RUN --mount=type=cache,target=/root/.m2 sh ./mvnw -B -ntp verify

FROM eclipse-temurin:17-jre-alpine AS runtime
RUN apk add --no-cache curl && apk upgrade --no-cache brotli-libs \
    && addgroup -S -g 10001 freshmart \
    && adduser -S -u 10001 -G freshmart freshmart
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/target/freshmart-pos-backend-*.jar app.jar
USER 10001:10001
ENV SPRING_PROFILES_ACTIVE=prod SERVER_PORT=8081 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8081
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
    CMD curl --fail --silent --output /dev/null http://127.0.0.1:8081/api/auth/csrf || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
