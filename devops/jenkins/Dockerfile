FROM jenkins/jenkins:2.580.2-jdk21
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
USER root
RUN mkdir -p /run/agent-secret && chown jenkins:jenkins /run/agent-secret
USER jenkins
COPY init.groovy /usr/share/jenkins/ref/init.groovy.d/freshmart.groovy.override
