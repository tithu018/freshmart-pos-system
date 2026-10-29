#!/bin/sh
set -eu
until [ -s /run/agent-secret/secret ] && [ -s /certs/client/key.pem ]; do sleep 2; done
exec java -jar /usr/share/jenkins/agent.jar -url http://jenkins:8080/ -secret @/run/agent-secret/secret -name freshmart-agent -webSocket -workDir /home/jenkins/agent
