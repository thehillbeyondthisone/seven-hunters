@echo off
setlocal
cd /d "%~dp0"
curl.exe --silent --fail http://127.0.0.1:5189/ >nul 2>&1
if not errorlevel 1 (
    start "" "http://127.0.0.1:5189/?playground"
    exit /b 0
)
call npm run dev -- --open "/?playground" --strictPort
if errorlevel 1 pause
endlocal
