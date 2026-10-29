# Task 14 results — 2026-10-29

**Task 14 is complete for Helm/local deployment and AWS EKS preparation.**
AWS deployment itself was not performed, as requested.

## Initial and final state

- Initial branch: `main`; final branch: `main`. Initial Git status was clean.
- Task 13 Kubernetes files were present in `main`, and its three Deployments were
  healthy before changes. Their Kubernetes manifests were not changed by this task.
- Only Task 13's two setup-script branch guards and corresponding guide were changed
  to `main`, matching the user's post-merge instruction. Other completed work was
  reused, not regenerated or adopted into Helm.
- Helm 4.3.1 was installed through Scoop with the package checksum check passing.
- Existing Minikube 1.39.0, Kubernetes 1.36.1 and Docker Engine 29.9.2 were reused.
- Final Helm release: `freshmart-helm`, namespace/context `freshmart`, chart
  `freshmart-0.1.0`, revision **3**, status **deployed**.
- Both Helm Deployments are **1/1 Ready**, with zero restarts in their final Pods.
  Task 13 frontend/backend/PostgreSQL remain **1/1 Ready**.
- Both local endpoints respond: Task 13 `http://localhost:3000/health` and Helm
  `http://localhost:3001/health` returned HTTP 200. Forwarding helpers are left running.

## Validation results

| Check | Result |
| --- | --- |
| `helm lint --strict` with default values | PASS; 0 charts failed |
| `helm lint --strict` with Minikube values | PASS; 0 charts failed |
| `helm lint --strict` with EKS values | PASS; 0 charts failed |
| Minikube/EKS `helm template` | PASS; 6 local / 9 EKS resources rendered |
| Both profiles: Kubernetes server-side dry run against local cluster | PASS; no resources created by these dry runs |
| Chart contract tests | **11 passed, 0 failed**, including 10 negative configuration subcases |
| PowerShell scripts and Python integration runner syntax | PASS |
| Chart packaging | PASS; inspected archive excludes local credentials/artifacts and test/helper scripts |
| EKS Nginx configuration syntax | PASS using `nginx -t` in the existing local frontend container; no configuration reload or AWS deployment |
| Working tree whitespace check | PASS |

Helm prints the informational recommendation `Chart.yaml: icon is recommended`;
it does not indicate a lint failure. The chart intentionally has no external icon.

## Live application, upgrade and rollback

The repeatable runner is `python devops/helm/test-minikube.py`. It completed with
exit code 0 and checked:

- Existing Admin/Cashier login and session restoration; JWT cookie is HttpOnly
  and scoped to `/api`. Anonymous access, missing CSRF and Cashier access to Admin
  endpoints were rejected with the expected status codes.
- New category/product fixtures and stock-in. Cash and Card checkout each produced
  subtotal **5.00**, discount **1.00**, tax **0.00**, total **4.00**. Idempotent replay
  returned the same sale ID and did not deduct stock twice. Stock changed **10 -> 6**.
- Revision **1** installed one frontend/backend replica using the existing Task 13
  images and external PostgreSQL Service/Secret.
- Revision **2** upgraded both tiers to **two Ready replicas** and changed their
  readiness periods from 5 to 6 seconds, causing real Pod-template rolling updates.
  Existing authenticated session, fresh login/CSRF, sale details and stock passed.
- Revision **3** rolled back to captured revision **1**, restoring one replica per
  component and the 5-second probe period. Session, login and persisted records
  passed again. The Helm history marks revisions 1/2 superseded and 3 deployed.
- All original rows were compared by ID/hash before and after: **5 sales, 5 sale
  items, 3 products, 3 categories and 3 inventory rows** remained unchanged.
- Original Task 13 deployment UIDs were unchanged; PostgreSQL was not restarted,
  adopted or recreated. The original 5 GiB PVC UID stayed
  `96692b48-6fee-4300-b6c8-6efdc16c829c`.

## Browser checks

A visible Chromium session using the Playwright skill tested `localhost:3001`:

- Admin login, reload/session restoration, reports, inventory, employees, customers
  and logout.
- Cashier login, Admin route/API rejection, UI checkout, receipt page containing the
  stored sale ID, and a separate product's inventory changing **3 -> 2**.
- Browser sale total **2.50**; tablet/mobile checks found no horizontal overflow.
- All browser API requests used the same origin, JWT remained HttpOnly, and there
  were **zero JavaScript errors**.

Browser automation completed with exit code 0. Screenshots and fixture identifiers
are retained only in ignored `devops/helm/.local/`; the browser script was placed
in the Windows temporary directory, not the repository.

Final SQL checks after browser testing confirmed **8 sales, revenue 29.00,
discounts 6.00 and taxes 0.00**, consistent with the original five sales plus two
API fixtures and one browser sale. All six existing Flyway migrations remained
successful. Original row hashes were checked again and still matched.

The previous frontend/backend source test suites were not rerun for Task 14:
application code, Dockerfiles, Compose, CI and Terraform were unchanged. The counts
above refer to tests actually executed for this task; Task 13's prior 147 regression
test results are recorded in its own report.

## EKS readiness and remaining requirements

The EKS profile prepares external RDS with `verify-full`/CA mount, runtime Secret
references, registry image references, Secure cookies, same-origin HTTPS, HSTS,
ALB IP targets/HTTPS 443, existing Terraform SG/subnet mapping, two replicas, PDBs
and zone-spread preferences. Unsafe cross-field values are rejected during render.

Before a real deployment, actual infrastructure/identifiers, private API access,
published image pins, registry authorization, a dedicated ALB controller IAM role
and controller installation, ACM validation/DNS, approved ingress CIDRs, runtime
Secret delivery, RDS CA bundle, database login/migration grants and initial account
provisioning are still required. See [EKS-PREPARATION.md](EKS-PREPARATION.md).

RDS TLS handshakes, ALB/controller behavior, AWS IAM and public HTTPS/DNS were not
live-tested. EKS values contain explicit placeholders. Local rendering/syntax checks
do not establish that AWS dependencies exist. No AWS resources, Terraform apply,
actual EKS deployment, automatic commit/push/merge or Task 15 work occurred.

Local limitations remain intentional: port-forward may briefly reconnect after a
frontend rollout; one Minikube node/shared PostgreSQL instance is not HA; backend
probes test HTTP availability rather than DB health; Helm rollback does not undo
database migrations/data. No blocking local issue was found.

## Files changed

Modified (5):

1. `.gitignore`
2. `README.md`
3. `devops/kubernetes/Deploy-Minikube.ps1`
4. `devops/kubernetes/Initialize-Secrets.ps1`
5. `devops/kubernetes/README.md`

Created (23), all under `devops/helm/`:

6. `.helmignore`
7. `Chart.yaml`
8. `values.yaml`
9. `values.schema.json`
10. `values-minikube.yaml`
11. `values-eks.yaml`
12. `templates/_helpers.tpl`
13. `templates/configmap.yaml`
14. `templates/nginx-configmap.yaml`
15. `templates/deployments.yaml`
16. `templates/services.yaml`
17. `templates/ingress.yaml`
18. `templates/pdb.yaml`
19. `templates/validate.yaml`
20. `templates/NOTES.txt`
21. `Install-MinikubeHelm.ps1`
22. `Open-FreshMartHelm.ps1`
23. `requirements-test.txt`
24. `test-chart.py`
25. `test-minikube.py`
26. `README.md`
27. `EKS-PREPARATION.md`
28. `TEST-RESULTS.md`
