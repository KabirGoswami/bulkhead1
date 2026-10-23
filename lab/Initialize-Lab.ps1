#requires -Version 7.4
[CmdletBinding()]
param(
    [Parameter(Mandatory)][guid]$DeviceId,
    [Parameter(Mandatory)][string]$RouterHostKey,
    [Parameter(Mandatory)][string]$ProbeHostKey,
    [string]$SecretDirectory = "$PSScriptRoot/../.secrets"
)
$ErrorActionPreference = 'Stop'
$SecretDirectory = [IO.Path]::GetFullPath($SecretDirectory)
New-Item -ItemType Directory -Force $SecretDirectory | Out-Null
& icacls.exe $SecretDirectory /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict local key directory' }
foreach ($key in @($RouterHostKey,$ProbeHostKey)) {
    if ($key -notmatch '^ssh-ed25519 [A-Za-z0-9+/=]+$') { throw 'Supply an ed25519 public host key copied from the VM console' }
}
$KnownHosts = Join-Path $SecretDirectory 'known_hosts'
@("[127.0.0.1]:2222 $RouterHostKey", "[127.0.0.1]:2223 $ProbeHostKey") | Set-Content -Encoding ascii $KnownHosts
function New-LabKey([string]$Name) {
    $key = Join-Path $SecretDirectory $Name
    if (-not (Test-Path $key)) {
        & ssh-keygen.exe -q -t ed25519 -N '' -C $Name -f $key
        if ($LASTEXITCODE -ne 0) { throw "Key generation failed: $Name" }
    }
    return $key
}
$RouterKey = New-LabKey 'router_agent_ed25519'
$ProbeKey = New-LabKey 'probe_agent_ed25519'
$AdminKey = Join-Path $SecretDirectory 'lab_admin_ed25519'
if (-not (Test-Path $AdminKey)) { throw 'Generate and install the separate lab_admin_ed25519 key through each VM console first' }
$SshOptions = @('-i',$AdminKey,'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',"UserKnownHostsFile=$KnownHosts")
function Send-LabText([int]$Port,[string]$Text,[string]$Command) {
    $start=[Diagnostics.ProcessStartInfo]::new('ssh.exe')
    $start.UseShellExecute=$false
    $start.RedirectStandardInput=$true
    foreach ($argument in @('-T','-p',"$Port") + $SshOptions + @('root@127.0.0.1',$Command)) { $start.ArgumentList.Add($argument) }
    $process=[Diagnostics.Process]::Start($start)
    $bytes=[Text.UTF8Encoding]::new($false).GetBytes($Text.Replace("`r`n","`n"))
    $process.StandardInput.BaseStream.Write($bytes,0,$bytes.Length)
    $process.StandardInput.Close()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "Pinned SSH provisioning failed on port $Port" }
}
function Copy-LabFile([int]$Port,[string]$Source,[string]$Target) {
    Send-LabText $Port ([IO.File]::ReadAllText($Source)) "cat > $Target"
}

& ssh.exe -p 2222 @SshOptions root@127.0.0.1 'mkdir -p /etc/bulkhead /usr/libexec'
if ($LASTEXITCODE -ne 0) { throw 'Router bootstrap is not ready' }
Copy-LabFile 2222 "$PSScriptRoot/router/bulkhead-router" '/usr/libexec/bulkhead-router'
Copy-LabFile 2222 "$PSScriptRoot/router/configure.sh" '/tmp/bulkhead-configure'
$mapping = @{device_id=$DeviceId.ToString(); ipv4='192.168.10.10'; mac='02:00:00:00:10:10'}
Send-LabText 2222 ($mapping | ConvertTo-Json -Compress) 'cat > /etc/bulkhead/mapping.json'
$pub = (Get-Content "$RouterKey.pub").Trim()
$forced = 'no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,command="/usr/libexec/bulkhead-router" ' + $pub
Send-LabText 2222 ($forced + "`n") 'cat >> /etc/dropbear/authorized_keys'
& ssh.exe -p 2222 @SshOptions root@127.0.0.1 'chmod 700 /usr/libexec/bulkhead-router; chmod 600 /etc/bulkhead/mapping.json /etc/dropbear/authorized_keys; sh /tmp/bulkhead-configure'
if ($LASTEXITCODE -ne 0) { throw 'Router configuration failed; inspect its console' }
& ssh.exe -p 2223 @SshOptions root@127.0.0.1 'mkdir -p /usr/local/libexec'
Copy-LabFile 2223 "$PSScriptRoot/probe/configure.sh" '/tmp/bulkhead-probe-configure'
Copy-LabFile 2223 "$PSScriptRoot/probe/bulkhead-probe" '/usr/local/libexec/bulkhead-probe'
$pub = (Get-Content "$ProbeKey.pub").Trim()
$forced = 'restrict,command="/usr/local/libexec/bulkhead-probe" ' + $pub
Send-LabText 2223 ($forced + "`n") 'cat >> /root/.ssh/authorized_keys'
& ssh.exe -p 2223 @SshOptions root@127.0.0.1 'chmod 700 /usr/local/libexec/bulkhead-probe; chmod 600 /root/.ssh/authorized_keys; sh /tmp/bulkhead-probe-configure'
if ($LASTEXITCODE -ne 0) { throw 'Probe configuration failed; inspect its console' }
$config = @{ app_origin='http://localhost:8080'; adapter_enabled=$false; dry_run=$true; known_hosts=$KnownHosts; router_key=$RouterKey; probe_key=$ProbeKey; journal="$PSScriptRoot/../.lab/agent-journal.json"; mapping=$mapping }
$config | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8NoBOM "$PSScriptRoot/../.lab/agent.json"
Write-Output 'Fixture configured. Keep adapter disabled and dry-run enabled until Test-Lab.ps1 passes baseline checks.'
