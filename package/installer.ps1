# Installs "Passeport civique" on Windows 10/11.
# 1. copies the app to %LOCALAPPDATA%\Programs\PasseportCivique
# 2. creates the shortcuts (Desktop + Start menu)
# 3. if wanted: installs Ollama (local AI) and the model that suits the graphics card.
#    The app also works without AI; Coco can be added later by running this script again.
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $env:LOCALAPPDATA 'Programs\PasseportCivique'
$Launcher = Join-Path $AppDir 'launcher.ps1'
$PsExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$PsArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Launcher`""

function Step($n, $text) { Write-Host ""; Write-Host "[$n/4] $text" -ForegroundColor Cyan }
function Done {
  Write-Host ""
  Write-Host "Installation complete!" -ForegroundColor Green
  Write-Host "Open 'Passeport civique' from the Desktop."
  $answer = Read-Host "Start the app now? (Y/n)"
  if ($answer -notmatch '^[nN]') { Start-Process $PsExe -ArgumentList $PsArgs -WindowStyle Hidden }
}

Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "   Passeport civique - installation" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta

# 1. App
Step 1 "Copying the app"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
Remove-Item (Join-Path $AppDir 'dist') -Recurse -Force -ErrorAction SilentlyContinue # files of the previous version
Copy-Item (Join-Path $Here 'app\*') $AppDir -Recurse -Force
Get-ChildItem $AppDir -Recurse -File | Unblock-File
Write-Host "    -> $AppDir"

# 2. Shortcuts
Step 2 "Shortcuts on the Desktop and in the Start menu"
$ws = New-Object -ComObject WScript.Shell
$targets = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))
foreach ($dir in $targets) {
  $lnk = $ws.CreateShortcut((Join-Path $dir 'Passeport civique.lnk'))
  $lnk.TargetPath = $PsExe
  $lnk.Arguments = $PsArgs
  $lnk.WorkingDirectory = $AppDir
  $lnk.WindowStyle = 7 # minimized: avoids the PowerShell console flash
  $lnk.IconLocation = (Join-Path $AppDir 'coco.ico') + ',0'
  $lnk.Description = 'Prepare the French civic exam'
  $lnk.Save()
}
Write-Host "    -> 'Passeport civique' shortcut created"

# 3. Coco, the AI tutor (optional)
# From here on we run external programs (winget, nvidia-smi, ollama): their errors are handled here.
$ErrorActionPreference = 'Continue'
Step 3 "Coco, the AI tutor (optional)"
$vram = 0
try {
  $line = & nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1
  if ($line) { $parts = $line.Split(','); $gpu = $parts[0].Trim(); $vram = [int]$parts[1].Trim() }
} catch { }
# Same tiers as in the app (web/src/lib/ai.js)
if ($vram -ge 20000) { $model = 'gemma4:26b' }
elseif ($vram -ge 10000) { $model = 'gemma3:12b' }
elseif ($vram -ge 6000) { $model = 'gemma4:e4b' }
else { $model = 'gemma3:4b' }
Write-Host "    Coco explains the questions in your language. It runs on this computer (nothing is sent online),"
Write-Host "    but it needs a fairly powerful computer and a download of several GB."
Write-Host "    The app works very well without AI, and Coco can be added later by running Installer.bat again."
if ($vram -gt 0) {
  Write-Host "    Graphics card: $gpu ($([math]::Round($vram/1024)) GB) -> advised model: $model"
  $default = 'y'
} else {
  Write-Host "    No NVIDIA graphics card found: Coco would be slow (light model $model, 3.4 GB)."
  $default = 'n'
}
$answer = Read-Host "    Install Coco? (y/n, Enter = $default)"
if (-not $answer) { $answer = $default }
if ($answer -notmatch '^[yYoO]') {
  Write-Host "    -> without AI. To add Coco later: run Installer.bat again."
  Done
  exit 0
}

$OllamaDir = Join-Path $env:LOCALAPPDATA 'Programs\Ollama'
$OllamaExe = Join-Path $OllamaDir 'ollama.exe'
if (Test-Path $OllamaExe) {
  Write-Host "    -> Ollama is already installed"
} else {
  Write-Host "    Installing Ollama (about 1 GB, a few minutes)..."
  $ok = $false
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try {
      winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
      $ok = Test-Path $OllamaExe
    } catch { $ok = $false }
  }
  if (-not $ok) {
    $setup = Join-Path $env:TEMP 'OllamaSetup.exe'
    Write-Host "    Downloading the official installer..."
    Invoke-WebRequest 'https://ollama.com/download/OllamaSetup.exe' -OutFile $setup -UseBasicParsing
    Start-Process $setup -Wait
  }
  if (-not (Test-Path $OllamaExe)) {
    Write-Host "    !! Ollama could not be installed automatically." -ForegroundColor Yellow
    Write-Host "    Install it from https://ollama.com/download, then run Installer.bat again." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
  }
}

# Start Ollama if needed and wait until it answers
function OllamaUp { try { Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 | Out-Null; return $true } catch { return $false } }
if (-not (OllamaUp)) {
  $app = Join-Path $OllamaDir 'ollama app.exe'
  if (Test-Path $app) { Start-Process $app } else { Start-Process $OllamaExe -ArgumentList 'serve' -WindowStyle Hidden }
  for ($i = 0; $i -lt 40 -and -not (OllamaUp); $i++) { Start-Sleep -Seconds 1 }
}
if (-not (OllamaUp)) {
  Write-Host "    !! Ollama does not answer. Restart the computer, then run Installer.bat again." -ForegroundColor Yellow
  Read-Host "Press Enter to close"
  exit 1
}
Write-Host "    -> Ollama is running"

# 4. AI model chosen above from the graphics card memory
Step 4 "AI model for Coco"
Write-Host "    Model: $model (a download of several GB, please wait...)"
& $OllamaExe pull $model
if ($LASTEXITCODE -ne 0) {
  Write-Host "    !! The download failed. It can be started again from the app: Settings (Reglages) > AI tutor (Assistant IA)." -ForegroundColor Yellow
}

Done
