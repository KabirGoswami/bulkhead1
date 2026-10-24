#requires -Version 7.4
[CmdletBinding()]
param([ValidateSet('baseline','quarantined','restored')][string]$Expected='baseline', [string]$Config="$PSScriptRoot/../.lab/agent.json")
$ErrorActionPreference='Stop'
$c=Get-Content $Config | ConvertFrom-Json
$result=& ssh.exe -T -p 2223 -i $c.probe_key -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$($c.known_hosts)" root@127.0.0.1 fixture
if ($LASTEXITCODE -ne 0) { throw 'Pinned probe connection failed' }
$packet=$result | ConvertFrom-Json
if (-not $packet.work_reaches_iot) { throw 'Unaffected work endpoint cannot reach the IoT fixture' }
$shouldReach=$Expected -ne 'quarantined'
if ($packet.plug_reaches_iot -ne $shouldReach) { throw "Unexpected plug reachability for $Expected" }
Write-Output "PASS: $Expected fixture; plug=$($packet.plug_reaches_iot), work=$($packet.work_reaches_iot)"
