param(
    [string]$BridgeBase = "http://127.0.0.1:8765"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AuditScript = Join-Path $Root "titan-processing-audit-v2.ps1"
$PlannerScript = Join-Path $Root "titan-processing-plan.py"
$AuditPath = Join-Path $Root "titan-processing-audit-v2.json"
$PlanPath = Join-Path $Root "titan-processing-plan.json"
$SummaryPath = Join-Path $Root "titan-mix-audit-summary.txt"

function Require-File([string]$Path) {
    if (-not (Test-Path $Path)) { throw "Required file missing: $Path" }
}

function Get-PythonCommand {
    foreach ($candidate in @("python", "py")) {
        try {
            $cmd = Get-Command $candidate -ErrorAction Stop
            if ($cmd) { return $candidate }
        } catch {}
    }
    throw "Python was not found in PATH. Install Python 3.10+ or run titan-processing-audit-v2.ps1 directly."
}

Write-Host "=== TITAN MIX AUDIT SESSION ===" -ForegroundColor Cyan
Write-Host "Mode: READ ONLY"
Write-Host "Bridge: $BridgeBase"
Write-Host ""

Require-File $AuditScript
Require-File $PlannerScript

$health = Invoke-RestMethod "$BridgeBase/health" -TimeoutSec 10
if (-not $health.ok) { throw "Bridge health failed" }
if (-not $health.max_receiver_seen) { throw "Max receiver ACK not seen. Keep Ableton + Receiver loaded and send one known-good command first." }

$required = @("list_tracks", "list_returns", "inspect_device_chain", "inspect_device_parameters_page")
foreach ($command in $required) {
    if ($health.allowed_commands -notcontains $command) {
        throw "Bridge allowlist is missing required read-only command: $command"
    }
}

Write-Host ("Bridge {0} / Receiver ACK yes" -f $health.version) -ForegroundColor Green
Write-Host "Running exact processing inventory..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $AuditScript -BridgeBase $BridgeBase -OutputPath $AuditPath
if ($LASTEXITCODE -ne 0) { throw "Processing audit failed with exit code $LASTEXITCODE" }

$python = Get-PythonCommand
Write-Host ""
Write-Host "Building review-only processing plan..."
if ($python -eq "py") {
    & py -3 $PlannerScript $AuditPath --output $PlanPath
} else {
    & python $PlannerScript $AuditPath --output $PlanPath
}
if ($LASTEXITCODE -ne 0) { throw "Processing planner failed with exit code $LASTEXITCODE" }

$audit = Get-Content $AuditPath -Raw | ConvertFrom-Json
$plan = Get-Content $PlanPath -Raw | ConvertFrom-Json

$targets = @($plan.targets)
$focusNames = @("BV KICK", "BV BASS", "BV MOTIF")
$focus = @($targets | Where-Object { $focusNames -contains [string]$_.name })

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("TITAN MIX AUDIT SUMMARY")
$lines.Add("Generated: $((Get-Date).ToString('o'))")
$lines.Add("Bridge: $($health.version)")
$lines.Add("Mode: READ ONLY")
$lines.Add("")
$lines.Add("PRIORITY TARGETS")

foreach ($target in $focus) {
    $lines.Add("")
    $lines.Add("[$($target.name)] role=$($target.role)")
    foreach ($device in @($target.devices)) {
        $lines.Add(("  device_index={0} {1} params={2}" -f $device.device_index,$device.device_name,@($device.parameters).Count))
    }
}

$lines.Add("")
$lines.Add("NEXT GATE")
$lines.Add("1. Review KICK/BASS/MOTIF exact device and parameter inventory.")
$lines.Add("2. Approve only explicit proposed_normalized values.")
$lines.Add("3. Run titan-processing-apply.ps1 without -Apply for preflight.")
$lines.Add("4. Apply only after review, then verify ACK + readback + audible A/B.")
$lines.Add("")
$lines.Add("FILES")
$lines.Add("Audit: $AuditPath")
$lines.Add("Plan: $PlanPath")

$lines | Set-Content $SummaryPath -Encoding UTF8

Write-Host ""
Write-Host "=== TITAN MIX AUDIT READY ===" -ForegroundColor Green
Write-Host "Audit:   $AuditPath"
Write-Host "Plan:    $PlanPath"
Write-Host "Summary: $SummaryPath"
Write-Host ""
Write-Host "No Ableton parameters were changed." -ForegroundColor Yellow
