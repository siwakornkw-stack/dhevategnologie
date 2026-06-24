@echo off
rem DhevaSuite - double-click to set up this cashier PC (drawer + agent).
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
