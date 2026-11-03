# Shuts down every ReliefGrid dev process cleanly - frontend, backend, the dev mongod,
# and the sharding demo cluster if it's up. Doesn't touch any data or build output
# (that's restart.ps1 -Reseed); this just stops things properly and leaves them stopped.
#
# Usage: powershell -File stop.ps1

$ErrorActionPreference = "Continue"
$Mongosh = "C:\Program Files\mongosh\mongosh.exe"

function Get-PortOwner($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) { return ($conn.OwningProcess | Select-Object -First 1) }
    return $null
}

function Stop-ByPort($port, $label) {
    $procId = Get-PortOwner $port
    if ($procId) {
        Write-Output "Stopping $label (port $port, PID $procId)"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    } else {
        Write-Output "$label (port $port) - not running"
    }
}

# mongod/mongos support a proper shutdown command over the wire - SIGKILL-equivalent
# force-stopping (what Stop-Process -Force does) works too since WiredTiger is
# journaled and recovers on next start, but asking nicely first avoids an unclean-
# shutdown warning in the next startup's log and is the documented way to do this.
function Stop-MongoGracefully($port, $label) {
    $procId = Get-PortOwner $port
    if (-not $procId) {
        Write-Output "$label (port $port) - not running"
        return
    }

    Write-Output "Shutting down $label (port $port, PID $procId) gracefully..."
    & $Mongosh --port $port --quiet --eval "db.getSiblingDB('admin').shutdownServer({force: true})" 2>$null | Out-Null
    Start-Sleep -Seconds 2

    if (Get-PortOwner $port) {
        Write-Output "  still up - force-stopping"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    } else {
        Write-Output "  stopped cleanly"
    }
}

Write-Output "=== Stopping app processes ==="
Stop-ByPort 5173 "frontend (vite)"
Stop-ByPort 4000 "backend (node)"

Write-Output "`n=== Stopping MongoDB instances ==="
Stop-MongoGracefully 27018 "dev mongod"
Stop-MongoGracefully 27022 "sharding mongos router"
Stop-MongoGracefully 27020 "sharding shard1"
Stop-MongoGracefully 27021 "sharding shard2"
Stop-MongoGracefully 27019 "sharding config server"

Write-Output "`nAll stopped. Data on disk is untouched (.mongo-data\, .mongo-shard\)."
Write-Output "Start again with: powershell -File run.ps1"
