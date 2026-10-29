#!/bin/sh
set -eu
mkdir -p reports
trivy --version > reports/trivy-version.txt
# Refresh databases explicitly with bounded retries. Official GHCR avoids the
# interrupted Java DB transfers observed from the default mirror on this network.
download_db() {
    attempt=1
    until trivy image --no-progress --timeout 20m "$@"; do
        if [ "$attempt" -ge 3 ]; then return 1; fi
        echo "Database download failed; retrying ($attempt/3)" >&2
        attempt=$((attempt + 1))
        sleep 5
    done
}
download_db --download-db-only --db-repository ghcr.io/aquasecurity/trivy-db:2
python3 devops/jenkins/download_java_db.py
# These flags reuse databases successfully refreshed above, never bypass the refresh.
export TRIVY_SKIP_DB_UPDATE=true TRIVY_SKIP_JAVA_DB_UPDATE=true TRIVY_NO_PROGRESS=true
# Never use --ignore-unfixed: unresolved findings must remain visible.
# Scan all targets before enforcing the aggregate gate. Scanner errors fail immediately.
trivy image --timeout 15m --scanners vuln --severity HIGH,CRITICAL --format json --output reports/frontend-image.json "$FRONTEND_IMAGE"
trivy image --timeout 15m --scanners vuln --severity HIGH,CRITICAL --format json --output reports/backend-image.json "$BACKEND_IMAGE"
private_report=$(mktemp)
trap 'rm -f "$private_report"' EXIT
trivy fs --timeout 15m --scanners vuln,secret --severity HIGH,CRITICAL --skip-dirs .git --skip-dirs frontend/node_modules --skip-dirs frontend/dist --skip-dirs reports --skip-dirs devops/jenkins/.local --format json --output "$private_report" .
python3 devops/jenkins/redact_secrets.py "$private_report" reports/dependencies.json
# Scan committed infrastructure, not downloaded providers, generated credentials or rendered local values.
trivy config --timeout 15m --helm-kube-version 1.36.1 --severity HIGH,CRITICAL --skip-dirs .git --skip-dirs .terraform --skip-dirs .local --skip-dirs frontend/node_modules --skip-dirs frontend/dist --skip-dirs backend/target --skip-dirs reports --format json --output reports/infrastructure.json .
for report in frontend-image backend-image dependencies infrastructure; do
    case "$report" in
        infrastructure) scanners=misconfig ;;
        dependencies) scanners=vuln,secret ;;
        *) scanners=vuln ;;
    esac
    trivy convert --scanners "$scanners" --format table --output "reports/$report.txt" "reports/$report.json"
done
