[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$base = "https://raw.githubusercontent.com/traviscomber/ableton-ai-control-bridge/main"

Write-Host "TITAN runtime repair" -ForegroundColor Cyan

$process = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and $_.CommandLine -like "*ableton_bridge.server*"
} | Select-Object -First 1

if (-not $process) {
    throw "No running ableton_bridge.server process was found. Start the bridge first, then rerun this repair."
}

$cmd = [string]$process.CommandLine
Write-Host "Found bridge PID $($process.ProcessId)" -ForegroundColor Green
Write-Host $cmd -ForegroundColor DarkGray

$configPath = $null
if ($cmd -match '--config\s+"([^"]+)"') { $configPath = $matches[1] }
elseif ($cmd -match '--config\s+([^\s]+)') { $configPath = $matches[1] }

if (-not $configPath -or -not (Test-Path $configPath)) {
    throw "Could not resolve the active --config path from the running bridge process."
}

$projectRoot = Split-Path -Parent $configPath
$commandsPath = Join-Path $projectRoot "ableton_bridge\commands.py"
$receiverCandidates = @(
    (Join-Path $projectRoot "Max for Live Device\bridge_receiver.js"),
    (Join-Path $projectRoot "max-for-live\bridge_receiver.js")
)

Write-Host "Active config: $configPath" -ForegroundColor Green
Write-Host "Active root:   $projectRoot" -ForegroundColor Green

function Download-Atomic([string]$url, [string]$path) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
    $tmp = "$path.titan-new"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp
    if ((Get-Item $tmp).Length -lt 100) { throw "Downloaded file is unexpectedly small: $url" }
    Move-Item $tmp $path -Force
    Write-Host "Updated: $path" -ForegroundColor Green
}

Download-Atomic "$base/ableton_bridge/commands.py" $commandsPath
foreach ($path in $receiverCandidates) {
    if ((Test-Path (Split-Path -Parent $path)) -or $path -like "*max-for-live*") {
        Download-Atomic "$base/max-for-live/bridge_receiver.js" $path
    }
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
Write-Host "Config permissions repaired." -ForegroundColor Green

$exe = [string]$process.ExecutablePath
if (-not $exe -or -not (Test-Path $exe)) {
    $venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) { $exe = $venvPython }
}
if (-not $exe -or -not (Test-Path $exe)) { throw "Could not resolve the Python executable used by the active bridge." }

Stop-Process -Id $process.ProcessId -Force
Start-Sleep -Milliseconds 800

$arguments = @("-m", "ableton_bridge.server", "--config", $configPath)
Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $projectRoot
Write-Host "Restarted bridge with repaired runtime." -ForegroundColor Green

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
Write-Host "Health OK. Version: $($health.version)" -ForegroundColor Green
Write-Host "Paged audit command: $hasPaged" -ForegroundColor $(if ($hasPaged) { "Green" } else { "Red" })
if (-not $hasPaged) { throw "Runtime is healthy but inspect_device_parameters_page is still missing from allowed_commands." }

Write-Host ""
Write-Host "TITAN runtime repair complete. Reopen the Max receiver device once in Live if the JS autowatch reload did not occur automatically." -ForegroundColor Cyan
