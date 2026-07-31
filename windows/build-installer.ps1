[CmdletBinding()]
param(
    [string]$Python = "py",
    [string]$OutputDirectory = "dist-installer"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Building Ableton AI Control Bridge for Windows..." -ForegroundColor Cyan
& $Python -m pip install --upgrade pyinstaller
if ($LASTEXITCODE -ne 0) { throw "PyInstaller installation failed." }

& $Python "windows\patch_live11_notes.py"
if ($LASTEXITCODE -ne 0) { throw "Live 11 note API patch failed." }

Remove-Item "$Root\build\AbletonAIControlBridge" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$Root\dist\AbletonAIControlBridge" -Recurse -Force -ErrorAction SilentlyContinue

& $Python -m PyInstaller `
    --noconfirm `
    --clean `
    --windowed `
    --name "AbletonAIControlBridge" `
    --collect-submodules ableton_bridge `
    --collect-submodules darksco `
    "windows\desktop_entry.py"
if ($LASTEXITCODE -ne 0) { throw "Application build failed." }

$isccCandidates = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
)
if ($env:ChocolateyInstall) {
    $isccCandidates += "$env:ChocolateyInstall\bin\ISCC.exe"
}
$iscc = $isccCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 executable was not found." }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
& $iscc "/DMyOutputDir=$((Resolve-Path $OutputDirectory).Path)" "windows\installer.iss"
if ($LASTEXITCODE -ne 0) { throw "Installer compilation failed." }
Write-Host "Installer ready in $OutputDirectory" -ForegroundColor Green
