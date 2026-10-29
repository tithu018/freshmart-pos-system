# Task 15 security findings — 2026-10-29

Source: Trivy 0.76.1 reports from local Jenkins **freshmart-local #3**.
All four scans completed without scanner errors. The pipeline correctly returned
**FAILURE**. No ignore file, CVE suppression or severity override was added.

## Final scan counts

| Target | HIGH | CRITICAL | Decision |
| --- | ---: | ---: | --- |
| Frontend image | 0 | 0 | Pass |
| Backend image | 6 | 6 | Block; Java dependencies only |
| Source dependencies | 6 | 6 | Block; same Java CVEs as the image |
| Infrastructure | 1 | 1 | Review under the documented advisory policy |

There are **12 unique remaining Java CVEs**, not 24: source and image scans report
the same dependencies. npm dependencies and both runtime OS package sets have
zero HIGH/CRITICAL findings. No HIGH/CRITICAL secret findings were reported.
These are scanner findings; package presence alone does not establish that an
application exposes every vulnerable execution path.

## OS fixes applied and verified

- Frontend: updated `brotli-libs` from 1.2.0-r1 to 1.2.1-r0 and `curl`/`libcurl`
  from 8.22.0-r0 to 8.23.0-r0 using the existing Alpine package repository.
  This cleared CVE-2026-111497 and both package occurrences of CVE-2026-92392.
- Backend: updated the inherited Brotli package to 1.2.1-r0, clearing
  CVE-2026-111497. Its curl installation was already at 8.23.0-r0.
- Existing base-image families, Java 17, non-root users, entrypoints, health
  checks, application code and configuration behavior were preserved.

## Remaining Java findings

Versions below are installed versions and candidate fixes reported by Trivy;
they are not instructions to override the Spring Boot BOM without compatibility
testing. The current application uses Spring Boot 3.5.16.

| Package | Installed | CVEs | Trivy severity | Reported fix on relevant line |
| --- | --- | --- | --- | --- |
| jackson-core | 2.21.4 | CVE-2026-89407, CVE-2026-89425 | HIGH | 2.21.7 |
| jackson-databind | 2.21.4 | CVE-2026-68497 | HIGH | 2.21.6 |
| jackson-databind | 2.21.4 | CVE-2026-91776, CVE-2026-91777 | HIGH | 2.21.7 |
| tomcat-embed-core | 10.1.55 | CVE-2026-65182, CVE-2026-65905, CVE-2026-68525 | CRITICAL | 10.1.58 |
| tomcat-embed-core | 10.1.55 | CVE-2026-65637 | CRITICAL | 10.1.59 |
| postgresql JDBC | 42.7.11 | CVE-2026-54291 | HIGH | 42.7.12 |
| spring-webmvc | 6.2.19 | CVE-2026-47884, CVE-2026-47890 | CRITICAL | 7.0.9 OSS; see vendor notes below |

Spring's vendor advisories classify
[CVE-2026-47884](https://spring.io/security/cve-2026-47884/) as MEDIUM and
[CVE-2026-47890](https://spring.io/security/cve-2026-47890/) as LOW, unlike the
severity selected by Trivy's database. The vendor lists 6.2.20 as an enterprise
fix and 7.0.9 as the OSS fix for both. The first requires particular XSLT view
rendering behavior; the second requires SSE view fragments. A source search found
no `XsltView`, `SseEmitter`, `ServerSentEvent`, `ModelAndView` or
`text/event-stream` references in this application's main backend source. This
is initial applicability evidence, not an approved exception or proof of absence.
Both findings remain visible and blocking.

Remediation requires a deliberate, tested dependency update: coordinate Jackson
modules and embedded Tomcat through a compatible BOM, update JDBC, and choose a
supported Spring framework path. Switching Spring framework major versions or
introducing an enterprise repository is outside this CI/scanning task. No Maven
dependency versions were changed. The build must remain blocked until fixes or
an explicit, evidence-based policy decision are reviewed.

## Infrastructure findings retained for review

- **AWS-0039 / HIGH**, `devops/terraform/modules/eks/main.tf`: the static rule
  expects explicit EKS secrets encryption configuration. The design selects
  Kubernetes 1.36. AWS documents [default envelope encryption for EKS 1.28 and
  later](https://docs.aws.amazon.com/eks/latest/userguide/envelope-encryption.html).
  This suggests a limitation in the rule's interpretation of AWS defaults.
  The finding remains in reports; no cluster was created or inspected in AWS.
- **AWS-0104 / CRITICAL**, `devops/terraform/modules/eks/security.tf`: worker
  HTTPS egress is allowed to `0.0.0.0/0` on TCP 443 to reach AWS APIs and image
  registries through NAT. This is outbound HTTPS, not unrestricted inbound access
  or all-port egress. A production design should review VPC endpoints, destination
  restrictions and egress controls. Task 12 networking was not modified.

Terraform scanning warns that `aws_account_id` and `cluster_admin_role_arns` have
no real values in this source-only scan. This is expected without private tfvars;
some value-dependent checks remain limited. The 19 detected configuration targets
include Dockerfiles, Kubernetes, rendered Helm and Terraform. No AWS deployment,
Terraform apply or real cloud plan was performed.

## Reports and scope

Open Jenkins build #3 -> **Trivy Security**, **Test Result** or **Artifacts**.
Artifacts include full JSON, readable tables, an escaped static HTML summary,
image IDs, source SHA-256 provenance and JUnit results. The local downloaded copy
is ignored by Git at `.local/reports-3/`. No production application deployment was
performed; existing Minikube/Helm images were intentionally left running.

Task 15's pipeline and scanning implementation is verified. **A clean security
gate and production release approval have not been achieved.** Dependency
remediation and infrastructure review remain outstanding.
