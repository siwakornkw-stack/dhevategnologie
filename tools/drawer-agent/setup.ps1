#requires -Version 5.1
# Dhevategnologie cashier setup - installs the cash-drawer agent and makes it autostart.
# Run via poscashiersetup.cmd (double-click).
# Messages are ASCII-only so they render on any Windows console.

$ErrorActionPreference = 'Stop'
$AgentPort = 7654
$InstallDir = Join-Path $env:LOCALAPPDATA 'dhevategnologie-drawer'
$Src = $PSScriptRoot

function Section($t) { Write-Host ''; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "  [OK] $t" -ForegroundColor Green }
function Warn($t)    { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Die($t)     { Write-Host "  [X]  $t" -ForegroundColor Red; Write-Host ''; Read-Host 'Press Enter to close'; exit 1 }

Write-Host 'Dhevategnologie - cashier setup (cash drawer + agent)' -ForegroundColor White

# --- 1. pick printer -------------------------------------------------------
Section 'Select printer'
$printers = @(Get-Printer | Select-Object -ExpandProperty Name)
if ($printers.Count -eq 0) {
  Die 'No printer found. Install the XP printer driver and plug in USB, then re-run.'
}
$auto = $printers | Where-Object { $_ -match 'XP-|POS|80|Xprinter|Thermal' } | Select-Object -First 1
$printer = $null
if ($auto -and $printers.Count -eq 1) {
  $printer = $auto
  Ok "Using printer: $printer"
} else {
  for ($i = 0; $i -lt $printers.Count; $i++) {
    $mark = if ($printers[$i] -eq $auto) { ' (recommended)' } else { '' }
    Write-Host ("  [{0}] {1}{2}" -f ($i + 1), $printers[$i], $mark)
  }
  $defIdx = if ($auto) { [array]::IndexOf($printers, $auto) + 1 } else { 1 }
  $sel = Read-Host "Pick number (Enter = $defIdx)"
  if ([string]::IsNullOrWhiteSpace($sel)) { $sel = $defIdx }
  $n = 0
  if (-not [int]::TryParse($sel, [ref]$n) -or $n -lt 1 -or $n -gt $printers.Count) { Die "Invalid number: $sel" }
  $printer = $printers[$n - 1]
  Ok "Selected: $printer"
}

# --- 2. ensure Node runtime (Win10 + Win11, no winget) ---------------------
Section 'Node.js runtime'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$NodeExe = $null
$sys = Get-Command node -ErrorAction SilentlyContinue
if ($sys) {
  $NodeExe = $sys.Source
  Ok ("System Node: " + (& node -v))
} else {
  Warn 'Node not found - downloading portable Node (no install)...'
  try { $idx = Invoke-RestMethod 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 20 }
  catch { Die 'Cannot reach internet to download Node. Connect and re-run, or install Node.js from https://nodejs.org' }
  $ver = ($idx | Where-Object { $_.lts } | Select-Object -First 1).version
  if (-not $ver) { Die 'Could not find a Node LTS version' }
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  $zipName = "node-$ver-win-$arch.zip"
  $url = "https://nodejs.org/dist/$ver/$zipName"
  $dl = Join-Path $env:TEMP $zipName
  Write-Host "  ...downloading $url"
  try { Invoke-WebRequest -Uri $url -OutFile $dl -UseBasicParsing -TimeoutSec 600 }
  catch { Die "Node download failed: $url" }
  $nodeDir = Join-Path $InstallDir 'node'
  if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
  Expand-Archive -Path $dl -DestinationPath $InstallDir -Force
  Rename-Item (Join-Path $InstallDir "node-$ver-win-$arch") $nodeDir
  Remove-Item $dl -Force -ErrorAction SilentlyContinue
  $NodeExe = Join-Path $nodeDir 'node.exe'
  if (-not (Test-Path $NodeExe)) { Die 'Node extract failed' }
  Ok ("Portable Node $ver : " + (& $NodeExe -v))
}

# --- 3. install agent files ------------------------------------------------
Section 'Install agent'
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
foreach ($f in @('agent.js', 'raw-print.ps1')) {
  $from = Join-Path $Src $f
  if (-not (Test-Path $from)) { Die "Missing file $f in setup folder" }
  Copy-Item $from (Join-Path $InstallDir $f) -Force
}
Ok "Copied files to $InstallDir"

# launcher that sets env + runs agent
$launcher = Join-Path $InstallDir 'run-agent.cmd'
@"
@echo off
cd /d "%~dp0"
set DRAWER_PRINTER=$printer
set DRAWER_PIN=0
set DRAWER_PORT=$AgentPort
"$NodeExe" agent.js
"@ | Set-Content -Path $launcher -Encoding ASCII
Ok 'Created run-agent.cmd'

# --- 4. autostart shortcut -------------------------------------------------
Section 'Autostart on boot'
$startup = [Environment]::GetFolderPath('Startup')
$lnkPath = Join-Path $startup 'dhevategnologie-drawer.lnk'
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $launcher
$lnk.WorkingDirectory = $InstallDir
$lnk.WindowStyle = 7  # minimized
$lnk.Description = 'Dhevategnologie cash drawer agent'
$lnk.Save()
Ok 'Added Startup shortcut'

# --- 5. start now ----------------------------------------------------------
Section 'Start agent'
# kill an old instance, then launch
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*agent.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Process -FilePath $launcher -WindowStyle Minimized

$healthy = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $r = Invoke-RestMethod "http://127.0.0.1:$AgentPort/health" -TimeoutSec 1
    if ($r.ok) { $healthy = $true; break }
  } catch { }
}
if ($healthy) { Ok "agent running (printer: $printer, port: $AgentPort)" }
else { Warn 'agent not responding to health - check the run-agent window for errors' }

# --- done ------------------------------------------------------------------
Write-Host ''
Write-Host 'READY' -ForegroundColor Green
Write-Host '  - Open POS in Chrome/Edge'
Write-Host '  - If the drawer does not open, set DRAWER_PIN=1 in:' -ForegroundColor DarkGray
Write-Host "    $launcher" -ForegroundColor DarkGray
Write-Host '  - Enable "Cash drawer" in POS Settings (once, shared by all PCs)' -ForegroundColor DarkGray
Write-Host ''
Read-Host 'Press Enter to close'
