@echo off
setlocal
cd /d "%~dp0\..\.."

if exist ".venv\Scripts\python.exe" (
  set "PYTHON=.venv\Scripts\python.exe"
) else (
  set "PYTHON=python"
)

"%PYTHON%" -m darksco.cli "production\night-protocol-001\song-plan.json" --output "production\night-protocol-001\commands.jsonl"
if errorlevel 1 (
  echo.
  echo Night Protocol 001 command compilation failed.
  pause
  exit /b 1
)

"%PYTHON%" -m ableton_bridge.runner "production\night-protocol-001\commands.jsonl" --validate-only
if errorlevel 1 (
  echo.
  echo Night Protocol 001 command validation failed.
  pause
  exit /b 1
)

echo.
echo Night Protocol 001 commands are ready:
echo production\night-protocol-001\commands.jsonl
pause
