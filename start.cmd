@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
if errorlevel 1 (
    echo.
    echo Private Chef could not start. See the error above.
    pause
    exit /b 1
)
