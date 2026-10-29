[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ((git -C $repo branch --show-current) -ne 'main') { throw 'Stop: work only on main.' }
$local = Join-Path $PSScriptRoot '.local'
$path = Join-Path $local '.env'
if (Test-Path -LiteralPath $path) { throw 'Local credentials already exist; they will not be replaced.' }
function New-Secret {
    $bytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    [Convert]::ToBase64String($bytes)
}
New-Item -ItemType Directory -Path $local -Force | Out-Null
# Restrict the local credential directory to the current Windows account.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $local /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict local credential directory permissions.' }
$template = Get-Content -LiteralPath (Join-Path $PSScriptRoot '.env.example') -Raw
foreach ($key in @('DB_PASSWORD', 'JWT_SECRET', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_CASHIER_PASSWORD')) {
    $template = $template.Replace("$key=", "$key=$(New-Secret)")
}
[IO.File]::WriteAllText($path, $template, (New-Object Text.UTF8Encoding($false)))
Write-Output 'Created .local/.env with random secrets and restricted Windows permissions. Keep it private.'
