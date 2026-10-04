@echo off
setlocal

cd /d "%~dp0"
set "PORT=5189"

echo Checking port %PORT%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    echo Stopping process %%P on port %PORT%...
    taskkill /F /PID %%P >nul 2>&1
)

echo Starting Flannan at http://127.0.0.1:%PORT%/
call npm run dev

if errorlevel 1 (
    echo.
    echo Flannan stopped with an error.
    pause
)

endlocal
