param(
    [string]$Path = (Join-Path $PSScriptRoot '../../.env'),
    [ValidateRange(1024, 65535)][int]$Port = 3000,
    [ValidatePattern('^[a-z][a-z0-9_]*$')][string]$DatabaseName = 'freshmart_pos',
    [ValidatePattern('^[a-z][a-z0-9_-]*$')][string]$ProjectName = 'freshmart'
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $Path) { throw 'Environment file already exists; it will not be overwritten.' }
function New-Secret {
    $bytes = New-Object byte[] 48
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    [Convert]::ToBase64String($bytes)
}
$template = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../.env.example') -Raw
$template = $template.Replace('COMPOSE_PROJECT_NAME=freshmart', "COMPOSE_PROJECT_NAME=$ProjectName")
$template = $template.Replace('DB_NAME=freshmart_pos', "DB_NAME=$DatabaseName")
$template = $template.Replace('FRONTEND_PORT=3000', "FRONTEND_PORT=$Port")
$template = $template.Replace('http://localhost:3000', "http://localhost:$Port")
foreach ($key in @('DB_PASSWORD', 'JWT_SECRET', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_CASHIER_PASSWORD')) {
    $template = $template.Replace("$key=", "$key=$(New-Secret)")
}
[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($Path), $template, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Created $Path with random secrets. Read the initial account passwords privately from that file."
