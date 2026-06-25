@echo off
cd /d "%~dp0"
rem ===== Dhevategnologie cash-drawer agent =====
rem Set this to the EXACT printer name shown in Windows "Printers & scanners".
set DRAWER_PRINTER=XP-Q80I
rem Optional: lock to your POS origin, e.g. https://dhevasuite.vercel.app  (default * = any)
rem set DRAWER_ORIGIN=https://your-pos-domain
rem Optional: drawer connector pin. 0 = pin 2 (default), 1 = pin 5.
rem set DRAWER_PIN=0
node agent.js
pause
