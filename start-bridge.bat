@echo off
title Ableton AI Control Bridge

cls
echo.
echo ========================================
echo   Ableton AI Control Bridge
echo ========================================
echo.
echo Starting on http://127.0.0.1:8765
echo Config: bridge.config.json (no token required)
echo.
echo Diagnostic: python bridge-diagnostic.py
echo.
timeout /t 2 /nobreak

:: Navigate to project folder (same folder as this .bat file)
cd /d "%~dp0"

:: Clear token from environment so bridge.config.json wins
set ABLETON_BRIDGE_TOKEN=

:: Install if not already installed
pip show ableton-bridge >nul 2>&1
if errorlevel 1 (
    echo Installing ableton_bridge...
    pip install -e .
    if errorlevel 1 (
        echo.
        echo ERROR: pip install failed. Make sure Python is installed.
        pause
        exit /b 1
    )
    echo Done.
    echo.
)

:: Launch with config file — token is null inside bridge.config.json
:: This overrides any ABLETON_BRIDGE_TOKEN env var on your machine
python -m ableton_bridge --config bridge.config.json

echo.
echo Bridge stopped.
pause
