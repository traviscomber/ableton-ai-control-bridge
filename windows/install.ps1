[CmdletBinding()]
param([string]$PythonCommand = "py")

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $PSScriptRoot
$Desktop = [Environment]::GetFolderPath("Desktop")
$ProjectRoot = Join-Path $Desktop "Ableton AI Control Bridge"
$WindowsDir = Join-Path $ProjectRoot "windows"
$DeviceDir = Join-Path $ProjectRoot "Max for Live Device"
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ConfigPath = Join-Path $ProjectRoot "config.json"
$DataDir = Join-Path $ProjectRoot "data"
$DataPath = Join-Path $DataDir "history.sqlite3"

Write-Host ""
Write-Host "Ableton AI Control Bridge - Windows + Live 11" -ForegroundColor Cyan
Write-Host "Everything will be installed here:" -ForegroundColor White
Write-Host $ProjectRoot -ForegroundColor Green

Write-Host "[1/6] Creating the Desktop package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $ProjectRoot, $DeviceDir, $DataDir | Out-Null

$sourceFull = [IO.Path]::GetFullPath($SourceRoot).TrimEnd('\')
$targetFull = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
if ($sourceFull -ine $targetFull) {
    $files = @("README.md", "LICENSE", "pyproject.toml", ".gitignore")
    foreach ($file in $files) {
        Copy-Item (Join-Path $SourceRoot $file) $ProjectRoot -Force
    }
    $folders = @("ableton_bridge", "docs", "examples", "tests", "remote-scripts", "windows")
    foreach ($folder in $folders) {
        $destination = Join-Path $ProjectRoot $folder
        if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
        Copy-Item (Join-Path $SourceRoot $folder) $destination -Recurse -Force
    }
}
Copy-Item (Join-Path $SourceRoot "max-for-live\AI-Control-Bridge-Receiver.maxpat") $DeviceDir -Force
Copy-Item (Join-Path $SourceRoot "max-for-live\bridge_receiver.js") $DeviceDir -Force
Copy-Item (Join-Path $SourceRoot "max-for-live\device-build-guide.md") $DeviceDir -Force

if (-not (Get-Command $PythonCommand -ErrorAction SilentlyContinue)) {
    throw "Python launcher '$PythonCommand' was not found. Install Python 3.10+ from python.org and enable the py launcher."
}

Write-Host "[2/6] Creating Python environment on the Desktop..." -ForegroundColor Yellow
if (-not (Test-Path $VenvPython)) {
    & $PythonCommand -3 -m venv (Join-Path $ProjectRoot ".venv")
}
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -e $ProjectRoot

Write-Host "[3/6] Creating secure local configuration..." -ForegroundColor Yellow
if (-not (Test-Path $ConfigPath)) {
    $bytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($bytes)
    $random.Dispose()
    $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    $config = [ordered]@{
        host = "127.0.0.1"
        port = 8765
        udp_host = "127.0.0.1"
        udp_port = 9001
        ack_host = "127.0.0.1"
        ack_port = 9002
        database = $DataPath
        token = $token
        allow = @(
            "set_tempo", "launch_scene", "stop_all_clips",
            "set_track_volume", "set_track_pan", "set_macro",
            "create_midi_clip", "create_audio_track", "create_midi_track",
            "arm_track", "set_device_parameter"
        )
        require_approval = $true
        dry_run = $false
    }
    $config | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $ConfigPath
} else {
    Write-Host "Keeping your existing Desktop token and history configuration."
}

Write-Host "[4/6] Creating easy launchers..." -ForegroundColor Yellow
$startCmd = @"
@echo off
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\start-bridge.ps1"
pause
"@
$doctorCmd = @"
@echo off
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\doctor.ps1"
pause
"@
$deviceCmd = @"
@echo off
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\open-device-source.ps1"
pause
"@
$startCmd | Set-Content -Encoding ASCII (Join-Path $ProjectRoot "START BRIDGE.cmd")
$doctorCmd | Set-Content -Encoding ASCII (Join-Path $ProjectRoot "CHECK INSTALLATION.cmd")
$deviceCmd | Set-Content -Encoding ASCII (Join-Path $ProjectRoot "OPEN MAX DEVICE SOURCE.cmd")

Write-Host "[5/6] Running diagnostics..." -ForegroundColor Yellow
& (Join-Path $WindowsDir "doctor.ps1") -Quiet
if ($LASTEXITCODE -ne 0) {
    Write-Warning "The missing .amxd is expected until you complete the one-time Max save step."
}

Write-Host "[6/6] Desktop installation complete." -ForegroundColor Green
Write-Host ""
Write-Host "Your complete package is here:" -ForegroundColor Cyan
Write-Host $ProjectRoot -ForegroundColor White
Write-Host ""
Write-Host "ONE-TIME MAX STEP:" -ForegroundColor Cyan
Write-Host "1. Open Live 11 and add a blank Max MIDI Effect."
Write-Host "2. Click Edit. In Max choose File > Open."
Write-Host "3. Open: $DeviceDir\AI-Control-Bridge-Receiver.maxpat"
Write-Host "4. Save As: $DeviceDir\AI Control Bridge Receiver.amxd"
Write-Host "5. Drag that .amxd from the Desktop folder into a MIDI track in Live."
Write-Host "6. Double-click START BRIDGE.cmd."
Write-Host ""
Write-Host "The token is stored in config.json inside the same Desktop folder."
