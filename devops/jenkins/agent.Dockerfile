FROM eclipse-temurin:17-jdk AS java17
FROM node:22-bookworm-slim AS node
FROM docker:29-cli AS dockercli
FROM aquasec/trivy:0.76.1 AS trivy
FROM jenkins/inbound-agent:jdk21
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 curl git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=java17 /opt/java/openjdk /opt/java17
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
COPY agent.sh /usr/local/bin/freshmart-agent
USER jenkins
ENTRYPOINT ["sh", "/usr/local/bin/freshmart-agent"]
