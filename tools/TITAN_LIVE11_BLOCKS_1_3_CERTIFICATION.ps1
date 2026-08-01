[CmdletBinding()]
param(
    [string]$TrackRef = "kick",
    [string]$Device = "Operator",
    [double]$MasterVolume = 0.85,
    [int]$TimeoutSeconds = 15,
    [string]$OutputPath = "TITAN_BLOCKS_1_3_ACK_REPORT.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$configPath = Join-Path $env:LOCALAPPDATA "Ableton AI Control Bridge\config.json"
if (-not (Test-Path $configPath)) { throw "Bridge configuration not found: $configPath" }
$config = Get-Content -Raw -Encoding UTF8 $configPath | ConvertFrom-Json
$bridgeUrl = "http://$($config.host):$($config.port)"
$headers = @{ "X-Bridge-Token" = [string]$config.token; "Content-Type" = "application/json" }
$results = New-Object System.Collections.Generic.List[object]

function Get-Bridge([string]$Path) {
    Invoke-RestMethod -Method Get -Uri ($bridgeUrl + $Path) -Headers $headers -TimeoutSec $TimeoutSeconds
}

function Invoke-AckCommand([string]$Name, [hashtable]$Command) {
    Write-Host ("-> " + $Name + " | " + ($Command | ConvertTo-Json -Compress -Depth 20)) -ForegroundColor Cyan
    $submission = Invoke-RestMethod -Method Post -Uri ($bridgeUrl + "/command") -Headers $headers -Body ($Command | ConvertTo-Json -Compress -Depth 20) -TimeoutSec $TimeoutSeconds
    $id = [string]$submission.command.id
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        Start-Sleep -Milliseconds 250
        $record = (Get-Bridge ("/api/commands/" + $id)).command
        if ($record.status -in @("acknowledged","error","rejected","simulated")) { break }
    } while ((Get-Date) -lt $deadline)
    if ($record.status -notin @("acknowledged","simulated")) { throw ("ACK failed for " + $Name + ": " + [string]$record.error) }
    $results.Add([pscustomobject][ordered]@{ name=$Name; type=$Command.type; status=$record.status; id=$id; result=$record.result; error=$record.error })
    Write-Host ("ACK: " + $Name) -ForegroundColor Green
    return $record
}

$started = (Get-Date).ToUniversalTime().ToString("o")
$snapshotId = $null
$status = "completed"
try {
    $health = Get-Bridge "/health"
    if (-not $health.ok) { throw "Bridge health is not OK" }

    Invoke-AckCommand "inspect.live_state" @{ type="get_live_state" }
    Invoke-AckCommand "inspect.tracks" @{ type="list_tracks" }
    Invoke-AckCommand "inspect.returns" @{ type="list_returns" }
    Invoke-AckCommand "inspect.track" @{ type="inspect_track"; track_ref=$TrackRef }
    Invoke-AckCommand "inspect.device_chain" @{ type="inspect_device_chain"; target_kind="track"; track_ref=$TrackRef }
    Invoke-AckCommand "inspect.device_parameters" @{ type="inspect_device_parameters"; target_kind="track"; track_ref=$TrackRef; device=$Device }
    Invoke-AckCommand "inspect.master" @{ type="inspect_master" }

    $snapshot = Invoke-AckCommand "snapshot.capture_mixer" @{ type="capture_mixer_snapshot" }
    $snapshotId = [string]$snapshot.result.snapshot_id
    if (-not $snapshotId) { throw "Receiver did not return snapshot_id" }

    Invoke-AckCommand "master.set_volume" @{ type="set_master_volume"; volume=$MasterVolume }
    Invoke-AckCommand "snapshot.restore_mixer" @{ type="restore_mixer_snapshot"; snapshot_id=$snapshotId }
} catch {
    $status = "failed"
    $results.Add([pscustomobject][ordered]@{ name="runner"; type="runner"; status="error"; id=$null; result=$null; error=$_.Exception.Message })
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    $report = [ordered]@{
        schema = "titan-live11-blocks-1-3-v1"
        status = $status
        started_at = $started
        completed_at = (Get-Date).ToUniversalTime().ToString("o")
        bridge_url = $bridgeUrl
        track_ref = $TrackRef
        device = $Device
        mixer_snapshot_id = $snapshotId
        results = $results
        validation = [ordered]@{
            static = "not evaluated by runner"
            unit_ci = "not evaluated by runner"
            bridge_ack = "evaluated"
            runtime = "requires visual confirmation in Live"
            audible = "not evaluated"
        }
    }
    $report | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 $OutputPath
    Write-Host ("Report: " + (Resolve-Path $OutputPath)) -ForegroundColor Yellow
}

if ($status -ne "completed") { exit 1 }
