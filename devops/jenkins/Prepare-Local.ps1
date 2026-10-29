$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
    if ((git branch --show-current).Trim() -ne 'main') { throw 'Stop: this setup requires the main branch.' }
    $local = Join-Path $PSScriptRoot '.local'
    $source = Join-Path $local 'source'
    New-Item -ItemType Directory -Force $source | Out-Null
    $password = Join-Path $local 'admin-password.txt'
    if (!(Test-Path -LiteralPath $password)) {
        $bytes = New-Object byte[] 36
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        [IO.File]::WriteAllText($password, [Convert]::ToBase64String($bytes))
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        icacls $password /inheritance:r /grant:r "${identity}:(F)" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Failed to restrict password file permissions.' }
    }
    # A tracked archive cannot include ignored .env/.local data. Overlay only Task 15 files.
    git archive --format=tar --output="$source/base.tar" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'git archive failed.' }
    python "$PSScriptRoot/prepare_snapshot.py" $repo $source
    if ($LASTEXITCODE -ne 0) { throw 'Snapshot preparation failed.' }
    Write-Host 'Prepared trusted local snapshot. Credentials stay in ignored devops/jenkins/.local/admin-password.txt.'
} finally { Pop-Location }
