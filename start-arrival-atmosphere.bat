@echo off
setlocal
cd /d "%~dp0"
node tools\arrival-atmosphere\serve.mjs
if errorlevel 1 pause
endlocal
