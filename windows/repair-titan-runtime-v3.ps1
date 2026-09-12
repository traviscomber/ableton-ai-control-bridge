[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$base = "https://raw.githubusercontent.com/traviscomber/ableton-ai-control-bridge/main"

Write-Host "TITAN runtime repair v3" -ForegroundColor Cyan

$listener = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) {
    throw "No process is listening on 127.0.0.1:8765. Start the bridge once, then rerun this repair."
}

$pid = [int]$listener.OwningProcess
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$pid"
Write-Host "Found listener PID $pid" -ForegroundColor Green
if ($process) { Write-Host ([string]$process.CommandLine) -ForegroundColor DarkGray }

$candidates = New-Object System.Collections.Generic.List[string]
function Add-Candidate([string]$path) {
    if ($path -and -not $candidates.Contains($path)) { $candidates.Add($path) }
}

Add-Candidate (Join-Path ([Environment]::GetFolderPath("Desktop")) "Ableton AI Control Bridge")
Add-Candidate (Join-Path $env:USERPROFILE "Desktop\Ableton AI Control Bridge")
Add-Candidate (Join-Path $env:USERPROFILE "OneDrive\Desktop\Ableton AI Control Bridge")
Add-Candidate (Join-Path $env:USERPROFILE "OneDrive\Escritorio\Ableton AI Control Bridge")

if ($process -and $process.CommandLine) {
    $cmd = [string]$process.CommandLine
    if ($cmd -match '--config\s+"([^"]+)"') { Add-Candidate (Split-Path -Parent $matches[1]) }
    elseif ($cmd -match '--config\s+([^\s]+)') { Add-Candidate (Split-Path -Parent $matches[1]) }
}

$projectRoot = $null
foreach ($candidate in $candidates) {
    if ((Test-Path (Join-Path $candidate "config.json")) -and (Test-Path (Join-Path $candidate ".venv\Scripts\python.exe"))) {
        $projectRoot = $candidate
        break
    }
}
if (-not $projectRoot) {
    throw ("Could not find the installed Ableton AI Control Bridge. Checked: " + ($candidates -join "; "))
}

$configPath = Join-Path $projectRoot "config.json"
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"
Write-Host "Active root: $projectRoot" -ForegroundColor Green

$importProbe = & $python -c "import ableton_bridge.commands as c; print(c.__file__)"
if ($LASTEXITCODE -ne 0 -or -not $importProbe) { throw "Could not resolve imported ableton_bridge.commands path." }
$commandsPath = [string]$importProbe | Select-Object -First 1
Write-Host "Imported commands.py: $commandsPath" -ForegroundColor Green

function Download-Atomic([string]$url, [string]$path) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
    $tmp = "$path.titan-new"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp
    if ((Get-Item $tmp).Length -lt 100) { throw "Downloaded file is unexpectedly small: $url" }
    Move-Item $tmp $path -Force
    Write-Host "Updated: $path" -ForegroundColor Green
}

Download-Atomic "$base/ableton_bridge/commands.py" $commandsPath
$receiverPaths = @(
    (Join-Path $projectRoot "Max for Live Device\bridge_receiver.js"),
    (Join-Path $projectRoot "max-for-live\bridge_receiver.js")
)
foreach ($receiverPath in $receiverPaths) {
    if (Test-Path (Split-Path -Parent $receiverPath)) {
        Download-Atomic "$base/max-for-live/bridge_receiver.js" $receiverPath
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

$probe = & $python -c "import ableton_bridge.commands as c; print('inspect_device_parameters_page' in c.COMMANDS); print(c.__file__)"
if ($LASTEXITCODE -ne 0 -or ($probe | Select-Object -First 1) -ne "True") {
    throw "Interpreter probe failed: updated command is not visible to active venv Python."
}
Write-Host "Interpreter probe: paged command present." -ForegroundColor Green

try { Stop-Process -Id $pid -Force -ErrorAction Stop } catch { }
Start-Sleep -Milliseconds 800

$arguments = @("-m", "ableton_bridge.server", "--config", $configPath)
Start-Process -FilePath $python -ArgumentList $arguments -WorkingDirectory $projectRoot

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
if (-not $hasPaged) { throw "Bridge restarted but paged audit command is still not exposed." }

Write-Host "TITAN runtime repair v3 complete." -ForegroundColor Cyan
