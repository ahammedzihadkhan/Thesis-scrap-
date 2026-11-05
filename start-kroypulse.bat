@echo off
REM KroyPulse - runs only on this computer (http://127.0.0.1:4173). No data leaves the device.
cd /d "%~dp0"
where node >nul 2>nul || (echo Please install Node.js 20 or newer from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules call npm install --no-audit --no-fund
call npm start
