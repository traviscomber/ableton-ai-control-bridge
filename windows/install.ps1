[CmdletBinding()]
param([string]$PythonCommand)

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
} else {
    Write-Host "Repairing the existing Desktop package from GitHub..." -ForegroundColor Yellow
    $repairFiles = @(
        "ableton_bridge/__init__.py",
        "ableton_bridge/cli.py",
        "ableton_bridge/commands.py",
        "ableton_bridge/runner.py",
        "ableton_bridge/security.py",
        "ableton_bridge/server.py",
        "ableton_bridge/store.py",
        "ableton_bridge/transport.py",
        "tests/test_commands.py",
        "tests/test_v02.py",
        "windows/doctor.ps1",
        "windows/start-bridge.ps1",
        "windows/open-device-source.ps1",
        "pyproject.toml"
    )
    foreach ($relative in $repairFiles) {
        $localRelative = $relative.Replace('/', '\')
        $destination = Join-Path $ProjectRoot $localRelative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        $url = "https://raw.githubusercontent.com/traviscomber/ableton-ai-control-bridge/main/$relative"
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destination
        } catch {
            throw "Could not repair $relative from GitHub. Check your internet connection. $($_.Exception.Message)"
        }
    }
}
function Install-MaxAsset($fileName) {
    $destination = Join-Path $DeviceDir $fileName
    $sourceCandidates = @(
        (Join-Path $SourceRoot "max-for-live\$fileName"),
        (Join-Path $SourceRoot "Max for Live Device\$fileName")
    )
    foreach ($source in $sourceCandidates) {
        if (Test-Path $source) {
            if ([IO.Path]::GetFullPath($source) -ine [IO.Path]::GetFullPath($destination)) {
                Copy-Item $source $destination -Force
            }
            return
        }
    }
    $url = "https://raw.githubusercontent.com/traviscomber/ableton-ai-control-bridge/main/max-for-live/$fileName"
    Write-Host "Downloading missing Max asset: $fileName" -ForegroundColor Yellow
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destination
    } catch {
        throw "Could not restore $fileName from GitHub. Check your internet connection and run install.ps1 again. $($_.Exception.Message)"
    }
}

Install-MaxAsset "AI-Control-Bridge-Receiver.maxpat"
Install-MaxAsset "bridge_receiver.js"
Install-MaxAsset "device-build-guide.md"

function Find-Python {
    $candidates = @()
    if ($PythonCommand) { $candidates += $PythonCommand }
    $candidates += @(
        "py",
        "python",
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python310\python.exe")
    )
    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if (-not $command) { continue }
        try {
            if ($command.Name -eq "py.exe" -or $candidate -eq "py") {
                $version = & $command.Source -3 -c "import sys; print(sys.version_info[0] * 100 + sys.version_info[1])" 2>$null
                if ([int]$version -ge 310) { return @{ Exe = $command.Source; Prefix = @("-3") } }
            } else {
                $version = & $command.Source -c "import sys; print(sys.version_info[0] * 100 + sys.version_info[1])" 2>$null
                if ([int]$version -ge 310) { return @{ Exe = $command.Source; Prefix = @() } }
            }
        } catch { continue }
    }
    return $null
}

$Python = Find-Python
if (-not $Python) {
    $winget = Get-Command "winget" -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw "Python 3.10+ was not found and winget is unavailable. Install Python 3.12 from https://www.python.org/downloads/windows/ and run this installer again."
    }
    Write-Host "Python was not found. Installing Python 3.12 automatically with winget..." -ForegroundColor Yellow
    & $winget.Source install --id Python.Python.3.12 -e --scope user --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Automatic Python installation failed. Install Python 3.12 from python.org and rerun install.ps1." }
    $Python = Find-Python
    if (-not $Python) {
        throw "Python was installed but could not be located. Close PowerShell, open it again, and rerun windows\install.ps1."
    }
}
Write-Host "Using Python: $($Python.Exe)" -ForegroundColor Green
$PythonExe = [string]$Python.Exe
$PythonPrefix = @($Python.Prefix)

Write-Host "[2/6] Creating Python environment on the Desktop..." -ForegroundColor Yellow
if (-not (Test-Path $VenvPython)) {
    & $PythonExe @PythonPrefix -m venv (Join-Path $ProjectRoot ".venv")
    if ($LASTEXITCODE -ne 0) { throw "Python could not create the virtual environment." }
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
