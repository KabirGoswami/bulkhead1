#requires -Version 7.4
[CmdletBinding()]
param([string]$LabDirectory = "$PSScriptRoot/../.lab")
$ErrorActionPreference = 'Stop'
if (-not $IsWindows -or $env:PROCESSOR_ARCHITECTURE -notin @('AMD64','x86')) { throw 'Windows Intel/AMD host required' }
$VBox = (Get-Command VBoxManage.exe -ErrorAction Stop).Source
function Invoke-VBox {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & $VBox @Arguments
    if ($LASTEXITCODE -ne 0) { throw "VBoxManage failed: $($Arguments[0])" }
}
$LabDirectory = [IO.Path]::GetFullPath($LabDirectory)
New-Item -ItemType Directory -Force $LabDirectory | Out-Null
$manifest = Get-Content "$PSScriptRoot/images.json" | ConvertFrom-Json
foreach ($image in @($manifest.openwrt, $manifest.debian)) {
    $target = Join-Path $LabDirectory $image.filename
    if (-not (Test-Path $target)) { Invoke-WebRequest $image.url -OutFile $target }
    $actual = (Get-FileHash $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $image.sha256) { throw "Pinned integrity check failed for $($image.filename)" }
    $sumFile = "$target.SHA256SUMS"
    Invoke-WebRequest $image.checksums -OutFile $sumFile
    $published = Get-Content $sumFile | Where-Object { $_ -match ([regex]::Escape($image.filename) + '$') }
    if (-not $published -or ($published -split '\s+')[0] -ne $image.sha256) { throw 'Published integrity information differs from the pin' }
    Invoke-WebRequest $image.signature -OutFile "$sumFile.signature"
}
foreach ($name in @('Bulkhead-OpenWrt','Bulkhead-Probe')) {
    & $VBox showvminfo $name 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { throw "$name already exists; inspect it before creating a new fixture" }
}
$compressed = [IO.File]::OpenRead((Join-Path $LabDirectory $manifest.openwrt.filename))
$gzip = [IO.Compression.GZipStream]::new($compressed, [IO.Compression.CompressionMode]::Decompress)
$raw = Join-Path $LabDirectory 'openwrt.img'
$output = [IO.File]::Create($raw)
try { $gzip.CopyTo($output) } finally { $output.Dispose(); $gzip.Dispose(); $compressed.Dispose() }
$routerDisk = Join-Path $LabDirectory 'router.vdi'
Invoke-VBox @('convertfromraw', $raw, $routerDisk, '--format', 'VDI')
Invoke-VBox @('createvm','--name','Bulkhead-OpenWrt','--ostype','Linux_64','--register','--basefolder',$LabDirectory)
Invoke-VBox @('createvm','--name','Bulkhead-Probe','--ostype','Debian_64','--register','--basefolder',$LabDirectory)
foreach ($name in @('Bulkhead-OpenWrt','Bulkhead-Probe')) {
    Invoke-VBox @('modifyvm',$name,'--memory','1024','--cpus','1','--nic1','nat','--nictype1','82540EM','--cableconnected1','on','--clipboard-mode','disabled','--drag-and-drop','disabled')
    $port = if ($name -eq 'Bulkhead-OpenWrt') { '2222' } else { '2223' }
    Invoke-VBox @('modifyvm',$name,'--natpf1',"ssh,tcp,127.0.0.1,$port,,22")
    $number = 2
    foreach ($pair in @('main:10','iot:20','work:30','guest:40')) {
        $zone,$subnet=$pair.Split(':')
        $last=if ($name -eq 'Bulkhead-Probe') { '10' } else { '01' }
        $mac="02000000${subnet}${last}"
        Invoke-VBox @('modifyvm',$name,"--nic$number",'intnet',"--intnet$number","bulkhead-$zone","--nictype$number",'82540EM',"--cableconnected$number",'on',"--nicpromisc$number",'deny',"--macaddress$number",$mac)
        $number++
    }
    Invoke-VBox @('storagectl',$name,'--name','SATA','--add','sata','--controller','IntelAhci')
}
Invoke-VBox @('storageattach','Bulkhead-OpenWrt','--storagectl','SATA','--port','0','--device','0','--type','hdd','--medium',$routerDisk)
$probeDisk = Join-Path $LabDirectory 'probe.vdi'
Invoke-VBox @('createmedium','disk','--filename',$probeDisk,'--size','4096','--format','VDI')
Invoke-VBox @('storageattach','Bulkhead-Probe','--storagectl','SATA','--port','0','--device','0','--type','hdd','--medium',$probeDisk)
Invoke-VBox @('storageattach','Bulkhead-Probe','--storagectl','SATA','--port','1','--device','0','--type','dvddrive','--medium',(Join-Path $LabDirectory $manifest.debian.filename))
Invoke-VBox @('startvm','Bulkhead-OpenWrt','--type','gui')
Invoke-VBox @('startvm','Bulkhead-Probe','--type','gui')
Write-Output 'VMs created. Complete the two console bootstrap steps in README.md, pin console host keys, then run Initialize-Lab.ps1.'
