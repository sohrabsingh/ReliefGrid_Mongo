# The one command: takes a fresh checkout of this repo (no node_modules, no .env, no
# database yet) all the way to a running app at http://localhost:5173, and opens it.
# Safe to re-run any time - it only does setup steps that are actually missing, then
# hands off to restart.ps1 for the stop/clean/start cycle.
#
# Usage:
#   powershell -File run.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$MongoBin = "C:\Program Files\MongoDB\Server\8.3\bin"

Write-Output "=== Checking prerequisites ==="

if (-not (Test-Path "$MongoBin\mongod.exe")) {
    Write-Output @"
MongoDB Server not found at:
  $MongoBin

Either:
  - install MongoDB Community Server (https://www.mongodb.com/try/download/community)
    and update `$MongoBin at the top of this script and restart.ps1 to match, or
  - use Docker instead: docker compose up -d  (see README.md, then set MONGODB_URI
    in server\.env and skip this script - just run server + client manually)
"@
    exit 1
}
Write-Output "MongoDB Server found."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Output "Node.js not found on PATH. Install it from https://nodejs.org first."
    exit 1
}
Write-Output "Node.js found: $(node --version)"

if (-not (Test-Path (Join-Path $Root "server\node_modules"))) {
    Write-Output "`n=== Installing backend dependencies (first run) ==="
    Push-Location (Join-Path $Root "server")
    npm install
    Pop-Location
} else {
    Write-Output "Backend dependencies already installed."
}

if (-not (Test-Path (Join-Path $Root "client\node_modules"))) {
    Write-Output "`n=== Installing frontend dependencies (first run) ==="
    Push-Location (Join-Path $Root "client")
    npm install
    Pop-Location
} else {
    Write-Output "Frontend dependencies already installed."
}

$envPath = Join-Path $Root "server\.env"
if (-not (Test-Path $envPath)) {
    Write-Output "`n=== Creating server\.env from .env.example (first run) ==="
    Copy-Item (Join-Path $Root "server\.env.example") $envPath
} else {
    Write-Output "server\.env already exists."
}

Write-Output "`n=== Starting the stack (delegating to restart.ps1) ==="
& (Join-Path $Root "restart.ps1")

Write-Output "`n=== Opening the app ==="
Start-Process "http://localhost:5173"

Write-Output @"

Everything's up:
  Frontend: http://localhost:5173
  Backend:  http://localhost:4000
  Logins:   officer1/officer123, volunteer1/volunteer123, citizen1/citizen123

Run this again any time things get into a weird state - it's safe to re-run.
For a full data wipe + fresh reseed instead, use: powershell -File restart.ps1 -Reseed
"@
