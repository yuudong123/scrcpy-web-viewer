@echo off
cd /d "%~dp0web"
node server.mjs
if errorlevel 1 pause
