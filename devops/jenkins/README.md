# Task 15: local Jenkins and Trivy

Verified results and the complete file list: [TEST-RESULTS.md](TEST-RESULTS.md).
The pipeline currently blocks on the [documented Java dependency findings](SECURITY-FINDINGS.md).

Run these commands in PowerShell from the repository root on **main**. Docker
Desktop must be running with Linux containers. Python 3 and Git are required on
Windows; Java, Node, Maven Wrapper, Docker CLI and Trivy run in the build agent.
The initial download/build takes several minutes. Keep enough Docker Desktop
memory for Jenkins builds and the existing Minikube cluster (8 GiB minimum here;
more memory is helpful). Builds run sequentially.

## Start and sign in

```powershell
git branch --show-current
# Stop if the output is not main.
powershell -NoProfile -ExecutionPolicy Bypass -File devops/jenkins/Prepare-Local.ps1
docker compose -f devops/jenkins/compose.yaml up --build -d
docker compose -f devops/jenkins/compose.yaml ps
Start-Process http://localhost:8085
```

Sign in as **admin**. Open `devops/jenkins/.local/admin-password.txt` locally to
retrieve the generated password; do not paste it into source, tickets or logs.
The file has a restricted Windows ACL and is ignored by Git. Setup preserves an
existing password and Jenkins home. Changing the file does not reset an existing
Jenkins account: use Jenkins account settings for password rotation, then update
the protected local file to match if you use the Python helper.

The controller listens on loopback only, has zero build executors, requires
authentication, and keeps Jenkins CSRF protection enabled. No agent port is
published: the dedicated unprivileged agent connects over WebSocket. The agent
uses Java 21 for Jenkins Remoting and **Java 17** for the application.

A separate TLS Docker-in-Docker daemon stores only CI images/build cache. No
Docker Desktop socket, application data or Kubernetes credentials are mounted.
Docker-in-Docker requires `privileged: true`; this is a trusted local build
environment, not a sandbox for hostile pull requests. Do not expose this setup
publicly or use it for untrusted code. Only the agent receives Docker client
certificates; the controller does not run builds. Named volumes retain Jenkins
history, agent state and image cache.

## Run the pipeline

In Jenkins, open **freshmart-local -> Build with Parameters**, leave
`SOURCE_MODE=local-snapshot`, and select **Build**. Or use the local helper:

```powershell
python devops/jenkins/run_local.py start
python devops/jenkins/run_local.py check
python devops/jenkins/run_local.py status
python devops/jenkins/run_local.py console
python devops/jenkins/run_local.py reports
```

The helper reads the password file directly, uses a session cookie and Jenkins
CSRF crumb, and never places credentials in command arguments. Reports download
to ignored `.local/reports-lastBuild/`. Use `--build 1` to select a specific build.

The local source checkout uses `git archive HEAD` plus an explicit overlay of
the working `Jenkinsfile`, application Dockerfiles and `devops/jenkins/` source files. It excludes ignored
credentials and does not create commits. `reports/source.txt` records the base
commit and SHA-256 overlay provenance. Other uncommitted application changes are **not**
part of this snapshot. Refresh Task 15 changes between builds with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File devops/jenkins/Prepare-Local.ps1
docker compose -f devops/jenkins/compose.yaml up --build -d
docker compose -f devops/jenkins/compose.yaml restart jenkins
```

Wait for the controller and agent to reconnect. Do not refresh while a build is
running. The bootstrap script refreshes only the `freshmart-local` job definition
on controller startup. Other jobs are left alone.

Pipeline stages:

1. Checkout the trusted local snapshot, or `checkout scm` for a repository job.
2. Install frontend lockfile dependencies, run Node/Vitest tests and build Vite.
3. Run Java 17 Maven Wrapper `verify`, including isolated H2 integration tests.
4. Build both existing production Dockerfiles with refreshed base images.
5. Scan runtime images, source dependencies/secrets and infrastructure with Trivy.
6. Publish JUnit, JSON/text/HTML security reports and enforce the security gate.

The pipeline never deploys, pushes images, creates AWS resources or changes the
working Minikube/Helm application. GitHub Actions remains the existing publishing
workflow. The Dockerfiles also run tests, so image-build checks repeat the suite;
the Jenkins JUnit count contains the dedicated test stages only.

## Security gate and reports

Trivy 0.76.1 refreshes the vulnerability database from official GHCR with up to
three attempts. A Python helper downloads the official Java DB OCI layer using
sixteen bounded, resumable HTTP ranges, verifies the complete SHA-256 against the
registry manifest, then installs only its two expected regular files. Registry
tokens remain in memory and are stripped on cross-host redirects. A Linux file
lock prevents simultaneous cache updates. Each chunk
has at most ten attempts within a 30-minute download limit. Digest/transport errors
block scanning; this never substitutes a different database or disables Java analysis.
The first Java database download is large (approximately 945 MiB in this run);
the cache persists in the agent volume. Download failures block the build.
All HIGH
and CRITICAL findings remain in archived JSON/text reports; there is no ignore
file or `--ignore-unfixed` flag.

| Finding | Jenkins result |
| --- | --- |
| CRITICAL vulnerability, including one without a fix | FAILURE |
| HIGH vulnerability with a published fix | FAILURE |
| HIGH/CRITICAL secret detection | FAILURE; secret match/source text redacted from artifacts |
| HIGH vulnerability without a fix | UNSTABLE; explicitly requires review |
| HIGH/CRITICAL infrastructure misconfiguration | UNSTABLE; explicitly requires review |
| Scanner/download error, missing or malformed required report | FAILURE |
| No above findings and all tests/builds pass | SUCCESS |

Infrastructure findings are advisory because the repository includes intentional
local-only configurations (including privileged Docker-in-Docker) and undeployed
AWS templates. This is not production approval. Review each finding and apply
production-specific controls before deployment. The JSON and readable tables
retain rule IDs and targets. No findings are silently waived. If both blocking
and advisory findings exist, FAILURE takes precedence.

The **Trivy Security** build report and **Artifacts** contain all scan results,
image IDs and source provenance. **Test Result** contains frontend/backend JUnit
results. Reports publish even on failure, and incomplete scans are labelled as
such. HTML is escaped/static; Jenkins content-security policy stays enabled.
Reports are authenticated; only the generated admin account exists initially.

Run the gate regression tests independently:

```powershell
python -m unittest discover -s devops/jenkins -p "test_*.py"
```

## Optional GitHub checkout and webhook

After you choose to commit/push these files, create a separate **Pipeline** job:
choose **Pipeline script from SCM -> Git**, the repository URL, branch `*/main`,
script path `Jenkinsfile`. For a private repository, create a Jenkins credential
with a narrowly scoped read-only GitHub token or SSH deploy key and select its
credential ID in the SCM configuration. Never put tokens in repository URLs,
parameters, environment files or the Jenkinsfile. Select `SOURCE_MODE=scm` when
building this job; the local bootstrap job must use `local-snapshot`.

Manual SCM builds require no webhook. A GitHub webhook cannot reach localhost.
For optional automated triggers, first deploy Jenkins behind authenticated
administration and a properly configured HTTPS reverse proxy, install/configure
the official GitHub plugin, enable **GitHub hook trigger for GITScm polling**, and
configure the repository push webhook to `https://your-ci-host/github-webhook/`.
Configure a random webhook secret in both GitHub and the Jenkins GitHub plugin's
shared-secret credential setting; use push events on the trusted main branch.
Keep CSRF enabled and do not expose port 8085 through a public tunnel just to
test this local setup. No webhook, remote Jenkins or GitHub settings were changed
by Task 15.

## Stop and resume

```powershell
docker compose -f devops/jenkins/compose.yaml stop
docker compose -f devops/jenkins/compose.yaml start
```

`down` removes these containers/network but retains named volumes. Do not use
`down -v` unless you intentionally want to erase Jenkins history and CI caches.
Existing FreshMart Compose, Minikube, Helm and PostgreSQL resources are separate.
Cache sizes grow with builds; inspect CI-only caches before deciding to prune.

References: [Jenkins Docker setup](https://www.jenkins.io/doc/book/installing/docker/),
[Jenkins agent isolation](https://www.jenkins.io/doc/book/using/using-agents/),
[Jenkins GitHub webhook integration](https://plugins.jenkins.io/github/),
[Trivy vulnerability scanning](https://trivy.dev/docs/latest/guide/scanner/vulnerability/),
[Trivy filtering](https://trivy.dev/docs/latest/configuration/filtering/).
