[CmdletBinding()]
param(
    [string]$Source,
    [string]$Provider = "Splice",
    [string]$License = "Splice Sounds commercial royalty-free license",
    [string]$LicenseUrl = "https://support.splice.com/en/articles/8652642-splice-sounds-licensing-faq",
    [string]$Certificate = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Library = Join-Path $ProjectRoot "Sound Library"

if (-not (Test-Path $Python)) {
    throw "Python environment missing. Run windows\install.ps1 first."
}
if (-not $Source) {
    $Source = Read-Host "Paste the folder containing your licensed WAV/AIFF/FLAC files"
}
if (-not (Test-Path $Source)) {
    throw "The source folder does not exist: $Source"
}

& $Python -m darksco.sound_library $Source `
    --library $Library `
    --provider $Provider `
    --license $License `
    --license-url $LicenseUrl `
    --certificate $Certificate
if ($LASTEXITCODE -ne 0) { throw "Sound import failed." }

Write-Host ""
Write-Host "Darksco sound library updated:" -ForegroundColor Green
Write-Host $Library -ForegroundColor Cyan
