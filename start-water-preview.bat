@echo off
setlocal
cd /d "%~dp0"
node tools\water-preview\serve.mjs
if errorlevel 1 pause
endlocal
