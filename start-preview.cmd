@echo off
setlocal
title Qingchuang Pinpin Preview
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-preview.ps1" %*
if errorlevel 1 (
    echo.
    echo Preview could not start. Please check the message above.
    pause
    exit /b 1
)
endlocal
