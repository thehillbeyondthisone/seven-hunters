@echo off
cd /d "%~dp0"
node tools\grass-study\setup.mjs
if errorlevel 1 goto failed
node tools\grass-study\serve.mjs
goto end
:failed
echo Grass preview setup did not finish. See the message above.
pause
:end
