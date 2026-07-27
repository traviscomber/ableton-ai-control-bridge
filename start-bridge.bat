@echo off
REM Ableton AI Control Bridge Launcher
REM This script starts the WebSocket bridge for Ableton Live

cls
echo.
echo ========================================
echo   Ableton AI Control Bridge
echo ========================================
echo.
echo Starting WebSocket server...
echo Listen on: ws://127.0.0.1:8765
echo.

python -m ableton_bridge

REM Keep window open if there's an error
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start bridge
    echo Make sure Python is installed and ableton_bridge module is available
    pause
)
