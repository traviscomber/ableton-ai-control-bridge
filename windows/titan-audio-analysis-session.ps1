param(
    [Parameter(Mandatory=$true)][string]$RenderDir,
    [string]$PlanPath = ".\titan-processing-plan.json",
    [string]$OutputDir = ".\titan-audio-analysis"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Brain = Join-Path $Root "titan-mix-brain.py"

if (-not (Test-Path $RenderDir)) { throw "Render directory not found: $RenderDir" }
if (-not (Test-Path $PlanPath)) { throw "Processing plan not found: $PlanPath" }
if (-not (Test-Path $Brain)) { throw "Mix brain script missing: $Brain" }

$python = $null
foreach ($candidate in @("python", "py")) {
    try {
        $cmd = Get-Command $candidate -ErrorAction Stop
        if ($cmd) { $python = $candidate; break }
    } catch {}
}
if (-not $python) { throw "Python 3.10+ was not found in PATH." }

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$wavFiles = @(Get-ChildItem -Path $RenderDir -Filter *.wav -File | Sort-Object Name)
if ($wavFiles.Count -eq 0) { throw "No WAV files found in $RenderDir" }

Write-Host "=== TITAN AUDIO ANALYSIS SESSION ===" -ForegroundColor Cyan
Write-Host "Renders: $RenderDir"
Write-Host "Output:  $OutputDir"
Write-Host "Files:   $($wavFiles.Count)"
Write-Host ""

foreach ($wav in $wavFiles) {
    $safe = [IO.Path]::GetFileNameWithoutExtension($wav.Name) -replace '[^A-Za-z0-9_.-]', '_'
    $out = Join-Path $OutputDir ($safe + ".json")
    Write-Host "ANALYZE $($wav.Name)"
    if ($python -eq "py") {
        & py -3 -m ableton_bridge.audio_analysis analyze $wav.FullName --output $out
    } else {
        & python -m ableton_bridge.audio_analysis analyze $wav.FullName --output $out
    }
    if ($LASTEXITCODE -ne 0) { throw "Audio analysis failed for $($wav.Name)" }
}

$reviewPath = Join-Path $OutputDir "titan-mix-brain-review.json"
Write-Host ""
Write-Host "Building measurement-aware mix review..."
if ($python -eq "py") {
    & py -3 $Brain $PlanPath $OutputDir --output $reviewPath
} else {
    & python $Brain $PlanPath $OutputDir --output $reviewPath
}
if ($LASTEXITCODE -ne 0) { throw "Mix brain review generation failed." }

$analyses = @()
Get-ChildItem $OutputDir -Filter *.json -File | Where-Object { $_.Name -ne "titan-mix-brain-review.json" } | ForEach-Object {
    try { $analyses += Get-Content $_.FullName -Raw | ConvertFrom-Json } catch {}
}

$summary = Join-Path $OutputDir "titan-audio-analysis-summary.txt"
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("TITAN AUDIO ANALYSIS SUMMARY")
$lines.Add("Generated: $((Get-Date).ToString('o'))")
$lines.Add("Mode: OFFLINE RENDER ANALYSIS")
$lines.Add("")
foreach ($item in $analyses) {
    $name = [IO.Path]::GetFileName([string]$item.path)
    $lines.Add("$name")
    $lines.Add(("  Peak: {0:N2} dBFS | RMS: {1:N2} dBFS | Crest: {2:N2} dB | Headroom: {3:N2} dB" -f [double]$item.level.peak_dbfs,[double]$item.level.rms_dbfs,[double]$item.level.crest_db,[double]$item.level.headroom_db))
    if ($null -ne $item.stereo.correlation) { $lines.Add(("  Stereo correlation: {0:N3}" -f [double]$item.stereo.correlation)) }
    $lines.Add(("  Low/Mid/High ratios: {0:N3} / {1:N3} / {2:N3}" -f [double]$item.spectral_balance.low_end_ratio,[double]$item.spectral_balance.mid_ratio,[double]$item.spectral_balance.high_ratio))
    $lines.Add(("  Clipped PCM samples: {0}" -f [int]$item.level.clipped_samples))
    $lines.Add("")
}
$lines.Add("LIMITS")
$lines.Add("This layer does not measure LUFS or true peak yet. Those require a dedicated calibrated audio-meter path.")
$lines.Add("No musical quality verdict is automatic; audible A/B remains required.")
$lines.Add("")
$lines.Add("Review: $reviewPath")
$lines | Set-Content $summary -Encoding UTF8

Write-Host ""
Write-Host "=== TITAN AUDIO ANALYSIS READY ===" -ForegroundColor Green
Write-Host "Summary: $summary"
Write-Host "Review:  $reviewPath"
Write-Host "No Ableton parameters were changed." -ForegroundColor Yellow
