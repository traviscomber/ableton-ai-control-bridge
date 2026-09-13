param(
    [string]$BridgeBase = "http://127.0.0.1:8765",
    [string]$OutputPath = ".\titan-processing-audit-v2.json"
)

$ErrorActionPreference = "Stop"
$TargetDevices = @(
    "EQ Eight", "Compressor", "Glue Compressor", "Saturator", "Limiter",
    "Auto Filter", "Echo", "Hybrid Reverb", "Drum Buss", "Utility"
)

function Invoke-TitanRead {
    param([hashtable]$Payload,[int]$TimeoutSec=60,[int]$Attempts=4)
    $lastError = $null
    for ($attempt=1; $attempt -le $Attempts; $attempt++) {
        try {
            $body = $Payload | ConvertTo-Json -Depth 12 -Compress
            $submitted = Invoke-RestMethod "$BridgeBase/command" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 15
            $id = $submitted.command.id
            if (-not $id) { throw "Bridge returned no command id for $($Payload.type)" }
            $deadline = (Get-Date).AddSeconds($TimeoutSec)
            while ((Get-Date) -lt $deadline) {
                Start-Sleep -Milliseconds 220
                $state = Invoke-RestMethod "$BridgeBase/api/commands/$id" -TimeoutSec 15
                $status = $state.command.status
                if ($status -eq "acknowledged") { return $state.command.result }
                if ($status -in @("error","rejected")) { throw $state.command.error }
            }
            throw "TIMEOUT waiting for $($Payload.type)"
        } catch {
            $lastError = $_
            if ($attempt -ge $Attempts) { break }
            Start-Sleep -Milliseconds (750*$attempt)
        }
    }
    throw $lastError
}

function Read-DeviceParameters {
    param([string]$TargetKind,[int]$DeviceIndex,[int]$ParameterCount,[Nullable[int]]$Track,[Nullable[int]]$Return)
    $parameters = @(); $start = 0; $pageSize = 6
    while ($start -lt $ParameterCount) {
        $payload = @{ type="inspect_device_parameters_page"; target_kind=$TargetKind; device_index=$DeviceIndex; start=$start; limit=$pageSize }
        if ($TargetKind -eq "track") { $payload.track = [int]$Track }
        elseif ($TargetKind -eq "return") { $payload.return = [int]$Return }
        $page = Invoke-TitanRead $payload
        $parameters += @($page.parameters)
        if ($null -eq $page.next_start) { break }
        $start = [int]$page.next_start
        Start-Sleep -Milliseconds 140
    }
    return $parameters
}

function Audit-Target {
    param([string]$Kind,[string]$Name,[Nullable[int]]$Index)
    $chainPayload = @{ type="inspect_device_chain"; target_kind=$Kind }
    if ($Kind -eq "track") { $chainPayload.track = [int]$Index }
    elseif ($Kind -eq "return") { $chainPayload.return = [int]$Index }
    $chain = Invoke-TitanRead $chainPayload

    $devices = @()
    foreach ($device in @($chain.devices)) {
        if ($TargetDevices -notcontains [string]$device.name) { continue }
        Write-Host "$Kind $Name :: device $($device.index) $($device.name)" -ForegroundColor Cyan
        $parameters = Read-DeviceParameters -TargetKind $Kind -DeviceIndex ([int]$device.index) -ParameterCount ([int]$device.parameter_count) -Track $(if($Kind -eq 'track'){$Index}else{$null}) -Return $(if($Kind -eq 'return'){$Index}else{$null})
        $devices += [ordered]@{
            device_index=[int]$device.index
            name=[string]$device.name
            class_name=[string]$device.class_name
            duplicate_name=[bool]$device.duplicate_name
            parameter_count=[int]$device.parameter_count
            parameters=@($parameters)
        }
    }
    return [ordered]@{ target_kind=$Kind; index=$Index; name=$Name; devices=$devices }
}

$health = Invoke-RestMethod "$BridgeBase/health" -TimeoutSec 10
if (-not $health.ok) { throw "Bridge health failed" }
if (-not $health.max_receiver_seen) { throw "Max receiver ACK not seen" }

$report = [ordered]@{
    generated_at=(Get-Date).ToString("o")
    bridge_version=$health.version
    tracks=@()
    returns=@()
    master=$null
}

$tracks = @( (Invoke-TitanRead @{type="list_tracks"}).tracks )
foreach ($track in $tracks) { $report.tracks += Audit-Target -Kind "track" -Name ([string]$track.name) -Index ([int]$track.index) }

$returns = @( (Invoke-TitanRead @{type="list_returns"}).returns )
foreach ($return in $returns) { $report.returns += Audit-Target -Kind "return" -Name ([string]$return.name) -Index ([int]$return.index) }

$report.master = Audit-Target -Kind "master" -Name "MASTER" -Index $null
$report | ConvertTo-Json -Depth 24 | Set-Content $OutputPath -Encoding UTF8

Write-Host ""
Write-Host "=== TITAN PROCESSING AUDIT V2 COMPLETE ===" -ForegroundColor Green
Write-Host "Output: $OutputPath"
Write-Host "Read-only: no Ableton parameters were changed."
