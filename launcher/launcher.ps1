# "Passeport civique" launcher for Windows (a PowerShell script rather than an .exe, which antivirus tools often block):
#   - serves the interface (dist folder next to this script) on http://localhost:47821
#   - saves progress to %APPDATA%\CivicTR\state.json (+ daily backups)
#   - proxies /ollama/* to Ollama (local AI, 127.0.0.1:11434), streaming
#   - opens the app in a dedicated Edge window and stops when it is closed.
# Useful in development: CIVICTR_PORT, CIVICTR_OLLAMA, CIVICTR_DATA, CIVICTR_NO_BROWSER.
$ErrorActionPreference = 'Stop'

$AppId = 'CivicTR'
$Version = '1.1.0'
$Dist = Join-Path $PSScriptRoot 'dist'

$base = if ($env:CIVICTR_DATA) { $env:CIVICTR_DATA } else { $env:APPDATA }
$DataDir = Join-Path $base $AppId
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'backups') | Out-Null
$Ollama = if ($env:CIVICTR_OLLAMA) { $env:CIVICTR_OLLAMA.TrimEnd('/') } else { 'http://127.0.0.1:11434' }
$Port = 47821
if ($env:CIVICTR_PORT -as [int]) { $Port = [int]$env:CIVICTR_PORT }

$S = [hashtable]::Synchronized(@{
  AppId = $AppId; Version = $Version; Dist = $Dist; DataDir = $DataDir; Ollama = $Ollama
  LogPath = Join-Path $DataDir 'launcher.log'; Lock = New-Object object
  LastPing = [DateTime]::Now.AddMinutes(2); Sys = $null
})
Set-Content -Path $S.LogPath -Value '' -Encoding UTF8

function Log($msg) {
  [Threading.Monitor]::Enter($S.Lock)
  try { Add-Content -Path $S.LogPath -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f [DateTime]::Now, $msg) -Encoding UTF8 } finally { [Threading.Monitor]::Exit($S.Lock) }
}

function Fatal($msg) {
  Log $msg
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($msg, 'Passeport civique', 'OK', 'Error') | Out-Null
  exit 1
}

function Find-Edge {
  foreach ($b in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
    if (-not $b) { continue }
    $p = Join-Path $b 'Microsoft\Edge\Application\msedge.exe'
    if (Test-Path $p) { return $p }
  }
  return $null
}

# Opens the app in a dedicated Edge window (no address bar).
# Returns the Edge process, or $null if the default browser had to be used.
function Open-Window($url) {
  $edge = Find-Edge
  if ($edge) {
    try {
      return Start-Process -FilePath $edge -PassThru -ArgumentList @(
        "--app=$url", "--user-data-dir=`"$(Join-Path $DataDir 'fenetre')`"",
        '--no-first-run', '--no-default-browser-check',
        '--disable-features=Translate,msUndersideButton', '--window-size=1400,920')
    } catch { Log "Edge: $_" }
  }
  Start-Process $url
  return $null
}

function Test-Url($url, $ms) {
  try {
    $r = [Net.WebRequest]::Create($url); $r.Timeout = $ms; $r.Proxy = $null
    $resp = $r.GetResponse()
    $txt = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
    $resp.Close()
    return $txt
  } catch { return $null }
}

Log "$AppId $Version (PowerShell) - data: $DataDir"
if (-not (Test-Path (Join-Path $Dist 'index.html'))) { Fatal "Interface manquante : $Dist" }

# Already running? Just open a new window.
$hello = Test-Url "http://localhost:$Port/api/hello" 800
if ($hello -and $hello -match '"app":\s*"CivicTR"') {
  Log "already running on port $Port, opening a window"
  Open-Window "http://localhost:$Port/" | Out-Null
  exit 0
}

# "localhost" (not 127.0.0.1): the only prefix allowed without admin rights.
$listener = $null
foreach ($p in @($Port) + (47822..47840)) {
  $l = New-Object Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break } catch { Log "port $p unavailable: $($_.Exception.Message)"; $l.Close() }
}
if (-not $listener) { Fatal 'Impossible de demarrer le serveur local.' }
$AppUrl = "http://localhost:$Port/"
[Net.ServicePointManager]::DefaultConnectionLimit = 32

# ---------- Request handling (several threads, so Coco's stream does not block the rest) ----------
$worker = {
  param($listener, $S)
  $ErrorActionPreference = 'Stop'
  $mime = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
    '.json' = 'application/json'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'
    '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.webp' = 'image/webp'; '.jpg' = 'image/jpeg'; '.mp3' = 'audio/mpeg'
  }
  $utf8 = New-Object Text.UTF8Encoding($false)

  function Log($msg) {
    [Threading.Monitor]::Enter($S.Lock)
    try { Add-Content -Path $S.LogPath -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f [DateTime]::Now, $msg) -Encoding UTF8 } finally { [Threading.Monitor]::Exit($S.Lock) }
  }
  function Send($res, [int]$code, [byte[]]$bytes, $type) {
    $res.StatusCode = $code
    if ($type) { $res.ContentType = $type }
    if ($bytes) { $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length) }
  }
  function SendJson($res, [int]$code, $obj) {
    $res.Headers['Cache-Control'] = 'no-store'
    Send $res $code ($utf8.GetBytes(($obj | ConvertTo-Json -Compress))) 'application/json'
  }
  function ReadBody($req) {
    $ms = New-Object IO.MemoryStream
    $req.InputStream.CopyTo($ms)
    return $ms.ToArray()
  }

  function Handle-State($req, $res) {
    $path = Join-Path $S.DataDir 'state.json'
    if ($req.HttpMethod -eq 'GET') {
      $res.Headers['Cache-Control'] = 'no-store'
      [Threading.Monitor]::Enter($S.Lock)
      try { $b = if (Test-Path $path) { [IO.File]::ReadAllBytes($path) } else { $null } } finally { [Threading.Monitor]::Exit($S.Lock) }
      Send $res 200 $b 'application/json' # no progress yet: empty body
      return
    }
    if ($req.HttpMethod -ne 'PUT' -and $req.HttpMethod -ne 'POST') { Send $res 405 $null $null; return }
    $b = ReadBody $req
    $txt = $utf8.GetString($b).Trim()
    if ($b.Length -gt 64MB -or -not ($txt.StartsWith('{') -and $txt.EndsWith('}'))) {
      SendJson $res 400 @{ error = 'etat invalide' }; return
    }
    [Threading.Monitor]::Enter($S.Lock)
    try {
      New-Item -ItemType Directory -Force -Path (Join-Path $S.DataDir 'backups') | Out-Null # in case the folder was deleted
      $tmp = "$path.tmp"
      [IO.File]::WriteAllBytes($tmp, $b)
      if (Test-Path $path) { [IO.File]::Replace($tmp, $path, [NullString]::Value) } else { [IO.File]::Move($tmp, $path) }
      # One backup per day, the last 30 are kept.
      $bk = Join-Path $S.DataDir ("backups\state-{0:yyyy-MM-dd}.json" -f [DateTime]::Now)
      [IO.File]::WriteAllBytes($bk, $b)
      Get-ChildItem (Join-Path $S.DataDir 'backups') -Filter 'state-*.json' | Sort-Object Name |
        Select-Object -SkipLast 30 | Remove-Item -Force
    } finally { [Threading.Monitor]::Exit($S.Lock) }
    Send $res 204 $null $null
  }

  function Handle-System($res) {
    if (-not $S.Sys) {
      $info = @{ os = 'windows' }
      try {
        $line = (& nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1)
        $parts = "$line".Split(',')
        if ($parts.Count -eq 2) { $info.gpu_name = $parts[0].Trim(); $info.vram_mb = [int]$parts[1].Trim() }
      } catch { }
      $S.Sys = $info
    }
    SendJson $res 200 $S.Sys
  }

  function Handle-Ollama($req, $res) {
    $target = $S.Ollama + $req.Url.AbsolutePath.Substring('/ollama'.Length) + $req.Url.Query
    $body = if ($req.HasEntityBody) { ReadBody $req } else { $null }
    try {
      $up = [Net.HttpWebRequest]::Create($target)
      $up.Method = $req.HttpMethod; $up.Proxy = $null
      $up.Timeout = [Threading.Timeout]::Infinite; $up.ReadWriteTimeout = 30 * 60 * 1000
      if ($body) {
        $up.ContentType = if ($req.ContentType) { $req.ContentType } else { 'application/json' }
        $up.ContentLength = $body.Length
        $s = $up.GetRequestStream(); $s.Write($body, 0, $body.Length); $s.Close()
      }
      try { $resp = $up.GetResponse() } catch [Net.WebException] {
        if (-not $_.Exception.Response) { throw }
        $resp = $_.Exception.Response
      }
    } catch {
      SendJson $res 502 @{ error = "Ollama injoignable : $($_.Exception.Message)" }; return
    }
    try {
      $res.StatusCode = [int]$resp.StatusCode
      if ($resp.ContentType) { $res.ContentType = $resp.ContentType }
      $res.SendChunked = $true # streamed answers (Coco's text shows as it comes)
      $in = $resp.GetResponseStream(); $out = $res.OutputStream
      $buf = New-Object byte[] 8192
      while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) { $out.Write($buf, 0, $n); $out.Flush() }
    } finally { $resp.Close() }
  }

  function Handle-Static($req, $res) {
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    $file = $null
    if ($rel -and $rel -ne 'index.html') {
      $full = [IO.Path]::GetFullPath((Join-Path $S.Dist $rel))
      if ($full.StartsWith($S.Dist, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $full -PathType Leaf)) { $file = $full }
    }
    if (-not $file) {
      $res.Headers['Cache-Control'] = 'no-cache'
      Send $res 200 ([IO.File]::ReadAllBytes((Join-Path $S.Dist 'index.html'))) 'text/html; charset=utf-8'
      return
    }
    if ($rel.StartsWith('assets/')) { $res.Headers['Cache-Control'] = 'public, max-age=31536000, immutable' }
    $type = $mime[[IO.Path]::GetExtension($file).ToLower()]
    if (-not $type) { $type = 'application/octet-stream' }
    Send $res 200 ([IO.File]::ReadAllBytes($file)) $type
  }

  while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $p = $req.Url.AbsolutePath
      if ($p -eq '/api/hello') { SendJson $res 200 @{ app = $S.AppId; version = $S.Version } }
      elseif ($p -eq '/api/ping') { $S.LastPing = [DateTime]::Now; Send $res 204 $null $null }
      elseif ($p -eq '/api/state') { Handle-State $req $res }
      elseif ($p -eq '/api/system') { Handle-System $res }
      elseif ($p.StartsWith('/ollama/')) { Handle-Ollama $req $res }
      else { Handle-Static $req $res }
    } catch {
      Log "$($req.HttpMethod) $($req.Url.AbsolutePath) : $($_.Exception.Message)"
      try { $res.StatusCode = 500 } catch { }
    } finally {
      try { $res.Close() } catch { }
    }
  }
}

$S.Dist = [IO.Path]::GetFullPath($Dist).TrimEnd('\') + '\'
$pool = [RunspaceFactory]::CreateRunspacePool(1, 8)
$pool.Open()
$jobs = foreach ($i in 1..8) {
  $ps = [PowerShell]::Create()
  $ps.RunspacePool = $pool
  [void]$ps.AddScript($worker).AddArgument($listener).AddArgument($S)
  [pscustomobject]@{ PS = $ps; Handle = $ps.BeginInvoke() }
}
Log "interface: $AppUrl - Ollama: $Ollama"

# Starts Ollama if it is installed but not running.
if (-not (Test-Url "$Ollama/api/version" 2000)) {
  $od = Join-Path $env:LOCALAPPDATA 'Programs\Ollama'
  $app = Join-Path $od 'ollama app.exe'; $exe = Join-Path $od 'ollama.exe'
  if (Test-Path $app) { Log "starting Ollama: $app"; Start-Process $app }
  elseif (Test-Path $exe) { Log "starting Ollama: $exe"; Start-Process $exe -ArgumentList 'serve' -WindowStyle Hidden }
  else { Log "Ollama not found: the AI tutor will be unavailable" }
} else { Log 'Ollama is up' }

try {
  if ($env:CIVICTR_NO_BROWSER) {
    Write-Host "Passeport civique: $AppUrl (Ctrl+C to stop)"
    while ($true) { Start-Sleep -Seconds 1 } # development mode
  }
  $edge = Open-Window $AppUrl
  if ($edge) {
    $edge.WaitForExit() # the dedicated window was closed
    Log 'window closed, stopping'
    Start-Sleep -Milliseconds 1500 # let the last save finish
  } else {
    # Default browser: stop after 2 minutes without a heartbeat from the page.
    while (([DateTime]::Now - $S.LastPing).TotalMinutes -lt 2) { Start-Sleep -Seconds 10 }
    Log "no heartbeat from the page, stopping"
  }
} finally {
  $listener.Stop(); $listener.Close()
  foreach ($j in $jobs) { $j.PS.Dispose() }
  $pool.Close()
}
