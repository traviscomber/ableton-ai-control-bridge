param(
    [string]$BridgeBase = "http://127.0.0.1:8765",
    [string]$PlanPath = ".\titan-processing-plan.json"
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

function Snapshot-Device {
    param([string]$Kind,[Nullable[int]]$Index,[string]$DeviceName,[string]$SnapshotId)
    $payload = @{ type="capture_device_snapshot"; target_kind=$Kind; device=$DeviceName; snapshot_id=$SnapshotId }
    if ($Kind -eq "track") { $payload.track = [int]$Index }
    elseif ($Kind -eq "return") { $payload.return = [int]$Index }
    return Invoke-Titan $payload 90
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

Write-Host "=== TITAN PROCESSING APPLY PREFLIGHT ==="
Write-Host "Executable changes: $($changes.Count)"

# Strict preflight against current Live topology before first write.
foreach ($change in $changes) {
    $t=$change.target; $d=$change.device; $p=$change.parameter
    if ([bool]$d.duplicate_device_name) { throw "Blocked duplicate device name: $($t.name) / $($d.device_name)" }
    $v = [double]$p.proposed_normalized
    if ($v -lt 0 -or $v -gt 1) { throw "proposed_normalized out of range for $($p.parameter_name)" }
    if (-not [bool]$p.is_enabled) { throw "Blocked disabled parameter: $($t.name) / $($d.device_name) / $($p.parameter_name)" }

    $page = Read-ParameterPage -Kind ([string]$t.target_kind) -Index $t.index -DeviceIndex ([int]$d.device_index) -ParameterIndex ([int]$p.parameter_index)
    $runtime = @($page.parameters | Where-Object { [int]$_.index -eq [int]$p.parameter_index }) | Select-Object -First 1
    if (-not $runtime) { throw "Runtime parameter missing at index $($p.parameter_index)" }
    if ([string]$runtime.name -ne [string]$p.parameter_name) { throw "Topology drift: expected '$($p.parameter_name)' at index $($p.parameter_index), found '$($runtime.name)'" }
    if ([string]$page.device -ne [string]$d.device_name) { throw "Device topology drift: expected '$($d.device_name)', found '$($page.device)'" }
}
Write-Host "Preflight: PASS" -ForegroundColor Green

# Snapshot each unique device once before first write.
$snapshots = @{}
foreach ($change in $changes) {
    $t=$change.target; $d=$change.device
    $key = "$($t.target_kind):$($t.index):$($d.device_index)"
    if ($snapshots.ContainsKey($key)) { continue }
    $id = "titan-proc-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$($d.device_index)"
    Snapshot-Device -Kind ([string]$t.target_kind) -Index $t.index -DeviceName ([string]$d.device_name) -SnapshotId $id | Out-Null
    $snapshots[$key] = $id
    Start-Sleep -Milliseconds 180
}

foreach ($change in $changes) {
    $t=$change.target; $d=$change.device; $p=$change.parameter
    $payload = @{ value=[double]$p.proposed_normalized; device_index=[int]$d.device_index; parameter_index=[int]$p.parameter_index }
    if ($t.target_kind -eq "track") { $payload.type="set_device_parameter"; $payload.track=[int]$t.index }
    elseif ($t.target_kind -eq "return") { $payload.type="set_return_device_parameter"; $payload.return=[int]$t.index }
    elseif ($t.target_kind -eq "master") { $payload.type="set_master_device_parameter" }
    else { throw "Unsupported target kind: $($t.target_kind)" }

    $result = Invoke-Titan $payload 60
    $rb = [double]$result.readback.readback_normalized
    $requested = [double]$p.proposed_normalized
    if ([Math]::Abs($rb-$requested) -gt 0.002) { throw "Readback mismatch for $($t.name) / $($d.device_name) / $($p.parameter_name): requested=$requested readback=$rb" }
    Write-Host ("ACK {0} / {1} / {2} -> {3:N4}" -f $t.name,$d.device_name,$p.parameter_name,$rb) -ForegroundColor Green
    Start-Sleep -Milliseconds 180
}

$state = [ordered]@{ applied_at=(Get-Date).ToString('o'); plan=$PlanPath; snapshots=$snapshots }
$state | ConvertTo-Json -Depth 8 | Set-Content ".\titan-processing-last-state.json" -Encoding UTF8
Write-Host ""
Write-Host "=== TITAN PROCESSING APPLY COMPLETE ===" -ForegroundColor Green
Write-Host "Bridge ACK + normalized readback passed for every executed change."
Write-Host "Snapshots: .\titan-processing-last-state.json"
Write-Host "Audible validation still required in context."
