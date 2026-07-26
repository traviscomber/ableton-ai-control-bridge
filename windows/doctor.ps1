[CmdletBinding()]
param([switch]$Quiet)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $ProjectRoot "config.json"
$DeviceDir = Join-Path $ProjectRoot "Max for Live Device"
$failed = $false

function Check($label, $condition, $detail) {
    if ($condition) { Write-Host "[OK]   $label" -ForegroundColor Green }
    else {
        Write-Host "[FAIL] $label - $detail" -ForegroundColor Red
        $script:failed = $true
    }
}

if (-not $Quiet) { Write-Host "Ableton AI Control Bridge diagnostics" -ForegroundColor Cyan }
$liveCandidates = @()
$programDataAbleton = Join-Path $env:ProgramData "Ableton"
if (Test-Path $programDataAbleton) {
    $liveCandidates = @(Get-ChildItem $programDataAbleton -Directory -Filter "Live 11*" -ErrorAction SilentlyContinue)
}
Check "Ableton Live 11 installation" ($liveCandidates.Count -gt 0) "No Live 11 folder found under $programDataAbleton"

$venvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
Check "Desktop package" ($ProjectRoot -eq (Join-Path ([Environment]::GetFolderPath("Desktop")) "Ableton AI Control Bridge")) "Run install.ps1 again"
Check "Python virtual environment" (Test-Path $venvPython) "Run windows\install.ps1"
Check "Bridge configuration" (Test-Path $ConfigPath) "Run windows\install.ps1"
Check "Max patch source" (Test-Path (Join-Path $DeviceDir "AI-Control-Bridge-Receiver.maxpat")) "Run windows\install.ps1"
Check "Max JavaScript engine" (Test-Path (Join-Path $DeviceDir "bridge_receiver.js")) "Run windows\install.ps1"

$configValid = $false
$config = $null
$httpHost = "127.0.0.1"
$httpPort = 8765
if (Test-Path $ConfigPath) {
    try {
        $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        $requiredFields = @("host", "port", "udp_host", "udp_port", "ack_host", "ack_port", "database", "token", "allow", "require_approval", "dry_run")
        $missingFields = @($requiredFields | Where-Object { $null -eq $config.PSObject.Properties[$_] })
        $configValid = $missingFields.Count -eq 0
        Check "Configuration schema" $configValid ("Missing field(s): " + ($missingFields -join ", "))
        if ($configValid) {
            $httpHost = [string]$config.host
            $httpPort = [int]$config.port
            Check "Local HTTP binding" ($httpHost -eq "127.0.0.1" -or $httpHost -eq "localhost") "Expected a loopback-only HTTP host"
            Check "Local UDP target" ($config.udp_host -eq "127.0.0.1" -or $config.udp_host -eq "localhost") "Expected a loopback-only Max receiver host"
            Check "Local ACK listener" ($config.ack_host -eq "127.0.0.1" -or $config.ack_host -eq "localhost") "Expected a loopback-only ACK host"
            Check "Authentication token" (-not [string]::IsNullOrWhiteSpace([string]$config.token)) "Token is empty"
            Check "Command allowlist" (@($config.allow).Count -gt 0) "Allowlist is empty"
        }
    } catch {
        Check "Configuration schema" $false ("config.json is invalid: " + $_.Exception.Message)
    }
}

$amxd = Get-ChildItem $DeviceDir -Filter "*.amxd" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -ne $amxd) {
    Write-Host "[OK]   Saved .amxd device" -ForegroundColor Green
} else {
    Write-Host "[TODO] Save the .maxpat as .amxd from Max for Live (one-time manual step)" -ForegroundColor Yellow
}

$bridgeRunning = $false
try {
    $busy = Get-NetTCPConnection -LocalPort $httpPort -State Listen -ErrorAction Stop
    $bridgeRunning = $null -ne $busy
    Write-Host "[INFO] HTTP port $httpPort is active; checking bridge health." -ForegroundColor Yellow
} catch {
    Write-Host "[OK]   HTTP port $httpPort is available" -ForegroundColor Green
}

if (Test-Path $venvPython) {
    & $venvPython -m unittest discover -s (Join-Path $ProjectRoot "tests") -q
    Check "Python test suite" ($LASTEXITCODE -eq 0) "Tests failed"

    if ($configValid) {
        $healthUrl = "http://${httpHost}:${httpPort}/health"
        $preflightArgs = @("-m", "ableton_bridge.preflight", "--config", $ConfigPath, "--health-url", $healthUrl, "--json")
        if ($bridgeRunning) { $preflightArgs += "--require-receiver" }
        $preflightOutput = & $venvPython @preflightArgs 2>&1
        $preflightExit = $LASTEXITCODE
        try {
            $preflight = ($preflightOutput -join [Environment]::NewLine) | ConvertFrom-Json
            if ($bridgeRunning) {
                Check "Bridge preflight" ($preflightExit -eq 0 -and $preflight.ok) "Bridge, authentication, transport, or receiver acknowledgement failed"
            } else {
                if ($preflightExit -eq 0) {
                    Write-Host "[OK]   Offline preflight configuration" -ForegroundColor Green
                } else {
                    Check "Offline preflight configuration" $false "Preflight reported a required configuration failure"
                }
                Write-Host "[INFO] Start the bridge and rerun diagnostics to verify Max receiver acknowledgement." -ForegroundColor Yellow
            }
        } catch {
            Check "Bridge preflight" $false "Preflight output could not be parsed"
        }
    }
}
if ($failed) { exit 1 }
exit 0
