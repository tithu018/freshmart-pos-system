[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Write-Output 'Open http://localhost:3001. Keep this terminal open; Ctrl+C stops forwarding.'
while ($true) {
    & kubectl --context=freshmart -n freshmart port-forward service/freshmart-helm-frontend 3001:8080 --address=127.0.0.1
    Write-Warning 'Forward ended. Retrying in two seconds (Ctrl+C to stop).'
    Start-Sleep -Seconds 2
}
