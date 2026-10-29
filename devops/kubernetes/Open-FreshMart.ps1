[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Write-Output 'Open http://localhost:3000. Keep this terminal open; Ctrl+C stops forwarding.'
# A port-forward is tied to one selected Pod. Reconnect after a rollout/self-heal.
while ($true) {
    & kubectl --context=freshmart -n freshmart port-forward service/frontend 3000:8080 --address=127.0.0.1
    Write-Warning 'Forward ended. Retrying in two seconds (Ctrl+C to stop).'
    Start-Sleep -Seconds 2
}
