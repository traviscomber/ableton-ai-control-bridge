param(
    [string]$BridgeBase = "http://127.0.0.1:8765",
    [string]$OutputPath = ".\titan-processing-audit.json"
)

$ErrorActionPreference = "Stop"
$TargetDevices = @(
    "EQ Eight",
    "Compressor",
    "Glue Compressor",
    "Saturator",
    "Limiter",
    "Auto Filter",
    "Echo",
    "Hybrid Reverb",
    "Drum Buss"
)

function Invoke-TitanRead {
    param(
        [hashtable]$Payload,
        [int]$TimeoutSec = 60,
        [int]$Attempts = 4
    )

    $lastError = $null
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
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
                if ($status -in @("error", "rejected")) { throw $state.command.error }
            }
            throw "TIMEOUT waiting for $($Payload.type)"
        }
        catch {
            $lastError = $_
            if ($attempt -ge $Attempts) { break }
            $delay = 750 * $attempt
            Write-Host "READ RETRY $attempt/$Attempts $($Payload.type) after ${delay}ms" -ForegroundColor DarkYellow
            Start-Sleep -Milliseconds $delay
        }
    }

    throw $lastError
}

function Read-DeviceParameters {
    param(
        [int]$Track,
        [int]$DeviceIndex,
        [int]$ParameterCount
    )

    $parameters = @()
    $start = 0
    $pageSize = 6

    while ($start -lt $ParameterCount) {
        $page = Invoke-TitanRead @{
            type = "inspect_device_parameters_page"
            target_kind = "track"
            track = $Track
            device_index = $DeviceIndex
            start = $start
            limit = $pageSize
        }
        $parameters += @($page.parameters)
        if ($null -eq $page.next_start) { break }
        $start = [int]$page.next_start
        Start-Sleep -Milliseconds 140
    }

    return $parameters
}

$health = Invoke-RestMethod "$BridgeBase/health" -TimeoutSec 10
if (-not $health.ok) { throw "Bridge health failed" }
if (-not $health.max_receiver_seen) { throw "Max receiver ACK not seen" }

$tracksResult = Invoke-TitanRead @{ type = "list_tracks" }
$tracks = @($tracksResult.tracks)
$report = [ordered]@{
    generated_at = (Get-Date).ToString("o")
    bridge_version = $health.version
    track_count = $tracks.Count
    tracks = @()
}

foreach ($track in $tracks) {
    $trackIndex = [int]$track.index
    Write-Host "TRACK $trackIndex $($track.name)" -ForegroundColor Cyan
    $chain = Invoke-TitanRead @{
        type = "inspect_device_chain"
        target_kind = "track"
        track = $trackIndex
    }

    $trackReport = [ordered]@{
        index = $trackIndex
        name = $track.name
        devices = @()
    }

    foreach ($device in @($chain.devices)) {
        if ($TargetDevices -notcontains [string]$device.name) { continue }
        Write-Host "  DEVICE $($device.index) $($device.name) params=$($device.parameter_count)"
        $parameters = Read-DeviceParameters -Track $trackIndex -DeviceIndex ([int]$device.index) -ParameterCount ([int]$device.parameter_count)
        $trackReport.devices += [ordered]@{
            device_index = [int]$device.index
            name = [string]$device.name
            class_name = [string]$device.class_name
            duplicate_name = [bool]$device.duplicate_name
            parameter_count = [int]$device.parameter_count
            parameters = @($parameters)
        }
    }

    $report.tracks += $trackReport
}

$report | ConvertTo-Json -Depth 20 | Set-Content $OutputPath -Encoding UTF8
Write-Host ""
Write-Host "=== TITAN PROCESSING AUDIT COMPLETE ===" -ForegroundColor Green
Write-Host "Output: $OutputPath"
Write-Host "Read-only: no Ableton parameters were changed."
