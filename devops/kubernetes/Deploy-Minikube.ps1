[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$BootstrapUsers
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ((git -C $repo branch --show-current) -ne 'main') { throw 'Stop: work only on main.' }
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}
$path = Join-Path $PSScriptRoot '.local/.env'
if (!(Test-Path -LiteralPath $path)) { throw 'Run Initialize-Secrets.ps1 first.' }
$values = @{}
foreach ($line in Get-Content -LiteralPath $path) {
    if ($line.Trim() -and !$line.TrimStart().StartsWith('#')) {
        $parts = $line.Split('=', 2)
        if ($parts.Count -ne 2) { throw 'Invalid local environment file.' }
        $values[$parts[0]] = $parts[1]
    }
}
$secretData = @{}
foreach ($key in @('DB_PASSWORD', 'JWT_SECRET', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_CASHIER_PASSWORD')) {
    if ([string]::IsNullOrWhiteSpace($values[$key])) { throw "Missing $key in local environment file." }
    $secretData[$key] = $values[$key]
}
if ($values.DB_NAME -ne 'freshmart_kubernetes_test' -or $values.FRONTEND_PORT -ne '3000') {
    throw 'This local deployment uses the database and origin in configmap.yaml (freshmart_kubernetes_test, localhost:3000).'
}
Invoke-Checked -Program minikube -Arguments @('start', '-p', 'freshmart', '--driver=docker', '--cpus=4', '--memory=4096', '--kubernetes-version=v1.36.1')
if (!$SkipBuild) {
    Invoke-Checked -Program docker -Arguments @('build', '-t', 'freshmart-backend:task13', (Join-Path $repo 'backend'))
    Invoke-Checked -Program docker -Arguments @('build', '-t', 'freshmart-frontend:task13', (Join-Path $repo 'frontend'))
}
foreach ($image in @('freshmart-backend:task13', 'freshmart-frontend:task13')) {
    Invoke-Checked -Program minikube -Arguments @('-p', 'freshmart', 'image', 'load', $image, '--overwrite=true')
}
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', 'apply', '-f', (Join-Path $PSScriptRoot 'namespace.yaml'))
# Supply secret values over stdin, never command arguments, output or a tracked file.
# Do not silently rotate a running database password: existing Secrets must match.
$existingText = & kubectl --context=freshmart -n freshmart get secret freshmart-secrets --ignore-not-found -o json
if ($LASTEXITCODE -ne 0) { throw 'Failed to inspect existing Secret.' }
if ($existingText) {
    $existing = ($existingText -join "`n") | ConvertFrom-Json
    foreach ($key in $secretData.Keys) {
        $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($secretData[$key]))
        if ($existing.data.$key -ne $encoded) { throw 'Existing cluster Secret differs from .local/.env. Restore the matching credentials; automatic rotation is refused.' }
    }
} else {
    @{
        apiVersion = 'v1'; kind = 'Secret'
        metadata = @{name = 'freshmart-secrets'; namespace = 'freshmart'}
        type = 'Opaque'; stringData = $secretData
    } | ConvertTo-Json -Depth 5 -Compress | & kubectl --context=freshmart create -f -
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Kubernetes Secret.' }
}
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', 'apply', '-k', $PSScriptRoot)
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'set', 'env', 'deployment/backend', 'BOOTSTRAP_USERS_ENABLED-')
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'rollout', 'status', 'deployment/postgres', '--timeout=300s')
if ($BootstrapUsers) {
    # Bootstrap only at one replica; the default config disables seeding.
    Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'scale', 'deployment/backend', '--replicas=1')
    Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'set', 'env', 'deployment/backend', 'BOOTSTRAP_USERS_ENABLED=true')
    try {
        Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'rollout', 'status', 'deployment/backend', '--timeout=600s')
    } finally {
        Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'set', 'env', 'deployment/backend', 'BOOTSTRAP_USERS_ENABLED-')
    }
}
# Restart even when the same local image tag was rebuilt/loaded. Keep bootstrap off.
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'rollout', 'restart', 'deployment/backend', 'deployment/frontend')
foreach ($name in @('backend', 'frontend')) {
    Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'rollout', 'status', "deployment/$name", '--timeout=600s')
}
Write-Output 'Deployment ready. Run Open-FreshMart.ps1 in a separate terminal and browse http://localhost:3000.'
