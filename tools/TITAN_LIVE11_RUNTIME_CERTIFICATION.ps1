[CmdletBinding()]
param(
    [ValidateSet("safe", "mixer", "destructive")]
    [string]$Profile = "safe",
    [string]$TrackRef = "kick",
    [int]$ReturnIndex = 0,
    [double]$TrackVolume = 0.82,
    [double]$TrackPan = 0.0,
    [double]$ReturnVolume = 0.34,
    [double]$ReturnPan = 0.0,
    [int]$TimeoutSeconds = 12,
    [string]$OutputPath = "TITAN_LIVE11_CERTIFICATION_REPORT.json",
    [switch]$ConfirmDestructive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ConfigPath = Join-Path $env:LOCALAPPDATA "Ableton AI Control Bridge\config.json"
if (-not (Test-Path $ConfigPath)) {
    throw "Bridge configuration not found at: $ConfigPath"
}

$config = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
$BridgeUrl = "http://$($config.host):$($config.port)"
$Token = [string]$config.token
$Headers = @{ "X-Bridge-Token" = $Token; "Content-Type" = "application/json" }

$results = New-Object System.Collections.Generic.List[object]
$startedAt = (Get-Date).ToUniversalTime().ToString("o")

function Invoke-BridgeGet {
    param([Parameter(Mandatory)][string]$Path)
    return Invoke-RestMethod -Method Get -Uri ($BridgeUrl + $Path) -Headers $Headers -TimeoutSec $TimeoutSeconds
}

function Wait-CommandAck {
    param([Parameter(Mandatory)][string]$CommandId)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        Start-Sleep -Milliseconds 200
        $response = Invoke-BridgeGet -Path ("/api/commands/" + $CommandId)
        $record = $response.command
        if ($record.status -in @("acknowledged", "error", "rejected", "simulated")) {
            return $record
        }
    } while ((Get-Date) -lt $deadline)
    throw "Timed out waiting for Ableton ACK: $CommandId"
}

function Submit-CertificationCommand {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][hashtable]$Command,
        [bool]$Required = $true
    )

    $submittedAt = (Get-Date).ToUniversalTime().ToString("o")
    Write-Host ("-> " + $Name + " | " + ($Command | ConvertTo-Json -Compress -Depth 20)) -ForegroundColor Cyan

    try {
        $submission = Invoke-RestMethod -Method Post -Uri ($BridgeUrl + "/command") -Headers $Headers `
            -Body ($Command | ConvertTo-Json -Compress -Depth 20) -TimeoutSec $TimeoutSeconds
        $record = Wait-CommandAck -CommandId ([string]$submission.command.id)
        $passed = $record.status -eq "acknowledged"
        $entry = [ordered]@{
            name = $Name
            command_type = $Command.type
            required = $Required
            passed = $passed
            status = $record.status
            command_id = $record.id
            submitted_at = $submittedAt
            completed_at = (Get-Date).ToUniversalTime().ToString("o")
            payload = $Command
            result = $record.result
            error = $record.error
        }
        $results.Add([pscustomobject]$entry)
        if (-not $passed) {
            Write-Host ("FAILED: " + $Name + " | " + [string]$record.error) -ForegroundColor Red
            if ($Required) { throw "Certification failed: $Name" }
        } else {
            Write-Host ("ACK: " + $Name) -ForegroundColor Green
        }
        return $record
    } catch {
        $results.Add([pscustomobject][ordered]@{
            name = $Name
            command_type = $Command.type
            required = $Required
            passed = $false
            status = "submission_error"
            command_id = $null
            submitted_at = $submittedAt
            completed_at = (Get-Date).ToUniversalTime().ToString("o")
            payload = $Command
            result = $null
            error = $_.Exception.Message
        })
        if ($Required) { throw }
    }
}

function Write-Report {
    param([string]$FinalStatus)
    $health = $null
    try { $health = Invoke-BridgeGet -Path "/health" } catch {}
    $report = [ordered]@{
        schema = "titan-live11-certification-v1"
        status = $FinalStatus
        profile = $Profile
        started_at = $startedAt
        completed_at = (Get-Date).ToUniversalTime().ToString("o")
        bridge_url = $BridgeUrl
        bridge_version = if ($health) { $health.version } else { $null }
        receiver_seen = if ($health) { $health.max_receiver_seen } else { $false }
        last_ack_at = if ($health) { $health.last_ack_at } else { $null }
        track_ref = $TrackRef
        return_index = $ReturnIndex
        passed = @($results | Where-Object { $_.passed }).Count
        failed = @($results | Where-Object { -not $_.passed }).Count
        results = $results
        validation = [ordered]@{
            static = "not evaluated by this runner"
            unit_ci = "not evaluated by this runner"
            bridge_ack = "evaluated"
            runtime = "requires visual confirmation in Live"
            audible = "not evaluated"
        }
    }
    $report | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 $OutputPath
    Write-Host ("Report: " + (Resolve-Path $OutputPath)) -ForegroundColor Yellow
}

Write-Host "TITAN LIVE 11 RUNTIME CERTIFICATION V1" -ForegroundColor Green
Write-Host ("Profile=" + $Profile + " Bridge=" + $BridgeUrl) -ForegroundColor DarkGray

try {
    $health = Invoke-BridgeGet -Path "/health"
    if (-not $health.ok) { throw "Bridge health check returned not ok." }
    if (-not $health.max_receiver_seen) { throw "Receiver has not acknowledged any command in this bridge session." }

    # Safe suite: reversible operational checks. Final state is playback stopped,
    # metronome off and song loop off. Run only when those final states are acceptable.
    Submit-CertificationCommand "transport.start" @{ type = "start_playback" }
    Submit-CertificationCommand "transport.stop" @{ type = "stop_playback" }
    Submit-CertificationCommand "metronome.on" @{ type = "set_metronome"; enabled = $true }
    Submit-CertificationCommand "metronome.off" @{ type = "set_metronome"; enabled = $false }
    Submit-CertificationCommand "song_loop.on" @{ type = "set_song_loop"; start = 0; length = 4; enabled = $true }
    Submit-CertificationCommand "song_loop.off" @{ type = "set_song_loop"; start = 0; length = 4; enabled = $false }

    if ($Profile -in @("mixer", "destructive")) {
        Submit-CertificationCommand "track.volume" @{ type = "set_track_volume"; track_ref = $TrackRef; volume = $TrackVolume }
        Submit-CertificationCommand "track.pan" @{ type = "set_track_pan"; track_ref = $TrackRef; pan = $TrackPan }
        Submit-CertificationCommand "track.mute.on" @{ type = "set_track_mute"; track_ref = $TrackRef; muted = $true }
        Submit-CertificationCommand "track.mute.off" @{ type = "set_track_mute"; track_ref = $TrackRef; muted = $false }
        Submit-CertificationCommand "track.solo.on" @{ type = "set_track_solo"; track_ref = $TrackRef; soloed = $true }
        Submit-CertificationCommand "track.solo.off" @{ type = "set_track_solo"; track_ref = $TrackRef; soloed = $false }
        Submit-CertificationCommand "return.volume" @{ type = "set_return_volume"; return = $ReturnIndex; volume = $ReturnVolume }
        Submit-CertificationCommand "return.pan" @{ type = "set_return_pan"; return = $ReturnIndex; pan = $ReturnPan }
        Submit-CertificationCommand "track.send" @{ type = "set_track_send"; track_ref = $TrackRef; return = $ReturnIndex; amount = 0.0 }
    }

    if ($Profile -eq "destructive") {
        if (-not $ConfirmDestructive) {
            throw "Destructive profile requires -ConfirmDestructive and must be run only in an empty disposable Live Set."
        }
        $tempRef = "titan_cert_temp"
        Submit-CertificationCommand "track.create_midi" @{ type = "create_midi_track"; name = "TITAN CERT TEMP"; track_ref = $tempRef }
        Submit-CertificationCommand "track.arm.on" @{ type = "arm_track"; track_ref = $tempRef; armed = $true }
        Submit-CertificationCommand "track.arm.off" @{ type = "arm_track"; track_ref = $tempRef; armed = $false }
        Submit-CertificationCommand "clip.create_midi" @{ type = "create_midi_clip"; track_ref = $tempRef; clip = 0; bar = 1; beats = 4; notes = @(@{ pitch = 60; start = 0; duration = 0.25; velocity = 80 }) }
        Submit-CertificationCommand "clip.name" @{ type = "set_clip_name"; track_ref = $tempRef; clip = 0; name = "TITAN CERT CLIP" }
        Submit-CertificationCommand "clip.color" @{ type = "set_clip_color"; track_ref = $tempRef; clip = 0; color = 65280 }
        Submit-CertificationCommand "clip.loop" @{ type = "set_clip_loop"; track_ref = $tempRef; clip = 0; start = 0; length = 4; enabled = $true }
        Submit-CertificationCommand "clip.launch" @{ type = "launch_clip"; track_ref = $tempRef; clip = 0 }
        Submit-CertificationCommand "track.stop_clips" @{ type = "stop_track_clips"; track_ref = $tempRef }
        Submit-CertificationCommand "scene.create" @{ type = "create_scene"; name = "TITAN CERT SCENE" }
        Submit-CertificationCommand "scene.duplicate" @{ type = "duplicate_scene"; scene = 0 }
        Submit-CertificationCommand "scene.delete_duplicate" @{ type = "delete_scene"; scene = 1 }
        Submit-CertificationCommand "track.duplicate" @{ type = "duplicate_track"; track_ref = $tempRef }
        Submit-CertificationCommand "track.delete_original" @{ type = "delete_track"; track_ref = $tempRef }
    }

    Write-Report -FinalStatus "completed"
    Write-Host "Certification completed. Bridge ACK results are recorded; inspect Live for Runtime confirmation." -ForegroundColor Green
} catch {
    Write-Report -FinalStatus "failed"
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
