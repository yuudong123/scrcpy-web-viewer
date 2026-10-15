@echo off
cd /d "%~dp0scrcpy-win64-v5.0.1"
scrcpy.exe --select-usb
if errorlevel 1 pause
