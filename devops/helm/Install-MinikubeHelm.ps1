[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ((git -C $repo branch --show-current) -ne 'main') { throw 'Stop: work only on main.' }
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}
$version = & helm version --short
if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v4\.') { throw 'Install Helm 4 before running this script.' }
Invoke-Checked -Program minikube -Arguments @('status', '-p', 'freshmart')
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'get', 'secret', 'freshmart-secrets')
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'get', 'service', 'postgres')
Invoke-Checked -Program kubectl -Arguments @('--context=freshmart', '-n', 'freshmart', 'rollout', 'status', 'deployment/postgres', '--timeout=300s')
$local = Join-Path $PSScriptRoot '.local'
New-Item -ItemType Directory -Force -Path $local | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $local /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict local test artifacts.' }
Invoke-Checked -Program helm -Arguments @('lint', $PSScriptRoot, '-f', (Join-Path $PSScriptRoot 'values-minikube.yaml'), '--strict')
Invoke-Checked -Program helm -Arguments @('upgrade', '--install', 'freshmart-helm', $PSScriptRoot,
    '--kube-context', 'freshmart', '-n', 'freshmart', '-f', (Join-Path $PSScriptRoot 'values-minikube.yaml'),
    '--wait', '--rollback-on-failure', '--timeout', '10m', '--history-max', '10')
Write-Output 'Helm release ready. Existing Task 13 resources remain independently managed.'
Write-Output 'Run Open-FreshMartHelm.ps1 in another terminal, then browse http://localhost:3001.'
