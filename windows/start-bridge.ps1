[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Config = Join-Path $ProjectRoot "config.json"

if (-not (Test-Path $Python) -or -not (Test-Path $Config)) {
    throw "Bridge is not installed. Run windows\install.ps1 first."
}

$arguments = @("-m", "ableton_bridge.server", "--config", $Config)
if ($DryRun) { $arguments += "--dry-run" }

Start-Process "http://127.0.0.1:8765"
Write-Host "Starting Ableton AI Control Bridge..." -ForegroundColor Cyan
Write-Host "Keep this window open. Press Ctrl+C to stop."
& $Python @arguments
