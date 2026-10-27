$ErrorActionPreference = 'Stop'
$backendPath = Split-Path $PSScriptRoot -Parent
$settings = ConvertFrom-StringData (Get-Content -LiteralPath (Join-Path $backendPath '.env') -Raw)
function Setting($name, $fallback) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) { return $value }
    if ($settings[$name]) { return $settings[$name] }
    return $fallback
}
$dbHost = Setting 'DB_HOST' 'localhost'
$dbPort = Setting 'DB_PORT' '5432'
$dbName = Setting 'DB_NAME' 'freshmart_pos'
$dbUser = Setting 'DB_USERNAME' 'freshmart'
$schemaName = 'people_test_' + [Guid]::NewGuid().ToString('N')
$previousPassword = $env:PGPASSWORD
$previousUrl = $env:PEOPLE_TEST_DB_URL
$previousUser = $env:PEOPLE_TEST_DB_USERNAME
$previousTestPassword = $env:PEOPLE_TEST_DB_PASSWORD
$env:PGPASSWORD = Setting 'DB_PASSWORD' ''
$created = $false
Push-Location $backendPath
try {
    & psql -X -w -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -c "CREATE SCHEMA $schemaName" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create isolated people test schema.' }
    $created = $true
    $env:PEOPLE_TEST_DB_URL = "jdbc:postgresql://${dbHost}:${dbPort}/${dbName}?currentSchema=$schemaName"
    $env:PEOPLE_TEST_DB_USERNAME = $dbUser
    $env:PEOPLE_TEST_DB_PASSWORD = $env:PGPASSWORD
    # PowerShell 5 treats JVM stderr warnings as errors when redirected.
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd '-Dtest=PeopleIntegrationTest' test '-q' *> target/task9-postgres.log
    $testExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($testExit -ne 0) { throw 'PostgreSQL people tests failed. See backend/target/task9-postgres.log.' }
    Write-Output 'PostgreSQL people tests passed; isolated schema only.'
} finally {
    if ($created -and $schemaName -match '^people_test_[a-f0-9]{32}$') {
        $ErrorActionPreference = 'Continue'
        & psql -X -w -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -c "SET client_min_messages=warning; DROP SCHEMA $schemaName CASCADE" *> target/task9-postgres-cleanup.log
        if ($LASTEXITCODE -ne 0) { Write-Warning "Could not remove test schema $schemaName" }
    }
    $env:PGPASSWORD = $previousPassword
    $env:PEOPLE_TEST_DB_URL = $previousUrl
    $env:PEOPLE_TEST_DB_USERNAME = $previousUser
    $env:PEOPLE_TEST_DB_PASSWORD = $previousTestPassword
    Pop-Location
}
