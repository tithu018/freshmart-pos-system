$ErrorActionPreference = 'Stop'
$backendDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$environmentPath = Join-Path $backendDirectory '.env'
if (-not (Test-Path -LiteralPath $environmentPath)) {
    Copy-Item -LiteralPath (Join-Path $backendDirectory '.env.example') -Destination $environmentPath
}
$lines = [System.IO.File]::ReadAllLines($environmentPath)
if (@($lines | Where-Object { $_ -match '^JWT_SECRET=\S+' }).Count -eq 0) {
    $keyBytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($keyBytes) } finally { $generator.Dispose() }
    $lines = @($lines | Where-Object { $_ -notmatch '^JWT_SECRET=' }) + @('JWT_SECRET=' + [Convert]::ToBase64String($keyBytes))
    [System.IO.File]::WriteAllLines($environmentPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output 'Generated a local JWT signing key in backend/.env. Its value is not displayed.'
} else {
    Write-Output 'Kept the existing JWT signing key.'
}
Write-Output 'Set DB_PASSWORD in backend/.env to match your PostgreSQL application role before starting the backend.'
