# Tenure — ProtoTwin Bridge PowerShell Runner
Set-Location $PSScriptRoot

if (Test-Path ".venv\Scripts\python.exe") {
    Write-Host "[bridge] Running with project virtualenv (.venv)..." -ForegroundColor Cyan
    & ".\.venv\Scripts\python.exe" scripts/prototwin_bridge.py $args
} else {
    Write-Host "[bridge] Running with py -3.11 launcher..." -ForegroundColor Cyan
    & py -3.11 scripts/prototwin_bridge.py $args
}
