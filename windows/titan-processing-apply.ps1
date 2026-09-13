param(
    [string]$BridgeBase = "http://127.0.0.1:8765",
    [string]$PlanPath = ".\titan-processing-plan.json",
    [switch]$Apply,
    [switch]$AllowLargeMoves,
    [double]$MaxNormalizedDelta = 0.25
)

$ErrorActionPreference = "Stop"

function Invoke-Titan {
    param([hashtable]$Payload,[int]$TimeoutSec=60)
    $body = $Payload | ConvertTo-Json -Depth 14 -Compress
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
}

function Read-ParameterPage {
    param([string]$Kind,[Nullable[int]]$Index,[int]$DeviceIndex,[int]$ParameterIndex)
    $start = [Math]::Floor($ParameterIndex / 6) * 6
    $payload = @{ type="inspect_device_parameters_page"; target_kind=$Kind; device_index=$DeviceIndex; start=[int]$start; limit=6 }
    if ($Kind -eq "track") { $payload.track = [int]$Index }
    elseif ($Kind -eq "return") { $payload.return = [int]$Index }
    return Invoke-Titan $payload 60
}

function Indexed-WritePayload {
    param([string]$Kind,[Nullable[int]]$Index,[int]$DeviceIndex,[int]$ParameterIndex,[double]$Value)
    $payload = @{ value=$Value; device_index=$DeviceIndex; parameter_index=$ParameterIndex }
    if ($Kind -eq "track") { $payload.type="set_device_parameter"; $payload.track=[int]$Index }
    elseif ($Kind -eq "return") { $payload.type="set_return_device_parameter"; $payload.return=[int]$Index }
    elseif ($Kind -eq "master") { $payload.type="set_master_device_parameter" }
    else { throw "Unsupported target kind: $Kind" }
    return $payload
}

if (-not (Test-Path $PlanPath)) { throw "Plan not found: $PlanPath" }
$plan = Get-Content $PlanPath -Raw | ConvertFrom-Json
$health = Invoke-RestMethod "$BridgeBase/health" -TimeoutSec 10
if (-not $health.ok -or -not $health.max_receiver_seen) { throw "Bridge/Receiver not ready" }

$changes = @()
foreach ($target in @($plan.targets)) {
    foreach ($device in @($target.devices)) {
        foreach ($parameter in @($device.parameters)) {
            if ($null -eq $parameter.proposed_normalized) { continue }
            $changes += [pscustomobject]@{ target=$target; device=$device; parameter=$parameter }
        }
    }
}

if ($changes.Count -eq 0) {
    Write-Host "No proposed_normalized values found. Nothing changed." -ForegroundColor Yellow
    exit 0
}

Write-Host "=== TITAN PROCESSING PREFLIGHT ==="
Write-Host "Executable changes: $($changes.Count)"
Write-Host "Max normalized delta: $MaxNormalizedDelta"
Write-Host "Apply mode: $([bool]$Apply)"
Write-Host ""

$verified = @()
foreach ($change in $changes) {
    $t=$change.target; $d=$change.device; $p=$change.parameter
    $v = [double]$p.proposed_normalized
    if ($v -lt 0 -or $v -gt 1) { throw "proposed_normalized out of range for $($p.parameter_name)" }
    if (-not [bool]$p.is_enabled) { throw "Blocked disabled parameter: $($t.name) / $($d.device_name) / $($p.parameter_name)" }
    if ([bool]$p.is_quantized -and -not ([bool]$p.approve_quantized)) {
        throw "Blocked quantized parameter without approve_quantized=true: $($t.name) / $($d.device_name) / $($p.parameter_name)"
    }

    $page = Read-ParameterPage -Kind ([string]$t.target_kind) -Index $t.index -DeviceIndex ([int]$d.device_index) -ParameterIndex ([int]$p.parameter_index)
    $runtime = @($page.parameters | Where-Object { [int]$_.index -eq [int]$p.parameter_index }) | Select-Object -First 1
    if (-not $runtime) { throw "Runtime parameter missing at index $($p.parameter_index)" }
    if ([string]$runtime.name -ne [string]$p.parameter_name) { throw "Topology drift: expected '$($p.parameter_name)' at index $($p.parameter_index), found '$($runtime.name)'" }
    if ([string]$page.device -ne [string]$d.device_name) { throw "Device topology drift: expected '$($d.device_name)', found '$($page.device)'" }

    $current = [double]$runtime.normalized
    $delta = [Math]::Abs($v-$current)
    if ($delta -gt $MaxNormalizedDelta -and -not $AllowLargeMoves) {
        throw ("Blocked large move {0:N4}: {1} / {2} / {3}. Re-run with -AllowLargeMoves only after review." -f $delta,$t.name,$d.device_name,$p.parameter_name)
    }

    $verified += [pscustomobject]@{
        target=$t; device=$d; parameter=$p; current=$current; requested=$v; delta=$delta
    }
    Write-Host ("PLAN {0} / {1}[{2}] / {3}[{4}] {5:N4} -> {6:N4} delta={7:N4}" -f $t.name,$d.device_name,$d.device_index,$p.parameter_name,$p.parameter_index,$current,$v,$delta)
}
Write-Host ""
Write-Host "Preflight: PASS" -ForegroundColor Green

if (-not $Apply) {
    Write-Host "DRY PREFLIGHT ONLY: no Ableton parameters were changed." -ForegroundColor Yellow
    Write-Host "Review the PLAN lines, then run again with -Apply."
    exit 0
}

# Exact-index rollback state. This is safer than name-based device snapshots for duplicate EQ/processor names.
$rollback = [ordered]@{
    schema=1
    created_at=(Get-Date).ToString('o')
    plan=$PlanPath
    bridge_version=$health.version
    changes=@()
}
foreach ($v in $verified) {
    $t=$v.target; $d=$v.device; $p=$v.parameter
    $rollback.changes += [ordered]@{
        target_kind=[string]$t.target_kind
        index=$t.index
        target_name=[string]$t.name
        device_index=[int]$d.device_index
        device_name=[string]$d.device_name
        parameter_index=[int]$p.parameter_index
        parameter_name=[string]$p.parameter_name
        original_normalized=[double]$v.current
        requested_normalized=[double]$v.requested
    }
}
$rollbackPath = ".\titan-processing-rollback.json"
$rollback | ConvertTo-Json -Depth 12 | Set-Content $rollbackPath -Encoding UTF8
Write-Host "Rollback state captured: $rollbackPath" -ForegroundColor Cyan

$applied = 0
try {
    foreach ($v in $verified) {
        $t=$v.target; $d=$v.device; $p=$v.parameter
        $payload = Indexed-WritePayload -Kind ([string]$t.target_kind) -Index $t.index -DeviceIndex ([int]$d.device_index) -ParameterIndex ([int]$p.parameter_index) -Value ([double]$v.requested)
        $result = Invoke-Titan $payload 60
        $rb = [double]$result.readback.readback_normalized
        if ([Math]::Abs($rb-[double]$v.requested) -gt 0.002) {
            throw "Readback mismatch for $($t.name) / $($d.device_name) / $($p.parameter_name): requested=$($v.requested) readback=$rb"
        }
        $applied++
        Write-Host ("ACK {0} / {1}[{2}] / {3}[{4}] -> {5:N4}" -f $t.name,$d.device_name,$d.device_index,$p.parameter_name,$p.parameter_index,$rb) -ForegroundColor Green
        Start-Sleep -Milliseconds 180
    }
}
catch {
    Write-Host ""
    Write-Host "APPLY STOPPED after $applied successful writes." -ForegroundColor Red
    Write-Host "Rollback file is complete and can restore every planned parameter to its preflight value: $rollbackPath" -ForegroundColor Yellow
    throw
}

$state = [ordered]@{
    applied_at=(Get-Date).ToString('o')
    plan=$PlanPath
    rollback=$rollbackPath
    changes=$applied
}
$state | ConvertTo-Json -Depth 8 | Set-Content ".\titan-processing-last-state.json" -Encoding UTF8
Write-Host ""
Write-Host "=== TITAN PROCESSING APPLY COMPLETE ===" -ForegroundColor Green
Write-Host "Bridge ACK + normalized readback passed for every executed change."
Write-Host "Exact rollback: $rollbackPath"
Write-Host "Audible validation still required in context."
