# Stops every process started by start-cluster.ps1 (config server, both shards, mongos)
# by port. Does not touch your default MongoDB service (27017) or the project's regular
# dev instance (27018) - only 27019-27022.
#
# Usage: powershell -File server\scripts\sharding\stop-cluster.ps1

$ports = 27019, 27020, 27021, 27022

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $procId = $conn.OwningProcess | Select-Object -First 1
        Write-Output "Stopping process on port $port (PID $procId)"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    } else {
        Write-Output "Nothing listening on port $port"
    }
}

Write-Output ""
Write-Output "Cluster stopped. Data files are still on disk under server\.mongo-shard\"
Write-Output "(delete that folder to fully reset the cluster before the next start-cluster.ps1 run)."
