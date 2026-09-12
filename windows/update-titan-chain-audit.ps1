[CmdletBinding()]
param([switch]$NoRestart)

$ErrorActionPreference = "Stop"
$ProjectRoot = Join-Path ([Environment]::GetFolderPath("Desktop")) "Ableton AI Control Bridge"
$CommandsPath = Join-Path $ProjectRoot "ableton_bridge\commands.py"
$DeviceDir = Join-Path $ProjectRoot "Max for Live Device"
$MaxSourceDir = Join-Path $ProjectRoot "max-for-live"
$ReceiverDevicePath = Join-Path $DeviceDir "bridge_receiver.js"
$ReceiverSourcePath = Join-Path $MaxSourceDir "bridge_receiver.js"
$ConfigPath = Join-Path $ProjectRoot "config.json"
$StartBridge = Join-Path $ProjectRoot "windows\start-bridge.ps1"

if (-not (Test-Path $ProjectRoot)) {
    throw "Ableton AI Control Bridge is not installed at: $ProjectRoot"
}
if (-not (Test-Path $ConfigPath)) {
    throw "Missing config.json at: $ConfigPath"
}

Write-Host "TITAN Chain Audit updater" -ForegroundColor Cyan
Write-Host "Install root: $ProjectRoot" -ForegroundColor DarkGray

$base = "https://raw.githubusercontent.com/traviscomber/ableton-ai-control-bridge/main"
$downloads = @(
    @{ Url = "$base/ableton_bridge/commands.py"; Path = $CommandsPath },
    @{ Url = "$base/max-for-live/bridge_receiver.js"; Path = $ReceiverDevicePath },
    @{ Url = "$base/max-for-live/bridge_receiver.js"; Path = $ReceiverSourcePath }
)

foreach ($item in $downloads) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $item.Path) | Out-Null
    $temp = "$($item.Path).new"
    Invoke-WebRequest -UseBasicParsing -Uri $item.Url -OutFile $temp
    if ((Get-Item $temp).Length -lt 100) { throw "Downloaded file is unexpectedly small: $($item.Url)" }
    Move-Item $temp $item.Path -Force
    Write-Host "Updated: $($item.Path)" -ForegroundColor Green
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$current = @()
if ($null -ne $config.allow) { $current = @($config.allow | ForEach-Object { [string]$_ }) }
$required = @(
    "get_live_state",
    "list_tracks",
    "inspect_track",
    "list_returns",
    "inspect_device_chain",
    "inspect_device_parameters",
    "inspect_device_parameters_page",
    "inspect_clip",
    "inspect_master",
    "capture_mixer_snapshot",
    "restore_mixer_snapshot",
    "capture_device_snapshot",
    "restore_device_snapshot"
)
$merged = @($current + $required | Sort-Object -Unique)
$config.allow = $merged
$config | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $ConfigPath
Write-Host "Preserved existing permissions and added TITAN read/audit commands." -ForegroundColor Green

$bridgeProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.CommandLine -like "*ableton_bridge.server*") -or ($_.CommandLine -like "*Ableton AI Control Bridge*start-bridge.ps1*")
}
if ($bridgeProcesses) {
    Write-Host "Stopping old local bridge process so updated Python code is loaded..." -ForegroundColor Yellow
    foreach ($process in $bridgeProcesses) {
        try { Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop } catch { }
    }
    Start-Sleep -Milliseconds 700
}

if (-not $NoRestart) {
    if (-not (Test-Path $StartBridge)) { throw "Missing bridge launcher: $StartBridge" }
    Write-Host "Starting updated bridge..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"' + $StartBridge + '"')
    )
}

Write-Host "" 
Write-Host "Update complete." -ForegroundColor Green
Write-Host "The Max JS receiver uses autowatch=1. If the loaded device does not refresh automatically, reopen the AI Control Bridge Receiver device in Live once." -ForegroundColor White
Write-Host "Verify http://127.0.0.1:8765/health contains inspect_device_parameters_page before running the full audit." -ForegroundColor White
