# Stops everything (via stop.ps1), clears build/log garbage, and starts the whole
# stack fresh: dev mongod (27018) -> backend (:4000) -> frontend (:5173).
#
# Usage:
#   powershell -File restart.ps1              # restart, keep existing seeded data
#   powershell -File restart.ps1 -Reseed       # wipe the dev database and reseed fresh
#
# Always stops the sharding demo cluster too (ports 27019-27022), if it's running -
# that's a separate thing you start on purpose (server\scripts\sharding\start-cluster.ps1),
# not part of the normal dev stack, so a "clean slate" restart shouldn't leave it up.

param(
    [switch]$Reseed
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$MongoBin = "C:\Program Files\MongoDB\Server\8.3\bin"
$Mongosh = "C:\Program Files\mongosh\mongosh.exe"
$DataDir = Join-Path $Root ".mongo-data"

Write-Output "=== Stopping everything ==="
& (Join-Path $Root "stop.ps1")
Start-Sleep -Seconds 1

Write-Output "`n=== Clearing build/log garbage ==="
$garbage = @(
    (Join-Path $Root "client\dist"),
    (Join-Path $DataDir "mongod.log"),
    (Join-Path $Root ".mongo-shard\config\mongod.log"),
    (Join-Path $Root ".mongo-shard\shard1\mongod.log"),
    (Join-Path $Root ".mongo-shard\shard2\mongod.log"),
    (Join-Path $Root ".mongo-shard\mongos.log")
)
foreach ($path in $garbage) {
    if (Test-Path $path) {
        Write-Output "Removing $path"
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($Reseed -and (Test-Path $DataDir)) {
    Write-Output "Removing $DataDir (fresh database requested with -Reseed)"
    Remove-Item -Path $DataDir -Recurse -Force
}

Write-Output "`n=== Starting dev mongod (port 27018) ==="
$freshDb = -not (Test-Path $DataDir)
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
Start-Process -FilePath "$MongoBin\mongod.exe" -WindowStyle Hidden -ArgumentList `
    "--replSet rs0 --port 27018 --dbpath `"$DataDir`" --bind_ip 127.0.0.1 --logpath `"$DataDir\mongod.log`""
Start-Sleep -Seconds 4

if ($freshDb) {
    Write-Output "Fresh data directory - initiating replica set (one-time)"
    & $Mongosh --port 27018 --quiet --eval "rs.initiate({_id:'rs0', members:[{_id:0,host:'localhost:27018'}]})"
    Start-Sleep -Seconds 2
}

Write-Output "`n=== Starting backend (:4000) ==="
Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -WorkingDirectory (Join-Path $Root "server") `
    -ArgumentList "-NoLogo -Command `"npm run dev`""

if ($Reseed -or $freshDb) {
    Write-Output "Seeding database..."
    Start-Sleep -Seconds 4
    Push-Location (Join-Path $Root "server")
    npm run seed
    Pop-Location
}

Write-Output "`n=== Starting frontend (:5173) ==="
Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -WorkingDirectory (Join-Path $Root "client") `
    -ArgumentList "-NoLogo -Command `"npm run dev`""

Write-Output "`n=== Waiting for services to come up ==="
Start-Sleep -Seconds 6
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -TimeoutSec 5
    Write-Output "Backend:  OK ($($health | ConvertTo-Json -Compress))"
} catch {
    Write-Output "Backend:  NOT RESPONDING YET - check server\ manually if this persists"
}
try {
    $null = Invoke-WebRequest -Uri "http://localhost:5173/" -TimeoutSec 5 -UseBasicParsing
    Write-Output "Frontend: OK"
} catch {
    Write-Output "Frontend: NOT RESPONDING YET - check client\ manually if this persists"
}

Write-Output "`nDone. Backend http://localhost:4000, Frontend http://localhost:5173"
