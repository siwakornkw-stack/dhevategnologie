#requires -Version 5.1
# 88ARENA cashier setup — installs the cash-drawer agent and makes it autostart.
# Run via poscashiersetup.cmd (double-click).

$ErrorActionPreference = 'Stop'
$AgentPort = 7654
$InstallDir = Join-Path $env:LOCALAPPDATA '88arena-drawer'
$Src = $PSScriptRoot

function Section($t) { Write-Host ''; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "  [OK] $t" -ForegroundColor Green }
function Warn($t)    { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Die($t)     { Write-Host "  [X]  $t" -ForegroundColor Red; Write-Host ''; Read-Host 'กด Enter เพื่อปิด'; exit 1 }

Write-Host '88ARENA - ติดตั้งเครื่อง cashier (ลิ้นชัก + agent)' -ForegroundColor White

# --- 1. pick printer -------------------------------------------------------
Section 'เลือกเครื่องพิมพ์'
$printers = @(Get-Printer | Select-Object -ExpandProperty Name)
if ($printers.Count -eq 0) {
  Die 'ไม่พบเครื่องพิมพ์ในระบบ - ลง driver XP-Q80I แล้วเสียบ USB ก่อน แล้วรันใหม่'
}
$auto = $printers | Where-Object { $_ -match 'XP-|POS|80|Xprinter|Thermal' } | Select-Object -First 1
$printer = $null
if ($auto -and $printers.Count -eq 1) {
  $printer = $auto
  Ok "ใช้เครื่องพิมพ์: $printer"
} else {
  for ($i = 0; $i -lt $printers.Count; $i++) {
    $mark = if ($printers[$i] -eq $auto) { ' (แนะนำ)' } else { '' }
    Write-Host ("  [{0}] {1}{2}" -f ($i + 1), $printers[$i], $mark)
  }
  $defIdx = if ($auto) { [array]::IndexOf($printers, $auto) + 1 } else { 1 }
  $sel = Read-Host "เลือกหมายเลข (Enter = $defIdx)"
  if ([string]::IsNullOrWhiteSpace($sel)) { $sel = $defIdx }
  $n = 0
  if (-not [int]::TryParse($sel, [ref]$n) -or $n -lt 1 -or $n -gt $printers.Count) { Die "หมายเลขไม่ถูกต้อง: $sel" }
  $printer = $printers[$n - 1]
  Ok "เลือก: $printer"
}

# --- 2. ensure Node runtime (Win10 + Win11, no winget) ---------------------
Section 'Node.js runtime'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$NodeExe = $null
$sys = Get-Command node -ErrorAction SilentlyContinue
if ($sys) {
  $NodeExe = $sys.Source
  Ok ("ใช้ Node ในระบบ: " + (& node -v))
} else {
  Warn 'ไม่พบ Node ในระบบ - ดาวน์โหลด Node portable (ไม่ต้องติดตั้ง)...'
  try { $idx = Invoke-RestMethod 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 20 }
  catch { Die 'ต่อ internet เพื่อโหลด Node ไม่ได้ - เชื่อมเน็ตแล้วรันใหม่ หรือลง Node.js เองจาก https://nodejs.org' }
  $ver = ($idx | Where-Object { $_.lts } | Select-Object -First 1).version
  if (-not $ver) { Die 'หา Node LTS version ไม่เจอ' }
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  $zipName = "node-$ver-win-$arch.zip"
  $url = "https://nodejs.org/dist/$ver/$zipName"
  $dl = Join-Path $env:TEMP $zipName
  Write-Host "  ...โหลด $url"
  try { Invoke-WebRequest -Uri $url -OutFile $dl -UseBasicParsing -TimeoutSec 600 }
  catch { Die "โหลด Node ไม่สำเร็จ: $url" }
  $nodeDir = Join-Path $InstallDir 'node'
  if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
  Expand-Archive -Path $dl -DestinationPath $InstallDir -Force
  Rename-Item (Join-Path $InstallDir "node-$ver-win-$arch") $nodeDir
  Remove-Item $dl -Force -ErrorAction SilentlyContinue
  $NodeExe = Join-Path $nodeDir 'node.exe'
  if (-not (Test-Path $NodeExe)) { Die 'แตกไฟล์ Node ไม่สำเร็จ' }
  Ok ("Node portable $ver : " + (& $NodeExe -v))
}

# --- 3. install agent files ------------------------------------------------
Section 'ติดตั้ง agent'
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
foreach ($f in @('agent.js', 'raw-print.ps1')) {
  $from = Join-Path $Src $f
  if (-not (Test-Path $from)) { Die "ไม่พบไฟล์ $f ในโฟลเดอร์ setup" }
  Copy-Item $from (Join-Path $InstallDir $f) -Force
}
Ok "คัดลอกไฟล์ไป $InstallDir"

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
Ok 'สร้าง run-agent.cmd'

# --- 4. autostart shortcut -------------------------------------------------
Section 'ตั้งให้รันเองตอนเปิดเครื่อง'
$startup = [Environment]::GetFolderPath('Startup')
$lnkPath = Join-Path $startup '88arena-drawer.lnk'
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $launcher
$lnk.WorkingDirectory = $InstallDir
$lnk.WindowStyle = 7  # minimized
$lnk.Description = '88ARENA cash drawer agent'
$lnk.Save()
Ok "เพิ่ม shortcut ใน Startup"

# --- 5. start now ----------------------------------------------------------
Section 'เริ่ม agent'
# kill an old instance on the port, then launch
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
if ($healthy) { Ok "agent ทำงานแล้ว (printer: $printer, port: $AgentPort)" }
else { Warn 'agent ยังไม่ตอบ health - ดูหน้าต่าง run-agent ว่ามี error ไหม' }

# --- done ------------------------------------------------------------------
Write-Host ''
Write-Host 'พร้อมใช้งาน' -ForegroundColor Green
Write-Host '  - เปิด POS ด้วย Chrome/Edge ได้เลย'
Write-Host '  - ถ้าลิ้นชักไม่เด้ง แก้ DRAWER_PIN=1 ใน:' -ForegroundColor DarkGray
Write-Host "    $launcher" -ForegroundColor DarkGray
Write-Host '  - อย่าลืมติ๊ก "เปิดลิ้นชักเงินสด" ใน POS Settings (ทำครั้งเดียว ใช้ทุกเครื่อง)' -ForegroundColor DarkGray
Write-Host ''
Read-Host 'กด Enter เพื่อปิด'
