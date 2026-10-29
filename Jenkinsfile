pipeline {
    agent { label 'freshmart-ci' }
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 90, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    }
    parameters {
        choice(name: 'SOURCE_MODE', choices: ['local-snapshot', 'scm'], description: 'Use local-snapshot for the Docker setup; scm for Pipeline from SCM.')
    }
    environment {
        VITE_API_BASE_URL = '/api'
        FRONTEND_IMAGE = "freshmart-ci-frontend:${BUILD_NUMBER}"
        BACKEND_IMAGE = "freshmart-ci-backend:${BUILD_NUMBER}"
    }
    stages {
        stage('Checkout source code') {
            steps {
                deleteDir()
                script {
                    if (params.SOURCE_MODE == 'local-snapshot') {
                        sh 'tar -xf /opt/freshmart-source/source.tar -C .'
                    } else {
                        checkout scm
                        sh 'git rev-parse HEAD > SOURCE-REVISION.txt'
                    }
                }
                sh 'mkdir -p reports && cp SOURCE-REVISION.txt reports/source.txt && python3 -m unittest discover -s devops/jenkins -p "test_*.py"'
            }
        }
        stage('Build and test React frontend') {
            steps {
                dir('frontend') {
                    sh '''npm ci
node --test --test-reporter=junit --test-reporter-destination=../reports/frontend-unit.xml tests/*.test.js
npx vitest run --reporter=default --reporter=junit --outputFile.junit=../reports/frontend-components.xml
npm run build'''
                }
            }
        }
        stage('Build and test Spring Boot backend') {
            steps {
                dir('backend') {
                    withEnv(['JAVA_HOME=/opt/java17', 'PATH+JAVA17=/opt/java17/bin']) {
                        sh 'sh ./mvnw -B -ntp verify'
                    }
                }
            }
        }
        stage('Build Docker images') {
            steps {
                sh '''docker info >/dev/null
docker build --pull -t "$FRONTEND_IMAGE" frontend
docker build --pull -t "$BACKEND_IMAGE" backend
docker image inspect "$FRONTEND_IMAGE" "$BACKEND_IMAGE" > reports/images.json'''
            }
        }
        stage('Scan Docker images and source using Trivy') {
            steps {
                sh 'sh devops/jenkins/scan.sh'
            }
        }
        stage('Generate pipeline reports and enforce security gate') {
            steps {
                script {
                    int result = sh(script: 'python3 devops/jenkins/security_gate.py reports', returnStatus: true)
                    if (result == 1) {
                        error('Security gate failed: CRITICAL or fixable HIGH vulnerabilities, or HIGH/CRITICAL secrets. See archived reports.')
                    } else if (result == 2) {
                        unstable('Unfixed HIGH vulnerabilities or HIGH/CRITICAL infrastructure findings require review. See security report.')
                    } else if (result != 0) {
                        error('Security report is missing or invalid; refusing to report a clean scan.')
                    }
                }
            }
        }
    }
    post {
        always {
            script {
                if (fileExists('devops/jenkins/security_gate.py')) {
                    sh 'python3 devops/jenkins/security_gate.py reports --report-only'
                }
            }
            junit testResults: 'reports/frontend-*.xml,backend/target/surefire-reports/*.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
            publishHTML(target: [reportDir: 'reports', reportFiles: 'security.html', reportName: 'Trivy Security', keepAll: true, alwaysLinkToLastBuild: true, allowMissing: true])
        }
    }
}
