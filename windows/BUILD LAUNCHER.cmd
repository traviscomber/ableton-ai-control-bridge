@echo off
setlocal
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-launcher.ps1"
if errorlevel 1 (
  echo.
  echo Launcher build failed. Review the error above.
  pause
  exit /b 1
)
echo.
echo Build complete. Open the dist folder for Ableton Bridge Launcher.exe.
pause
