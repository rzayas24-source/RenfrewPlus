@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%\Frontend"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5174 .*LISTENING"') do (
  echo Vite is already running on port 5174 with PID %%P.
  exit /b 0
)

echo Starting Vite dev server...
npm run dev
