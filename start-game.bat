@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm were not found.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)

echo Starting the game...
echo Press Ctrl+C to stop the server.
call npm run dev
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo Failed to start the game.
pause
exit /b 1
