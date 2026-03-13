@echo off
title Launch APIScan Ai
echo [1/3] Setting up environment paths...
set PATH=%PATH%;C:\Users\tnzxo\.cargo\bin

echo [2/3] Cleaning up old processes...
taskkill /F /IM apiscan-ai.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

echo [3/3] Starting application...
cd /d %~dp0
npx tauri dev
pause
