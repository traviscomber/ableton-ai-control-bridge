[CmdletBinding()]
param([switch]$Quiet)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $ProjectRoot "config.json"
$DeviceDir = Join-Path $ProjectRoot "Max for Live Device"
$failed = $false

function Check($label, $condition, $detail) {
    if ($condition) { Write-Host "[OK]   $label" -ForegroundColor Green }
    else {
        Write-Host "[FAIL] $label - $detail" -ForegroundColor Red
        $script:failed = $true
    }
}

if (-not $Quiet) { Write-Host "Ableton AI Control Bridge diagnostics" -ForegroundColor Cyan }
$liveCandidates = @()
$programDataAbleton = Join-Path $env:ProgramData "Ableton"
if (Test-Path $programDataAbleton) {
    $liveCandidates = @(Get-ChildItem $programDataAbleton -Directory -Filter "Live 11*" -ErrorAction SilentlyContinue)
}
Check "Ableton Live 11 installation" ($liveCandidates.Count -gt 0) "No Live 11 folder found under $programDataAbleton"

$venvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
Check "Desktop package" ($ProjectRoot -eq (Join-Path ([Environment]::GetFolderPath("Desktop")) "Ableton AI Control Bridge")) "Run install.ps1 again"
Check "Python virtual environment" (Test-Path $venvPython) "Run windows\install.ps1"
Check "Bridge configuration" (Test-Path $ConfigPath) "Run windows\install.ps1"
Check "Max patch source" (Test-Path (Join-Path $DeviceDir "AI-Control-Bridge-Receiver.maxpat")) "Run windows\install.ps1"
Check "Max JavaScript engine" (Test-Path (Join-Path $DeviceDir "bridge_receiver.js")) "Run windows\install.ps1"

$amxd = Get-ChildItem $DeviceDir -Filter "*.amxd" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -ne $amxd) {
    Write-Host "[OK]   Saved .amxd device" -ForegroundColor Green
} else {
    Write-Host "[TODO] Save the .maxpat as .amxd from Max for Live (one-time manual step)" -ForegroundColor Yellow
}

try {
    $busy = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction Stop
    Write-Host "[INFO] HTTP port 8765 is active; the bridge may already be running." -ForegroundColor Yellow
} catch { Write-Host "[OK]   HTTP port 8765 is available" -ForegroundColor Green }

if (Test-Path $venvPython) {
    & $venvPython -m unittest discover -s (Join-Path $ProjectRoot "tests") -q
    Check "Python test suite" ($LASTEXITCODE -eq 0) "Tests failed"
}
if ($failed) { exit 1 }
exit 0
