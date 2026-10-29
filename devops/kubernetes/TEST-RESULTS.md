# Task 13 verification — 2026-10-29

Work was performed on `devops`. No commit, push, merge, AWS resource creation or
Terraform apply was performed. Application source, Docker Compose, Dockerfiles,
GitHub Actions and Terraform configuration were not modified.

## Environment

- Windows PowerShell and Docker Desktop Linux containers (Docker Engine 29.9.2).
- Minikube 1.39.0, Docker driver, profile/context `freshmart`.
- Kubernetes/kubectl 1.36.1; one 4 CPU / 4 GiB node.
- Namespace `freshmart`; PostgreSQL 17.11 in database `freshmart_kubernetes_test`.
- Existing Dockerfiles built/tagged `freshmart-backend:task13` and
  `freshmart-frontend:task13`; existing image/build layers were reused.
- Native/Compose database storage and the existing stopped `minikube` profile
  were preserved. This deployment has a separate PVC and generated credentials.

## Passed checks

| Check | Observed result |
| --- | --- |
| Manifest validation | Kustomize rendered; Kubernetes server-side dry run accepted all resources |
| Script syntax | All three PowerShell scripts and Python runner parsed successfully |
| Cluster deployment | Node Ready; all three Deployments/Services present; application Pods Ready |
| Storage | `postgres-data` Bound, 5 GiB, `ReadWriteOnce`, `standard` class |
| Secrets | Generated locally with Windows ACL restriction; cluster Opaque Secret; ignored local files; no generated secret values in changed files |
| Flyway | All six existing migrations applied automatically |
| Authentication/security | Admin/Cashier login and session restoration; HttpOnly JWT with `/api` path; anonymous 401 and CSRF/role 403 checks |
| POS API | Cash and Card sales each subtotal 5.00, discount 1.00, tax 0.00, total 4.00 |
| Duplicate prevention | Repeated checkout returned the same sale ID and did not deduct stock twice |
| Inventory | API fixture stock 10 -> 6, exactly two units per sale |
| Scaling | Frontend and backend both reached 2 Ready replicas; JWT/CSRF worked through Service routing |
| Self-healing | Deleted backend/frontend/PostgreSQL Pods replaced with new UIDs; authenticated session recovered |
| Pod persistence | Same PVC UID; sales and inventory verified after PostgreSQL Pod replacement |
| Full cluster persistence | Minikube stop/start retained the PVC, logins, all 5 test sales (18.50 revenue, 4.00 discounts, 0.00 tax) and stock balances 6, 6, 2 |
| DNS startup fix | Final cluster restart: frontend returned Ready with exactly one container restart from the node restart, no additional DNS crash loop |
| Backend rolling restart | Final full suite: 18 authenticated requests during rollout, zero failed requests; an earlier rollout also passed with 24 requests |
| Frontend rolling restart | New Pods became ready and the local port-forward reconnected |
| Test cleanup | Application replicas restored to one; PVC and test fixtures retained |
| Browser Admin | Login, page refresh/session restoration, reports, inventory, employees, customers and logout |
| Browser Cashier | Login; forbidden Admin route/API rejected; UI checkout completed; receipt opened with persisted sale ID |
| Browser stock | Separate fixture stock 3 -> 2, sale total 2.50 |
| Browser layout/security | Desktop/tablet/mobile exercised; no tablet/mobile horizontal overflow; same-origin API; HttpOnly JWT; zero JavaScript errors |
| Backend regression/build | Maven `verify`: **69 passed, 0 failures, 0 errors**, executable JAR built |
| Frontend regression/build | **60 unit + 18 component tests passed**, production Vite build succeeded |

Combined existing automated regression tests: **147 passed, 0 failed in the final
runs**. Kubernetes integration and browser checks above are additional checks,
not included in that unit/integration test count. The full Kubernetes resilience
runner completed with exit code 0. Browser automation completed with exit code 0.
After the final cluster restart, both-role login and stored-sale smoke checks
passed again. Direct SQL confirmed all six migrations, financial totals and stock.
All three Deployments finished at 1/1 Ready with internal ClusterIP Services; the
PVC UID remained `96692b48-6fee-4300-b6c8-6efdc16c829c` throughout these tests.

Browser screenshots and fixture IDs are retained locally under the ignored
`.local/` directory (`admin-desktop.png`, `cashier-tablet.png`,
`cashier-mobile.png`, `receipt.png`, `smoke-state.json`, `browser-state.json`).
They are not part of the commit. The browser script used the Playwright skill
and ran from the Windows temporary directory in a visible Chromium window.

## Issues found and resolved

1. Initial backend startup raced PostgreSQL initialization. Added a database-wait
   init container; subsequent application Pods started without that crash loop.
2. After a cluster restart, Nginx could start before CoreDNS resolved `backend`.
   Added a DNS wait to the frontend command before executing Nginx.
3. The first resilience run's final check raced termination of the Pod used by
   port-forward after scale-down. The test now waits for retiring Pods to disappear
   before checking reconnection; the full rerun passed.
4. The first native frontend component runner timed out starting its worker while
   Maven/cluster setup were running. A subsequent complete frontend test run passed
   after Maven finished; no application/test source changes were needed.
5. A browser launch immediately after a rollout reached the retiring port-forward
   connection. Waiting for the local `/health` endpoint before the browser run
   resolved it; all browser assertions passed.

## Scope and remaining limitations

- This is local Minikube, with one node and one PostgreSQL instance. It is not
  production HA, an EKS deployment, Helm packaging or an internet-facing service.
- Scaling is manual. Rolling **Pod restarts** were tested with the existing images;
  no new application version or database-schema upgrade was introduced.
- Port-forward is bound to a selected frontend Pod and can disconnect briefly
  during replacement. The provided helper reconnects. Browser refresh may be
  required; this does not represent an ingress availability guarantee.
- Local HTTP uses non-Secure cookies; public deployment would require TLS and
  Secure cookies. No TLS/Ingress controller is installed by this task.
- Backend probes check HTTP availability, not database connectivity. PostgreSQL
  availability is checked separately and before backend startup.
- The PVC is node-local persistence, not a backup. Deleting the cluster, namespace
  or PVC can remove the database. Stop the cluster to preserve it.
- Local Secret generation is not a production secret-management system. Keep
  `.local/.env`, kubeconfig and Docker Desktop access private.

No remaining blocking issue was found for the requested local Minikube scope.
Task 13 is complete. The local cluster and browser forwarding are left running
at `http://localhost:3000`; Task 14 was not started.

## Changed files

Modified:

1. `.gitignore`
2. `README.md`
3. `devops/kubernetes/backend-deployment.yaml`
4. `devops/kubernetes/frontend-deployment.yaml`
5. `devops/kubernetes/postgres-deployment.yaml`

Created:

6. `devops/kubernetes/.env.example`
7. `devops/kubernetes/Deploy-Minikube.ps1`
8. `devops/kubernetes/Initialize-Secrets.ps1`
9. `devops/kubernetes/Open-FreshMart.ps1`
10. `devops/kubernetes/README.md`
11. `devops/kubernetes/TEST-RESULTS.md`
12. `devops/kubernetes/configmap.yaml`
13. `devops/kubernetes/kustomization.yaml`
14. `devops/kubernetes/namespace.yaml`
15. `devops/kubernetes/nginx.conf`
16. `devops/kubernetes/services.yaml`
17. `devops/kubernetes/test-minikube.py`
