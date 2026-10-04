@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules\vite (
    echo Installing project dependencies...
    call npm install
    if errorlevel 1 goto failed
)
call npm run dev:vr
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo The VR preview could not start. See the error above.
pause
exit /b 1
