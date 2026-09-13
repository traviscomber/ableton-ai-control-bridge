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

$receiverFiles = @(
    "$Root\max-for-live\AI Control Bridge Receiver.amxd",
    "$Root\max-for-live\AI-Control-Bridge-Receiver.maxpat",
    "$Root\max-for-live\bridge_receiver.js"
)
foreach ($receiverFile in $receiverFiles) {
    if (-not (Test-Path $receiverFile)) {
        throw "Receiver bundle is incomplete: missing $receiverFile"
    }
}
Write-Host "Receiver bundle preflight PASS (3/3 files)." -ForegroundColor Green

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

$builtExe = Join-Path $Root "dist\AbletonAIControlBridge\AbletonAIControlBridge.exe"
if (-not (Test-Path $builtExe)) { throw "Packaged bridge executable was not produced." }

Write-Host "Certifying packaged command registry..." -ForegroundColor Yellow
$probe = Start-Process -FilePath $builtExe `
    -ArgumentList @("--self-test-command", "inspect_device_parameters_page") `
    -Wait -PassThru
if ($probe.ExitCode -ne 0) {
    throw "Packaged executable is missing inspect_device_parameters_page (exit $($probe.ExitCode))."
}
$indexedProbe = Start-Process -FilePath $builtExe `
    -ArgumentList @("--self-test-command", "set_device_parameter") `
    -Wait -PassThru
if ($indexedProbe.ExitCode -ne 0) {
    throw "Packaged executable is missing set_device_parameter (exit $($indexedProbe.ExitCode))."
}
Write-Host "Packaged command registry PASS: inspection + exact device writes." -ForegroundColor Green

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

$installer = Get-ChildItem $OutputDirectory -Filter "Ableton-AI-Control-Bridge-Setup-v0.7.1-r2.exe" | Select-Object -First 1
if (-not $installer) { throw "Expected clean-up installer v0.7.1-r2 was not produced." }
Write-Host "Installer ready: $($installer.FullName)" -ForegroundColor Green
