$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Patch = Join-Path $ProjectRoot "Max for Live Device\AI-Control-Bridge-Receiver.maxpat"

if (-not (Test-Path $Patch)) { throw "Device source not found. Run install.ps1 first." }
Write-Host "Opening the Max patch source from your Desktop package:" -ForegroundColor Cyan
Write-Host $Patch
Write-Host "If Windows asks for an application, cancel and open this file from Max for Live inside Live 11."
Start-Process $Patch
