@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo Usage:
  echo   RUN TITAN AUDIO ANALYSIS.cmd "C:\path\to\renders" ["C:\path\to\titan-processing-plan.json"]
  echo.
  echo The render directory must contain PCM WAV stems or master renders.
  exit /b 2
)

set "RENDER_DIR=%~1"
set "PLAN_PATH=%~2"
if "%PLAN_PATH%"=="" set "PLAN_PATH=%~dp0titan-processing-plan.json"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0titan-audio-analysis-session.ps1" -RenderDir "%RENDER_DIR%" -PlanPath "%PLAN_PATH%" -OutputDir "%~dp0titan-audio-analysis"
set CODE=%ERRORLEVEL%

echo.
if not "%CODE%"=="0" (
  echo TITAN audio analysis failed with exit code %CODE%.
) else (
  echo TITAN audio analysis completed.
)
pause
exit /b %CODE%
