@echo off
setlocal
cd /d "%~dp0"
node tools\sea-dread\serve.mjs
if errorlevel 1 pause
endlocal
