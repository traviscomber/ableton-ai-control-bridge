[CmdletBinding()]
param(
    [string]$PythonPath,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DefaultPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Python = if ($PythonPath) { $PythonPath } else { $DefaultPython }
$DistDir = Join-Path $ProjectRoot "dist"
$BuildDir = Join-Path $ProjectRoot "build\launcher"
$SpecDir = Join-Path $ProjectRoot "build"
$Output = Join-Path $DistDir "Ableton Bridge Launcher.exe"

if (-not (Test-Path $Python)) {
    throw "Python environment not found at $Python. Run windows\install.ps1 first."
}

if (-not $SkipInstall) {
    & $Python -m pip install --upgrade pyinstaller
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller installation failed." }
}

New-Item -ItemType Directory -Force -Path $DistDir, $BuildDir, $SpecDir | Out-Null

& $Python -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --windowed `
    --name "Ableton Bridge Launcher" `
    --distpath $DistDir `
    --workpath $BuildDir `
    --specpath $SpecDir `
    --paths $ProjectRoot `
    --collect-submodules ableton_bridge `
    (Join-Path $ProjectRoot "ableton_bridge\launcher.py")

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Output)) {
    throw "Launcher build failed. Review the PyInstaller output above."
}

Write-Host "Launcher created:" -ForegroundColor Green
Write-Host $Output -ForegroundColor White
Write-Host ""
Write-Host "Place the EXE beside config.json in the installed Desktop package." -ForegroundColor Cyan
