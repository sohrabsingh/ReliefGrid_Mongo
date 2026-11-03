# Stands up a real local sharded cluster for ReliefGrid: 1 config server replica set,
# 2 shard replica sets, and a mongos router - all on ports that don't touch a default
# MongoDB install (27017) or the project's regular dev instance (27018).
#
# Usage:  powershell -File server\scripts\sharding\start-cluster.ps1
# Then:   mongosh --port 27022 --file server\scripts\sharding\seedAndVerify.js
# Stop:   powershell -File server\scripts\sharding\stop-cluster.ps1

$ErrorActionPreference = "Stop"

$MongoBin = "C:\Program Files\MongoDB\Server\8.3\bin"
# Deliberately outside server/ - `node --watch server.js` watches that whole tree, and
# a mongod data directory's constant WiredTiger checkpoint writes were triggering
# spurious backend restarts when this used to live at server\.mongo-shard.
$Base = Join-Path $PSScriptRoot "..\..\..\.mongo-shard"

New-Item -ItemType Directory -Force -Path "$Base\config", "$Base\shard1", "$Base\shard2" | Out-Null

# Start-Process -ArgumentList does NOT auto-quote array elements that contain spaces
# (a real gotcha when the project lives under a path like "Sh.Pritpal Singh") - so each
# process is launched from a single, manually-quoted command-line string instead.
function Start-Mongod($argString) {
    Start-Process -FilePath "$MongoBin\mongod.exe" -WindowStyle Hidden -ArgumentList $argString
}

Write-Output "Starting config server (port 27019)..."
Start-Mongod "--configsvr --replSet cfgrs --port 27019 --dbpath `"$Base\config`" --bind_ip 127.0.0.1 --logpath `"$Base\config\mongod.log`""

Write-Output "Starting shard1 (port 27020)..."
Start-Mongod "--shardsvr --replSet shard1rs --port 27020 --dbpath `"$Base\shard1`" --bind_ip 127.0.0.1 --logpath `"$Base\shard1\mongod.log`""

Write-Output "Starting shard2 (port 27021)..."
Start-Mongod "--shardsvr --replSet shard2rs --port 27021 --dbpath `"$Base\shard2`" --bind_ip 127.0.0.1 --logpath `"$Base\shard2\mongod.log`""

Start-Sleep -Seconds 5

$mongosh = "C:\Program Files\mongosh\mongosh.exe"
& $mongosh --port 27019 --quiet --eval "rs.initiate({_id:'cfgrs', configsvr:true, members:[{_id:0,host:'localhost:27019'}]})"
& $mongosh --port 27020 --quiet --eval "rs.initiate({_id:'shard1rs', members:[{_id:0,host:'localhost:27020'}]})"
& $mongosh --port 27021 --quiet --eval "rs.initiate({_id:'shard2rs', members:[{_id:0,host:'localhost:27021'}]})"

Start-Sleep -Seconds 3

Write-Output "Starting mongos router (port 27022)..."
Start-Process -FilePath "$MongoBin\mongos.exe" -WindowStyle Hidden -ArgumentList `
    "--configdb cfgrs/localhost:27019 --port 27022 --bind_ip 127.0.0.1 --logpath `"$Base\mongos.log`""

Start-Sleep -Seconds 5

& $mongosh --port 27022 --quiet --eval "
sh.addShard('shard1rs/localhost:27020');
sh.addShard('shard2rs/localhost:27021');
sh.enableSharding('reliefgrid');
sh.shardCollection('reliefgrid.needs', { district: 'hashed' });
sh.shardCollection('reliefgrid.resources', { district: 'hashed' });
"

Write-Output ""
Write-Output "Cluster is up. Router: mongodb://localhost:27022/reliefgrid"
Write-Output "Seed it and see the per-shard split:"
Write-Output "  mongosh --port 27022 --file server\scripts\sharding\seedAndVerify.js"
Write-Output "  mongosh --port 27022 --eval `"db.getSiblingDB('reliefgrid').needs.getShardDistribution()`""
