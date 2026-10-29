# AWS EKS preparation — no AWS deployment performed

Task 14 prepares chart configuration against the existing Task 12 infrastructure
design. It creates no AWS resources and does not run Terraform apply. The checked-in
`values-eks.yaml` intentionally contains invalid/nonexistent account, domain, image
and RDS placeholders; do not install it into EKS as-is.

## Terraform-to-Helm mapping

After a separately authorized infrastructure deployment, use its reviewed outputs:

| Task 12 output/design | Helm/platform setting |
| --- | --- |
| `database.address` | `database.host` (actual RDS DNS endpoint, not a custom alias/IP) |
| `database.port`, `database.db_name` | `database.port`, `database.name` |
| `database.master_secret_arn` | Provisioning reference only; never read the master password into Helm values |
| `eks.cluster_name`, `aws_region`, `network.vpc_id` | AWS Load Balancer Controller `clusterName`, `region`, `vpcId` |
| `eks.oidc_provider_arn` | Trust for a dedicated controller IRSA role, not the node/CNI role |
| `eks.alb_security_group_id` | `ingress.securityGroupId` |
| `network.public_subnet_ids` | `ingress.subnetIds` for `internet-facing` ALB (two AZs) |
| `network.private_subnet_ids` | Worker placement; use these ALB subnets if explicitly choosing `scheme: internal` |
| `eks.node_security_group_id`, `database.security_group_id` | Existing worker -> RDS TCP 5432 rule; keep RDS private |
| Private EKS API default | Approved VPC-connected workstation/runner, network route and explicit EKS access entry |

Terraform's ALB security group allows **443 only**, is closed by default until
`alb_ingress_cidrs` is configured, and permits egress to worker/pod port **8080**.
The chart uses an HTTPS-only ALB listener with IP targets to the frontend's 8080
port. No HTTP 80 listener, redirect, NodePort, direct backend ALB target or public
database exposure is introduced. It explicitly references the Terraform-managed
SG and disables controller management of backend SG rules to avoid overlapping
ownership. This assumes ordinary VPC CNI Pod addresses using the node SG; custom
Security Groups for Pods would need their own reviewed network rules.

Task 12 already permits control-plane webhook traffic on TCP 9443. It does **not**
install the Load Balancer Controller or create its IAM role/policy. Its OIDC provider
and CNI role do not grant the controller AWS access.

## Requirements before a future authorized EKS install

1. Provisioned infrastructure, correct AWS account/region, verified cluster version,
   capacity/quotas, explicit Kubernetes RBAC/EKS access and connectivity to the
   private API. No credentials are included in this repository.
2. AWS Load Balancer Controller installed at a reviewed version compatible with
   the cluster, including CRDs, `alb` IngressClass, webhook and least-privilege IAM
   bound to its own service account. Follow the [official AWS installation guide](https://docs.aws.amazon.com/eks/latest/userguide/lbc-helm.html).
   Supply `clusterName`, `region` and `vpcId` explicitly: Task 12 sets IMDSv2 hop
   limit 1, so the controller should not rely on node metadata discovery. Application
   Pods have no AWS permissions or service-account token mount.
3. A validated ACM certificate **in the ALB's region** covering the hostname,
   approved HTTPS ingress CIDRs in the Terraform ALB SG, two suitable subnets and
   DNS pointing the hostname to the resulting ALB. ACM terminates browser TLS;
   an in-cluster TLS Secret is not used. The same host must appear in `ingress.host`
   and `app.frontendOrigin` (`https://...`), with `secureCookies: true`.
4. Published immutable application images reachable from private workers. Task 11
   CI publishes `ghcr.io/<owner>/<repository>-frontend` and `...-backend`; use the
   actual lowercase paths and tested tags/digests. Private GHCR images require an
   existing registry Secret referenced by `imagePullSecrets`. Node ECR pull rights
   do not authenticate to GHCR. Do not place registry tokens in values files.
5. An existing runtime Secret in the release namespace, named by
   `credentials.existingSecret`, containing `DB_PASSWORD` and `JWT_SECRET` (or
   explicitly mapped key names). JWT must be base64 for at least 32 random bytes.
   Provide it through an approved secret-management/operator workflow; this chart
   neither installs an operator nor grants Secrets Manager access. Protect Secret
   RBAC, cluster encryption and release-history access. Restart backend Pods after
   an approved external credential rotation; values do not contain secret data.
6. A dedicated PostgreSQL application login (example `freshmart_app`), permissions
   limited to the FreshMart database/schema, and a reviewed Flyway migration strategy.
   The unchanged backend runs Flyway on startup; with this chart the DB login must
   have the DDL permissions required by the pending migrations as well as runtime
   DML. Do not substitute the RDS master account. If operations requires separate
   migration credentials/jobs, that workflow must be prepared before deployment;
   it is not implemented here. Backups and backward-compatible migrations are
   required before future application upgrades.
7. An existing RDS CA ConfigMap (example `freshmart-rds-ca`) containing the current
   trusted regional CA bundle under `bundle.pem`. Obtain it from the
   [official RDS certificate page](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html),
   validate its source and follow AWS CA-rotation guidance. It is a public trust
   certificate, not a credential. The chart mounts it read-only and configures:

   ```text
   jdbc:postgresql://<RDS endpoint>:5432/<database>?sslmode=verify-full&sslrootcert=/etc/freshmart/rds-ca/bundle.pem
   ```

   This validates both the certificate chain and hostname using
   [pgJDBC's TLS settings](https://jdbc.postgresql.org/documentation/use/).
   Task 12's PostgreSQL parameter group requires TLS. `pg_isready` is only a startup
   availability check; actual credential and certificate validation occurs in JDBC.
8. Existing application accounts or a separately controlled first-account bootstrap.
   This chart always uses the `prod` profile with bootstrap disabled. Do not put
   bootstrap passwords in Helm values/history. Any approved initial provisioning
   must reuse the existing password-hashing logic, use externally supplied secrets,
   run once at one replica, and disable/remove provisioning access afterward.
9. A protected application namespace, monitoring, database restore testing and
   capacity planning. The profile uses two replicas, PDB minAvailable 1 and soft
   zone-spread preferences. Two replicas do not guarantee distinct AZ placement;
   verify nodes in both AZs. Task 12 defaults RDS Multi-AZ off to control cost:
   production HA requires a separate reviewed capacity/availability decision.

## Offline preparation commands

These commands render locally and do not connect to AWS or create an ALB:

```powershell
if ((git branch --show-current) -ne 'main') { throw 'Stop: work only on main.' }
helm lint devops/helm -f devops/helm/values-eks.yaml --strict
helm template freshmart-eks devops/helm -n freshmart -f devops/helm/values-eks.yaml

# Create once, then edit the copy with actual NON-SECRET identifiers/image pins.
if (!(Test-Path devops/helm/values-eks.local.yaml)) {
    Copy-Item devops/helm/values-eks.yaml devops/helm/values-eks.local.yaml
}
helm lint devops/helm -f devops/helm/values-eks.local.yaml --strict
helm template freshmart-eks devops/helm -n freshmart -f devops/helm/values-eks.local.yaml
```

No EKS install command was executed. Before a future deployment, review rendered
manifests and check all `replace-*`, `.invalid`, zero-account ARN, SG and subnet
placeholders are gone. Helm rendering proves configuration shape, not the existence
of RDS, Secrets, DNS, certificates, registry access or reachable AWS networking.

The browser uses HTTPS to ALB; ALB forwards HTTP inside the VPC to Nginx, which
preserves the HTTPS forwarded scheme and proxies `/api` on the same origin.
Secure JWT cookies, existing CSRF validation and HSTS are configured. ALB-to-pod
traffic is not TLS-encrypted by this chart; environments requiring end-to-end TLS
need an additional reviewed design. Only the trusted ALB SG should provide external
access to frontend Pods. No cross-origin API host or permissive CORS change is needed.

The ALB route, RDS TLS, controller IAM and DNS/certificate behavior are **prepared,
not live-tested**. Their real verification must happen in a later authorized AWS
deployment. ALB and associated services would incur charges then; none were created
by Task 14. See the [controller annotation reference](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/guide/ingress/annotations/)
for the ingress settings used here.
