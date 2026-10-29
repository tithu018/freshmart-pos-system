# Task 15 verification — 2026-10-29

**Jenkins CI and Trivy scanning are implemented and verified on `main`.**
The final pipeline correctly fails its security gate on existing Java dependency
findings. This is not a clean security approval or production deployment.

## Local environment

- Jenkins 2.580.2, Trivy 0.76.1, Docker Engine 29.9.2.
- Agent: Node 22.23.4; application builds use Temurin Java 17.0.20.1.
  Jenkins controller/agent Remoting use Java 21 independently.
- Local controller: `http://localhost:8085`, job `freshmart-local`.
- Three dedicated containers: controller, unprivileged build agent and TLS
  Docker-in-Docker daemon. No host Docker socket is mounted.
- Actual password and source snapshots are under ignored `.local/`; no secrets
  are included in tracked files or image build contexts.
- Source base: `2ff87e8af64d0b82d96ae9132cd11c4c1d3067c4`, plus explicit Task 15
  working-file overlays. Final build artifacts record SHA-256 overlay provenance.
  No commit, push, branch switch or merge was performed.

## Jenkins build results

| Build | Result | Evidence |
| --- | --- | --- |
| #1 | FAILURE | All 147 application tests and image builds passed; interrupted Java database download caused a scanner error. Incomplete reports and JUnit results still published. |
| #2 | FAILURE | All tests/builds and all four scans completed. Gate blocked 13 backend image findings, including inherited Brotli, and 12 duplicate source dependency findings. |
| #3, final | FAILURE, as required by policy | 147 application tests passed; both images built; all scans complete, zero scanner errors. Gate blocks 12 remaining Java CVEs. Duration approximately 3 minutes using warm caches. |

Final dedicated test stages: **60 frontend unit + 18 React component + 69 backend
JUnit/integration = 147 passed, 0 failed, 0 skipped**. CI/security regression tests:
**13 passed, 0 failed**. Total: **160 passed, 0 failed**. Repeated tests inside Docker
build layers are not counted a second time. Docker reused unchanged cached build
layers in the final run; dedicated application tests ran again.

The CI/security suite covers clean scans, blocking severities, unfixed HIGH review,
infrastructure review, detected secrets, missing/malformed reports, redaction,
resumed downloads, incorrect HTTP ranges, cross-host token stripping and digest
mismatch rejection. The first full build demonstrated real scanner-error failure;
the final full build demonstrated real vulnerability-gate failure. No full pipeline
SUCCESS is claimed while blocking dependencies remain.

## Final scans and report validation

| Scan | HIGH | CRITICAL | Complete |
| --- | ---: | ---: | --- |
| Frontend runtime image | 0 | 0 | Yes |
| Backend runtime image | 6 | 6 | Yes; Java only, OS clean |
| Source dependencies | 6 | 6 | Yes; repeats the same 12 Java CVEs |
| Infrastructure | 1 | 1 | Yes; advisory review |

No HIGH/CRITICAL secrets detected. All four JSON reports, readable text tables,
static HTML summary, source provenance and image metadata are archived. The
authenticated HTML report, JSON artifacts and JUnit endpoint were checked against
the Jenkins FAILURE result and the gate's exit code. There were **26 report
occurrences**, representing **12 unique Java CVEs plus 2 infrastructure findings**.
See [SECURITY-FINDINGS.md](SECURITY-FINDINGS.md) for packages, CVEs, fix candidates,
vendor severity differences and infrastructure review context.

The 945 MiB Java database initially failed with unexpected EOF from both default
mirror and GHCR downloads. The final bounded resumable downloader completed and
verified the official OCI layer digest before installing the database. The final
pipeline reused the verified current database successfully. No Java analysis was
disabled. Cached database digest for this run:
`d238e0e00832976bc4c8e53ab2a99657d586832d3f2709af424a8186e6a5fa79`.

## Security and preservation checks

- Jenkins anonymous API access rejected; authenticated POST without a CSRF crumb
  rejected. Controller has zero executors; dedicated agent is online with one.
- Loopback binding and absence of a published Docker daemon port verified.
  Jenkins reports/history survived controller restart. Admin credentials were
  not reset or printed.
- Source archive inspected: no `.local` files, actual `.env` files or generated
  admin password. Secret match/source text is redacted before report archiving.
- Existing Helm application: Admin/Cashier login, session restoration, HttpOnly
  JWT cookies, existing sales and inventory checks passed using read-only fixture
  verification. No new sales were required for these checks.
- Task 13 and Helm frontend/backend, plus PostgreSQL: all **1/1 Ready**.
  PostgreSQL PVC remained `96692b48-6fee-4300-b6c8-6efdc16c829c`.
- Final frontend image: `nginx -t` passed. Final backend image: `curl --version`
  successfully linked updated Brotli 1.2.1. These temporary verification containers
  used no application volumes or network and were removed automatically.
- Existing application Compose configuration validated with its required values
  supplied from the ignored local test environment; the root `.env` is not present
  on this machine. Jenkins Compose validation passed. No Compose application was
  started or replaced during Task 15.
- PowerShell/Python syntax checks and `git diff --check` passed. Git only warns
  about its configured LF-to-CRLF normalization for the two edited Dockerfiles.
- UI, application source, Maven/npm dependency declarations, GitHub Actions,
  Kubernetes, Helm and Terraform definitions are unchanged. No AWS resources,
  Terraform apply or EKS deployment were performed. Task 16 was not started.

## Files created or modified

Modified:

- `.gitignore`
- `README.md`
- `frontend/Dockerfile`
- `backend/Dockerfile`

Created:

- `Jenkinsfile`
- `devops/jenkins/.dockerignore`
- `devops/jenkins/Dockerfile`
- `devops/jenkins/agent.Dockerfile`
- `devops/jenkins/agent.sh`
- `devops/jenkins/compose.yaml`
- `devops/jenkins/init.groovy`
- `devops/jenkins/plugins.txt`
- `devops/jenkins/Prepare-Local.ps1`
- `devops/jenkins/prepare_snapshot.py`
- `devops/jenkins/run_local.py`
- `devops/jenkins/download_java_db.py`
- `devops/jenkins/scan.sh`
- `devops/jenkins/redact_secrets.py`
- `devops/jenkins/security_gate.py`
- `devops/jenkins/test_download_java_db.py`
- `devops/jenkins/test_security_gate.py`
- `devops/jenkins/README.md`
- `devops/jenkins/SECURITY-FINDINGS.md`
- `devops/jenkins/TEST-RESULTS.md`

## Remaining issues and completion

Task 15's local CI, image/scanner integration, reports, credentials setup and
verification requirements are complete. **Security release clearance remains
blocked** by the documented Java findings; infrastructure findings need review.
No dependency major-version migration or scanner exception was introduced to
make the build green. Optional GitHub webhook/SCM operation is documented but was
not activated; local testing used an explicit snapshot of uncommitted changes.
Docker-in-Docker is privileged and intended only for trusted local source.

Use [README.md](README.md) for startup, credentials, build, report, stop/resume
and optional GitHub integration commands.
