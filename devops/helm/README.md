# FreshMart Helm deployment (Task 14)

Use **`main`** after the Task 13 merge. This application chart packages the existing
frontend/backend images. It does not create/adopt PostgreSQL, a PVC, a Namespace,
credential Secrets, AWS resources or an AWS controller. It has no subchart dependencies.

## Local setup: preserve Task 13

Prerequisites: Docker Desktop Linux containers, the existing `freshmart` Minikube
profile/namespace, working Task 13 database and accounts, existing `task13` images,
Helm **4**, kubectl and PowerShell. Tested with Helm 4.3.1 / Kubernetes 1.36.1.
Install Helm if missing with `scoop install helm` or the official
[Helm installation instructions](https://helm.sh/docs/intro/install/).

From the repository root:

```powershell
if ((git branch --show-current) -ne 'main') { throw 'Stop: work only on main.' }
minikube start -p freshmart --driver=docker --cpus=4 --memory=4096 --kubernetes-version=v1.36.1
kubectl --context=freshmart -n freshmart wait --for=condition=Ready pod --all --timeout=600s
helm version --short
helm lint devops/helm --strict
helm lint devops/helm -f devops/helm/values-minikube.yaml --strict
helm lint devops/helm -f devops/helm/values-eks.yaml --strict
helm template freshmart-helm devops/helm -n freshmart -f devops/helm/values-minikube.yaml
helm template freshmart-eks devops/helm -n freshmart -f devops/helm/values-eks.yaml

.\devops\helm\Install-MinikubeHelm.ps1
```

The helper installs/upgrades release `freshmart-helm` into namespace `freshmart`,
using `values-minikube.yaml`. It checks `main`, Helm 4 and existing dependencies,
waits for rollout and enables automatic rollback on failure. It does not rebuild
images, overwrite secrets or re-provision users. If Task 13 is absent on a new
machine, follow [its setup guide](../kubernetes/README.md) once; its branch checks
now reflect `main`. Never use Helm's ownership override to adopt Task 13 resources.

In another terminal:

```powershell
.\devops\helm\Open-FreshMartHelm.ps1
```

Open **http://localhost:3001**. The original Task 13 frontend remains independently
available on port 3000 when its forwarding helper is running. Both releases use
the **same accounts and database**; they are not separate stores. Use the existing
Admin/Cashier passwords in `devops/kubernetes/.local/.env`. Cookies are scoped to
localhost rather than ports, so signing out of one can affect the other session.

Helm resources are named `freshmart-helm-frontend`, `freshmart-helm-backend`,
`freshmart-helm-config` and `freshmart-helm-nginx`. Their release/component selectors
cannot match Task 13's `app: frontend/backend` selectors. The existing `postgres`
Service and `freshmart-secrets` Secret are referenced; their ownership is unchanged.
Only `DB_PASSWORD` and `JWT_SECRET` keys enter backend Pods; bootstrap passwords
are not mounted. The frontend receives no credential Secret.

## Install, upgrade and rollback commands

Equivalent manual install (do not use this if the release is already installed):

```powershell
helm install freshmart-helm devops/helm --kube-context freshmart -n freshmart -f devops/helm/values-minikube.yaml --wait --rollback-on-failure --timeout 10m
```

Record the current revision, then perform a reversible scaling/configuration upgrade:

```powershell
helm history freshmart-helm --kube-context freshmart -n freshmart
$previousRevision = (helm status freshmart-helm --kube-context freshmart -n freshmart -o json | ConvertFrom-Json).version
helm upgrade freshmart-helm devops/helm --kube-context freshmart -n freshmart -f devops/helm/values-minikube.yaml --set backend.replicaCount=2,frontend.replicaCount=2 --wait --rollback-on-failure --timeout 10m
kubectl --context=freshmart -n freshmart get pods -l app.kubernetes.io/instance=freshmart-helm

# Restore the revision recorded BEFORE the upgrade, not a guessed revision number.
helm rollback freshmart-helm $previousRevision --kube-context freshmart -n freshmart --wait --timeout 10m
helm history freshmart-helm --kube-context freshmart -n freshmart
```

These are Helm 4 commands (`--rollback-on-failure`, not the Helm 3 `--atomic` flag).
Use explicit values files each upgrade. Persist intentional settings in an ignored
`values-minikube.local.yaml` and pass it after the committed profile. Changing image
tags/digests or probe settings changes Pod templates; ConfigMap content checksums
trigger rolling replacement. Existing Secret/CA changes are external to Helm:
restart the backend explicitly after an approved rotation and verify login/TLS.

The database is never rolled back. Helm rollback cannot undo Flyway migrations or
sales. Back up the database before future schema-changing application upgrades and
verify compatibility with the previous image. Task 14 uses the existing schema/images.

The local forward is tied to a frontend Pod. Its helper reconnects after replacement;
brief browser disconnections are expected. A Ready deployment can still have retiring
Pods, so wait for the forward to recover before testing. Rolling restarts are not a
guarantee of uninterrupted port-forward access. Scaling is manual, without HPA.

To stop safely, Ctrl+C in the forwarding terminal, then `minikube stop -p freshmart`.
Do not delete the namespace/PVC to stop it. Optional `helm uninstall freshmart-helm
--kube-context freshmart -n freshmart` removes only this chart's app resources;
PostgreSQL, its PVC, its Secret and Task 13 resources are external and remain.

## Configuration and files

| File | Purpose |
| --- | --- |
| `Chart.yaml`, `.helmignore` | Chart identity/version and package exclusions |
| `values.yaml`, `values.schema.json` | Typed configuration, default local settings, typo/input rejection |
| `values-minikube.yaml` | Existing local DB/Secret, existing images, HTTP port 3001 |
| `values-eks.yaml` | Offline placeholders for private RDS, registry images and HTTPS ALB |
| `templates/deployments.yaml` | Two hardened Deployments, configurable replicas/resources/probes, DB/DNS startup waits |
| `templates/services.yaml` | Two internal ClusterIP Services |
| `templates/configmap.yaml`, `templates/nginx-configmap.yaml` | Spring environment and same-origin Nginx API proxy |
| `templates/ingress.yaml`, `templates/pdb.yaml` | Optional ALB HTTPS Ingress and Pod disruption budgets |
| `templates/validate.yaml`, `templates/_helpers.tpl`, `templates/NOTES.txt` | Cross-field validation, naming, post-install notes |
| `Install-MinikubeHelm.ps1`, `Open-FreshMartHelm.ps1` | Guarded install and reconnecting browser access |
| `test-chart.py`, `requirements-test.txt`, `test-minikube.py` | Chart contracts and live upgrade/data checks |
| `EKS-PREPARATION.md`, `TEST-RESULTS.md` | AWS prerequisites and actual validation evidence |

Use image `digest: sha256:...` for immutable production pins; digest takes precedence
over tag. `imagePullSecrets` accepts only references to existing registry Secrets.
All app containers run non-root, drop capabilities, disable privilege escalation,
use read-only root filesystems and have no service-account token mount. Startup,
readiness and liveness probes use the existing `/health` or `/api/auth/csrf` endpoints.
The backend probe tests HTTP availability, not ongoing DB connectivity.

The chart always disables automatic user bootstrap. Local users already exist.
For a new RDS database, account provisioning is a separate prerequisite described
in [EKS-PREPARATION.md](EKS-PREPARATION.md).

## Tests

```powershell
python -m pip install -r devops/helm/requirements-test.txt
python devops/helm/test-chart.py

# Keep the Helm browser forward running. This creates NEW test fixtures.
python devops/helm/test-minikube.py
```

Offline tests render both profiles, check isolation/security/TLS/ALB/checksums and
reject invalid values. The live test refuses non-main/non-Minikube/non-test databases,
hashes existing sales/items/products/categories/inventory rows, creates two sales,
checks roles/CSRF/stock/totals/idempotency, upgrades both app tiers to two replicas
with changed probes, and rolls back to the captured revision. It compares original
rows and verifies the original PVC and Task 13 Deployments after rollback. Avoid
concurrent data editing while it runs. It does not restart/delete the shared database.

Local test metadata, credentials and screenshots are ignored under `.local/` with
restricted Windows permissions. Never pass passwords through Helm values or `--set`:
Helm saves release values/manifests in its history. This chart only accepts credential
references and rejects unknown fields such as `credentials.password`.

See [TEST-RESULTS.md](TEST-RESULTS.md) for the final observed results. EKS values are
prepared and rendered locally, **not deployed or verified against AWS**.
