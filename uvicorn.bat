@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%\Script"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  echo Uvicorn is already running on port 8000 with PID %%P.
  exit /b 0
)

echo Starting Uvicorn backend...
python -m uvicorn api:app --host 127.0.0.1 --port 8000
