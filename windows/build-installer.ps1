[CmdletBinding()]
param(
    [string]$Python = "py",
    [string]$OutputDirectory = "dist-installer"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Building Ableton AI Control Bridge for Windows..." -ForegroundColor Cyan
& $Python -3 -m pip install --upgrade pyinstaller
if ($LASTEXITCODE -ne 0) { throw "PyInstaller installation failed." }

Remove-Item "$Root\build\AbletonAIControlBridge" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$Root\dist\AbletonAIControlBridge" -Recurse -Force -ErrorAction SilentlyContinue

& $Python -3 -m PyInstaller `
    --noconfirm `
    --clean `
    --windowed `
    --name "AbletonAIControlBridge" `
    --collect-submodules ableton_bridge `
    --collect-submodules darksco `
    "ableton_bridge\desktop.py"
if ($LASTEXITCODE -ne 0) { throw "Application build failed." }

$iscc = @(
    "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 is required. Install it with: winget install JRSoftware.InnoSetup" }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
& $iscc "/DMyOutputDir=$((Resolve-Path $OutputDirectory).Path)" "windows\installer.iss"
if ($LASTEXITCODE -ne 0) { throw "Installer compilation failed." }
Write-Host "Installer ready in $OutputDirectory" -ForegroundColor Green
