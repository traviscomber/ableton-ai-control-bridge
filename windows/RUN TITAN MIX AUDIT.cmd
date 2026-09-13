@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo TITAN MIX AUDIT - LIVE 11 - READ ONLY
echo ============================================================
echo.
echo This does NOT change Ableton parameters.
echo It inventories EQ, dynamics, saturation, filters, utility,
echo spatial processors and limiters, then builds a review plan.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0titan-mix-audit-session.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if not "%EXITCODE%"=="0" (
  echo TITAN MIX AUDIT FAILED - code %EXITCODE%
) else (
  echo TITAN MIX AUDIT COMPLETE
  echo Send titan-processing-audit-v2.json back to ChatGPT/TITAN.
)
echo.
pause
exit /b %EXITCODE%
