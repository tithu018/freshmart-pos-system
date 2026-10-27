param([switch]$KeepDatabase)
$ErrorActionPreference = 'Stop'
$backendPath = Split-Path $PSScriptRoot -Parent
$pgBin = Split-Path (Get-Command psql -ErrorAction Stop).Source -Parent
$testData = Join-Path $backendPath ('target/task10-pg-' + [Guid]::NewGuid().ToString('N'))
$logPath = Join-Path $backendPath 'target/task10-postgres.log'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$testPort = $listener.LocalEndpoint.Port
$listener.Stop()
$names = @('TEST_DB_URL', 'TEST_DB_USERNAME', 'TEST_DB_PASSWORD', 'ANALYTICS_TEST_DB_URL', 'ANALYTICS_TEST_DB_USERNAME', 'ANALYTICS_TEST_DB_PASSWORD', 'PEOPLE_TEST_DB_URL', 'PEOPLE_TEST_DB_USERNAME', 'PEOPLE_TEST_DB_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name) }
$started = $false
$passed = $false
$canCleanup = $true
New-Item -ItemType Directory -Force -Path (Join-Path $backendPath 'target') | Out-Null
Push-Location $backendPath
try {
    # A new local cluster has no access to the store database. Trust applies only
    # to this short-lived loopback test server, with no production credentials.
    & (Join-Path $pgBin 'initdb.exe') -D $testData -U freshmart_test --auth=trust --encoding=UTF8 --no-locale *> target/task10-postgres-init.log
    if ($LASTEXITCODE -ne 0) { throw 'Unable to initialize isolated PostgreSQL. See target/task10-postgres-init.log.' }
    # Redirect launch handles explicitly: a server inheriting a PowerShell pipeline
    # would otherwise keep that pipeline open after pg_ctl exits on Windows.
    $serverLog = Join-Path $testData 'server.log'
    $launch = Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -ArgumentList @('-D', "`"$testData`"", '-l', "`"$serverLog`"", '-o', "`"-h 127.0.0.1 -p $testPort`"", '-w', 'start') -WindowStyle Hidden -PassThru -RedirectStandardOutput target/task10-pg-start.log -RedirectStandardError target/task10-pg-start-error.log
    $null = $launch.Handle
    if (-not $launch.WaitForExit(60000)) {
        $canCleanup = $false
        throw 'Timed out starting isolated PostgreSQL; data retained.'
    }
    & (Join-Path $pgBin 'pg_ctl.exe') -D $testData status | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to start isolated PostgreSQL.' }
    $started = $true
    foreach ($database in @('freshmart_test', 'analytics_test', 'people_test')) {
        & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $testPort -U freshmart_test $database
        if ($LASTEXITCODE -ne 0) { throw 'Unable to create isolated test database.' }
    }
    foreach ($prefix in @('TEST', 'ANALYTICS_TEST', 'PEOPLE_TEST')) {
        $database = switch ($prefix) { 'TEST' { 'freshmart_test' } 'ANALYTICS_TEST' { 'analytics_test' } 'PEOPLE_TEST' { 'people_test' } }
        [Environment]::SetEnvironmentVariable("${prefix}_DB_URL", "jdbc:postgresql://127.0.0.1:${testPort}/$database")
        [Environment]::SetEnvironmentVariable("${prefix}_DB_USERNAME", 'freshmart_test')
        [Environment]::SetEnvironmentVariable("${prefix}_DB_PASSWORD", '')
    }
    # Native JVM stderr warnings should not abort PowerShell 5 before cleanup.
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd verify -q *> $logPath
    $testExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($testExit -ne 0) { throw 'PostgreSQL verification failed. See target/task10-postgres.log.' }
    $passed = $true
    Write-Output 'All backend tests and packaging passed against isolated PostgreSQL.'
    if ($KeepDatabase) {
        @{ data = $testData; port = $testPort; bin = $pgBin } | ConvertTo-Json | Set-Content -LiteralPath target/task10-postgres.json
        Write-Output 'Temporary database retained for browser checks; connection metadata is in target/task10-postgres.json.'
    }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
    if (-not ($KeepDatabase -and $passed)) {
        if (-not $canCleanup) { throw "Test server startup state is unknown at $testData; data retained." }
        # Check actual server state even if startup failed before $started was set.
        if (Test-Path -LiteralPath (Join-Path $testData 'PG_VERSION')) {
            & (Join-Path $pgBin 'pg_ctl.exe') -D $testData status | Out-Null
            $serverStatus = $LASTEXITCODE
            if ($serverStatus -eq 0) {
                & (Join-Path $pgBin 'pg_ctl.exe') -D $testData -m fast -w stop | Out-Null
                if ($LASTEXITCODE -ne 0) { throw "Unable to stop test PostgreSQL at $testData; data retained." }
            } elseif ($serverStatus -ne 3) {
                throw "Cannot verify test server shutdown at $testData; data retained."
            }
        }
        $resolved = [IO.Path]::GetFullPath($testData)
        $targetRoot = [IO.Path]::GetFullPath((Join-Path $backendPath 'target')) + [IO.Path]::DirectorySeparatorChar
        if ($resolved.StartsWith($targetRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf) -match '^task10-pg-[a-f0-9]{32}$') {
            if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
        } else { throw 'Unexpected test cluster path; cleanup stopped.' }
    }
    Pop-Location
}
