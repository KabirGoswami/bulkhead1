#requires -Version 7.4
# Run against a disposable Compose test household, with an authenticated session
# already established. This verifies process/container restarts separately from unit tests.
param([Parameter(Mandatory)][string]$HouseholdId, [Parameter(Mandatory)][string]$SessionCookie)
$ErrorActionPreference='Stop'
$session=[Microsoft.PowerShell.Commands.WebRequestSession]::new()
$session.Cookies.Add([System.Net.Cookie]::new('bulkhead_session',$SessionCookie,'/','localhost'))
function Read-State { Invoke-RestMethod "http://localhost:8080/api/v1/households/$HouseholdId/state" -WebSession $session }
$before=Read-State
docker compose restart worker
if ($LASTEXITCODE -ne 0) { throw 'Worker restart failed' }
$deadline=(Get-Date).AddSeconds(45)
do { Start-Sleep -Seconds 2; $after=Read-State } while ($after.tick -le $before.tick -and (Get-Date) -lt $deadline)
if ($after.tick -le $before.tick) { throw 'Simulation did not recover after worker restart' }
$beforeDatabase=Read-State
docker compose restart db
if ($LASTEXITCODE -ne 0) { throw 'Database restart failed' }
$deadline=(Get-Date).AddSeconds(45)
do {
    Start-Sleep -Seconds 2
    try { $after=Read-State; if ($after.tick -gt $beforeDatabase.tick) { break } } catch { if ((Get-Date) -ge $deadline) { throw } }
} while ((Get-Date) -lt $deadline)
if ($after.tick -le $beforeDatabase.tick) { throw 'Simulation did not recover after database restart' }
if ($after.household_id -ne $before.household_id -or $after.devices.Count -ne $before.devices.Count) { throw 'Persistent household records were not retained' }
Write-Output 'PASS: worker and database restart recovery; verify WebSocket reconnect/replay in the open browser.'
