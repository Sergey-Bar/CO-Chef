param([switch]$SkipBuild, [ValidateRange(1024, 65535)][int]$Port = 8000)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}

$backendPython = Join-Path $PSScriptRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $backendPython)) {
    Invoke-Checked python @('-m', 'venv', 'backend/.venv')
}
$requirements = Join-Path $PSScriptRoot 'backend/requirements.txt'
$stamp = Join-Path $PSScriptRoot 'backend/.venv/requirements.sha256'
$hash = (Get-FileHash $requirements -Algorithm SHA256).Hash
if (-not (Test-Path $stamp) -or (Get-Content $stamp -Raw).Trim() -ne $hash) {
    Invoke-Checked $backendPython @('-m', 'pip', 'install', '-r', $requirements)
    Set-Content $stamp $hash
}

if (-not $SkipBuild) {
    Push-Location (Join-Path $PSScriptRoot 'frontend')
    try {
        $frontendStamp = 'node_modules/.cochef-lock.sha256'
        $frontendHash = (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash
        if (-not (Test-Path $frontendStamp) -or (Get-Content $frontendStamp -Raw).Trim() -ne $frontendHash) {
            Invoke-Checked npm.cmd @('ci')
            Set-Content $frontendStamp $frontendHash
        }
        Invoke-Checked npm.cmd @('run', 'build')
    } finally { Pop-Location }
} elseif (-not (Test-Path 'frontend/dist/index.html')) {
    throw 'No frontend build exists. Run without -SkipBuild first.'
}

# An older server or another app may already be using the default port.
$requestedPort = $Port
while ($Port -le 65535) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try {
        $probe.Start()
        break
    } catch [System.Net.Sockets.SocketException] {
        $Port++
    } finally {
        $probe.Stop()
    }
}
if ($Port -gt 65535) { throw 'No available local port was found.' }
if ($Port -ne $requestedPort) {
    Write-Host "Port $requestedPort is already in use. Using port $Port instead."
}
Write-Host "Private Chef: http://127.0.0.1:$Port - press Ctrl+C to stop."
Push-Location (Join-Path $PSScriptRoot 'backend')
try {
    Invoke-Checked $backendPython @('-m', 'app.backup')
    Invoke-Checked $backendPython @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$Port")
}
finally { Pop-Location }
