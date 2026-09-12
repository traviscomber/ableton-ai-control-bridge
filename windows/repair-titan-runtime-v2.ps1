[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$base = "https://raw.githubusercontent.com/traviscomber/ableton-ai-control-bridge/main"

Write-Host "TITAN runtime repair v2" -ForegroundColor Cyan

$process = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and $_.CommandLine -like "*ableton_bridge.server*"
} | Select-Object -First 1
if (-not $process) { throw "No running ableton_bridge.server process found." }

$cmd = [string]$process.CommandLine
$configPath = $null
if ($cmd -match '--config\s+"([^"]+)"') { $configPath = $matches[1] }
elseif ($cmd -match '--config\s+([^\s]+)') { $configPath = $matches[1] }
if (-not $configPath -or -not (Test-Path $configPath)) { throw "Could not resolve active --config path." }

$projectRoot = Split-Path -Parent $configPath
$exe = [string]$process.ExecutablePath
if (-not $exe -or -not (Test-Path $exe)) {
    $candidate = Join-Path $projectRoot ".venv\Scripts\python.exe"
    if (Test-Path $candidate) { $exe = $candidate }
}
if (-not $exe -or -not (Test-Path $exe)) { throw "Could not resolve active Python executable." }

Write-Host "PID:          $($process.ProcessId)" -ForegroundColor DarkGray
Write-Host "Python:       $exe" -ForegroundColor Green
Write-Host "Active config:$configPath" -ForegroundColor Green

# Resolve the exact module file imported by this interpreter.
$commandsPath = $null
try {
    $resolved = & $exe -c "import os, ableton_bridge.commands as c; print(os.path.abspath(c.__file__))" 2>$null
    if ($LASTEXITCODE -eq 0 -and $resolved) { $commandsPath = ([string]$resolved).Trim() }
} catch {}
if (-not $commandsPath -or -not (Test-Path $commandsPath)) {
    $fallback = Join-Path $projectRoot "ableton_bridge\commands.py"
    if (Test-Path $fallback) { $commandsPath = $fallback }
}
if (-not $commandsPath) { throw "Could not resolve imported ableton_bridge.commands module." }
Write-Host "Imported commands.py: $commandsPath" -ForegroundColor Green

function Download-Atomic([string]$url,[string]$path) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
    $tmp = "$path.titan-new"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp
    if ((Get-Item $tmp).Length -lt 100) { throw "Downloaded file is unexpectedly small: $url" }
    Move-Item $tmp $path -Force
    Write-Host "Updated: $path" -ForegroundColor Green
}

Download-Atomic "$base/ableton_bridge/commands.py" $commandsPath

# Refresh every plausible receiver source used by the installed package.
$receiverCandidates = @(
    (Join-Path $projectRoot "Max for Live Device\bridge_receiver.js"),
    (Join-Path $projectRoot "max-for-live\bridge_receiver.js")
)
foreach ($path in $receiverCandidates) {
    try { Download-Atomic "$base/max-for-live/bridge_receiver.js" $path } catch { Write-Warning $_.Exception.Message }
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$current = @()
if ($null -ne $config.allow) { $current = @($config.allow | ForEach-Object { [string]$_ }) }
$required = @(
    "get_live_state","list_tracks","inspect_track","list_returns",
    "inspect_device_chain","inspect_device_parameters","inspect_device_parameters_page",
    "inspect_clip","inspect_master","capture_mixer_snapshot","restore_mixer_snapshot",
    "capture_device_snapshot","restore_device_snapshot"
)
$config.allow = @($current + $required | Sort-Object -Unique)
$config | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $configPath

# Verify the interpreter itself sees the new command before restart.
$probe = & $exe -c "from ableton_bridge.commands import COMMANDS; print('inspect_device_parameters_page' in COMMANDS)" 2>$null
if (([string]$probe).Trim().ToLowerInvariant() -ne "true") {
    throw "The active Python interpreter still imports an old command schema after patching: $commandsPath"
}
Write-Host "Interpreter probe: paged command present." -ForegroundColor Green

Stop-Process -Id $process.ProcessId -Force
Start-Sleep -Milliseconds 800
Start-Process -FilePath $exe -ArgumentList @("-m","ableton_bridge.server","--config",$configPath) -WorkingDirectory $projectRoot

$deadline = (Get-Date).AddSeconds(15)
$health = $null
while ((Get-Date) -lt $deadline) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2
        if ($health.ok) { break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $health -or -not $health.ok) { throw "Bridge did not become healthy after restart." }
$hasPaged = @($health.allowed_commands) -contains "inspect_device_parameters_page"
Write-Host "Health OK" -ForegroundColor Green
Write-Host "Paged audit command: $hasPaged" -ForegroundColor $(if ($hasPaged) { "Green" } else { "Red" })
if (-not $hasPaged) { throw "Paged command still missing after exact-module repair." }
Write-Host "TITAN runtime repair v2 complete." -ForegroundColor Cyan
