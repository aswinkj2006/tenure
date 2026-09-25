@echo off
REM Tenure — ProtoTwin Bridge Runner
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    echo [bridge] Using project virtualenv
    ".venv\Scripts\python.exe" scripts\prototwin_bridge.py %*
) else (
    echo [bridge] Using Python 3.11 launcher
    py -3.11 scripts\prototwin_bridge.py %*
)
