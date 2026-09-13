param(
    [string]$BridgeBase = "http://127.0.0.1:8765",
    [string]$RollbackPath = ".\titan-processing-rollback.json"
)

$ErrorActionPreference = "Stop"

function Invoke-Titan {
    param([hashtable]$Payload,[int]$TimeoutSec=60)
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
}

function Read-ParameterPage {
    param([string]$Kind,[Nullable[int]]$Index,[int]$DeviceIndex,[int]$ParameterIndex)
    $start = [Math]::Floor($ParameterIndex / 6) * 6
    $payload = @{ type="inspect_device_parameters_page"; target_kind=$Kind; device_index=$DeviceIndex; start=[int]$start; limit=6 }
    if ($Kind -eq "track") { $payload.track=[int]$Index }
    elseif ($Kind -eq "return") { $payload.return=[int]$Index }
    return Invoke-Titan $payload 60
}

function Write-Indexed {
    param([string]$Kind,[Nullable[int]]$Index,[int]$DeviceIndex,[int]$ParameterIndex,[double]$Value)
    $payload = @{ value=$Value; device_index=$DeviceIndex; parameter_index=$ParameterIndex }
    if ($Kind -eq "track") { $payload.type="set_device_parameter"; $payload.track=[int]$Index }
    elseif ($Kind -eq "return") { $payload.type="set_return_device_parameter"; $payload.return=[int]$Index }
    elseif ($Kind -eq "master") { $payload.type="set_master_device_parameter" }
    else { throw "Unsupported target kind: $Kind" }
    return Invoke-Titan $payload 60
}

if (-not (Test-Path $RollbackPath)) { throw "Rollback file not found: $RollbackPath" }
$state = Get-Content $RollbackPath -Raw | ConvertFrom-Json
$health = Invoke-RestMethod "$BridgeBase/health" -TimeoutSec 10
if (-not $health.ok -or -not $health.max_receiver_seen) { throw "Bridge/Receiver not ready" }

Write-Host "=== TITAN PROCESSING ROLLBACK PREFLIGHT ==="
Write-Host "Changes to restore: $(@($state.changes).Count)"

foreach ($c in @($state.changes)) {
    $page = Read-ParameterPage -Kind ([string]$c.target_kind) -Index $c.index -DeviceIndex ([int]$c.device_index) -ParameterIndex ([int]$c.parameter_index)
    if ([string]$page.device -ne [string]$c.device_name) {
        throw "Device topology drift for $($c.target_name): expected '$($c.device_name)', found '$($page.device)'"
    }
    $runtime = @($page.parameters | Where-Object { [int]$_.index -eq [int]$c.parameter_index }) | Select-Object -First 1
    if (-not $runtime) { throw "Parameter missing at index $($c.parameter_index)" }
    if ([string]$runtime.name -ne [string]$c.parameter_name) {
        throw "Parameter topology drift: expected '$($c.parameter_name)', found '$($runtime.name)'"
    }
}
Write-Host "Preflight: PASS" -ForegroundColor Green

$restored=0
foreach ($c in @($state.changes)) {
    $result = Write-Indexed -Kind ([string]$c.target_kind) -Index $c.index -DeviceIndex ([int]$c.device_index) -ParameterIndex ([int]$c.parameter_index) -Value ([double]$c.original_normalized)
    $rb=[double]$result.readback.readback_normalized
    if ([Math]::Abs($rb-[double]$c.original_normalized) -gt 0.002) {
        throw "Rollback readback mismatch for $($c.target_name) / $($c.device_name) / $($c.parameter_name)"
    }
    $restored++
    Write-Host ("RESTORED {0} / {1}[{2}] / {3}[{4}] -> {5:N4}" -f $c.target_name,$c.device_name,$c.device_index,$c.parameter_name,$c.parameter_index,$rb) -ForegroundColor Green
    Start-Sleep -Milliseconds 180
}

Write-Host ""
Write-Host "=== TITAN PROCESSING ROLLBACK COMPLETE ===" -ForegroundColor Green
Write-Host "Restored parameters: $restored"
Write-Host "Bridge ACK + readback: PASS"
