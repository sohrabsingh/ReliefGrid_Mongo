# ReliefGrid

A real-time, geospatial disaster-relief coordination platform on MongoDB. Citizens/field
officers raise **needs**, NGOs/volunteers register **resources**, and MongoDB's geospatial
index + aggregation framework does the matching - not application-side loops.

This is a working implementation of the project described in
`ReliefGrid_MongoDB_Project.pptx`: real schemas, a real `$geoNear` matching pipeline,
real atomic dispatch, a real change-stream-powered live dashboard, and a real sharded
cluster.

## Architecture

```
client/   React + Leaflet + Socket.IO   - live map, needs/resources forms, command centre
server/   Node/Express + Mongoose        - REST API, matching engine, change streams -> sockets
```

Five collections, exactly as designed: `needs`, `resources`, `volunteers`, `shelters`, `deliveries`.

The **matching engine** (`server/services/matchEngine.js`) is the literal three-stage
pipeline from the design doc: `$geoNear` (nearest + capable + in-stock, one indexed pass)
-> `$addFields` (urgency/vulnerability/distance blended into a score) -> `$sort`/`$limit`
(top 3, human makes the final call).

**Live updates** are not emitted from route handlers - they come from MongoDB **change
streams** (`server/sockets/changeStreams.js`) watching the three write-heavy collections
and re-broadcasting over Socket.IO. That's why change streams need a **replica set**
(single-node is fine for a demo; Atlas is always one).

**Basic hardening**, since the needs/SMS/volunteer intake routes are intentionally
unauthenticated: `server/middleware/rateLimit.js` caps login attempts (10/min), the
public write endpoints (30/min), and the API overall (300/min). List endpoints
(`GET /api/needs`, `GET /api/resources`) are capped at 500 results by default (2000 max,
`?limit=`) rather than returning an unbounded find(). On the map, needs/resources render
as clustered markers (`react-leaflet-cluster`) so a flood-simulation-sized result set
collapses into count bubbles instead of hundreds of overlapping points.

## Setup

### The one command (Windows, MongoDB Server already installed locally)

```
powershell -File run.ps1
```

Installs backend/frontend dependencies on first run, creates `server\.env` if missing,
starts a dedicated dev `mongod` on port 27018 (kept at the **project root**, never
inside `server\` - `node --watch server.js` watches that whole tree, and a mongod data
directory sitting inside it causes spurious backend restarts from WiredTiger's own
checkpoint writes), seeds it the first time, starts the backend and frontend, and opens
`http://localhost:5173`. Safe to re-run any time. This is exactly how the project was
built and verified.

To fully wipe the dev database and reseed without reinstalling anything:
```
powershell -File restart.ps1 -Reseed
```

This deliberately runs on **port 27018**, not the MongoDB default 27017 - Windows
installs of MongoDB Server often already have a standalone service listening there
holding other data, and `run.ps1`/`restart.ps1` never touch it.

### Manual setup (any OS, or a different MongoDB source)

MongoDB needs to be a **replica set** - change streams don't work on a standalone
`mongod`. Pick one:

- **Docker**: `docker compose up -d` runs `mongo:7`, auto-initiated as replica set
  `rs0` on `localhost:27017`. Set `MONGODB_URI=mongodb://localhost:27017/reliefgrid?replicaSet=rs0`
  in `server/.env` (the committed `.env.example` defaults to port 27018 for the `run.ps1`
  path above, so change the port if you go this route instead).
- **MongoDB Atlas** free tier (M0): create a cluster, grab the connection string, put it
  in `server/.env` as `MONGODB_URI`. Atlas clusters are always replica sets.
- **A local `mongod` binary**, same idea as `run.ps1` but by hand:
  ```
  mkdir .mongo-data
  mongod --replSet rs0 --port 27018 --dbpath .mongo-data
  # in another terminal, one time only:
  mongosh --port 27018 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27018'}]})"
  ```

Then:
```
cd server
cp .env.example .env      # edit MONGODB_URI to match whichever option above you used
npm install
npm run seed               # wipes and re-seeds 5 collections with a Trivandrum-district scenario
npm run dev                 # http://localhost:4000
```

Seeded logins: `officer1/officer123`, `volunteer1/volunteer123`, `citizen1/citizen123`.

```
cd client
npm install
npm run dev                 # http://localhost:5173
```

### Verify everything end-to-end
```
cd server
npm run smoke
```
Runs the real seed data, duplicate detection, matching pipeline, atomic dispatch, a live
change-stream event, and a flood simulation against the same cluster `MONGODB_URI`
points to - but always on a separate `reliefgrid_smoke_test` database, never your actual
seeded `reliefgrid` one, even if you don't set `SMOKE_MONGODB_URI`. It drops that
throwaway database when it finishes. Safe to run while your dev server is up.

### Flood scenario / metrics (slide 10's numbers)
```
cd server
npm run simulate
```
Re-seeds, then floods the district with 150 synthetic needs (~15% re-reporting the same
incident) and prints: needs generated, duplicates caught before they became a second
delivery, dispatched vs. no-capacity, and match latency (avg/p95/max, all well under 60s
since it's local DB round trips, not real-world response time).

### Sharding by district - a real cluster, not just a plan
```
powershell -File server\scripts\sharding\start-cluster.ps1
mongosh --port 27022 --file server\scripts\sharding\seedAndVerify.js
mongosh --port 27022 --eval "db.getSiblingDB('reliefgrid').needs.getShardDistribution()"
```
This stands up an actual config-server replica set + 2 shard replica sets + a `mongos`
router (using the MongoDB binaries already on this machine - no Docker, no Atlas), shards
`needs` and `resources` on a hashed `district` key, and seeds 600/200 documents across six
Kerala districts. Verified output: 600 `needs` split ~32%/68% and 200 `resources` split
~27%/73% across the two shards - real, uneven, hash-driven distribution, not a fixed
50/50 toy split. Runs entirely on ports 27019-27022, so it never touches your regular dev
database (27018) or a default MongoDB install (27017).

Tear it down with `powershell -File server\scripts\sharding\stop-cluster.ps1` (data files
stay on disk under `.mongo-shard\` at the project root until you delete that folder).

## Demo walkthrough

1. Log in as `officer1` in the top bar.
2. **Needs** tab -> raise a need (or use a seeded one).
3. **Command Centre** tab -> verify a pending need, "Find matches" to preview the
   ranked candidates (distance + score), then dispatch - watch the **Map** tab update
   live via the change stream, no refresh.
4. **Deliveries** tab -> confirm delivery with photo+OTP; the need flips to `fulfilled`
   live on the map.
5. To see duplicate detection: raise two needs at nearly the same spot/category within
   a few minutes - the second comes back `flagged_duplicate` for an officer to resolve.
6. **Volunteers** / **Shelters** tabs -> register one of each (no login needed for
   volunteers; officer login needed for shelters), then as `officer1` mark a volunteer
   verified/lead, or bump a shelter's occupancy with +1/-1 - watch it update live.
7. **Needs** tab -> the search box runs a real full-text query against the seeded
   `description` text (try "rooftop" or "insulin").

Simulate the SMS/IVR intake path without a phone:
```
curl -X POST http://localhost:4000/api/sms/inbound \
  -d "From=+911234567890" -d "Body=medical 2 insulin 8.5241 76.9558 1"
```

## What's real vs. what's a documented stand-in

Almost everything above is genuinely working, verified end-to-end - including sharding,
which started out as "needs infra I can't build" and turned into a real 2-shard cluster
once it turned out MongoDB Server was already installed locally. Two things are still
intentionally not fully wired because they need something only you can provide:

- **Twilio SMS/IVR** - `services/notify.js` calls the real Twilio SDK. With
  `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` set in `server/.env`,
  it sends real texts (need received, help dispatched, delivery confirmed) and
  `/api/sms/inbound` accepts a real Twilio webhook unchanged. Without those env vars
  (the default), it logs what would have been sent instead of throwing - there's just no
  real phone number to text without an account.
- **Atlas Search** - full-text search over `description` is real and working
  (`GET /api/needs?q=...`, wired into the Needs tab), but it runs on a standard MongoDB
  text index so it works on any deployment including a local `mongod`. Atlas Search
  itself (Lucene-backed, typo-tolerant, relevance-tuned) is a strict upgrade only
  available on an Atlas cluster - swapping `$text`/`$search` in that one route is the
  entire migration once this points at Atlas.

## What each slide maps to in code

| Slide | Where |
|---|---|
| 6 - Data model | `server/models/*.js` |
| 7 - Geospatial / flexible schema / change streams / aggregation | `2dsphere` indexes in the models, `services/matchEngine.js`, `sockets/changeStreams.js` |
| 8 - Matching pipeline | `services/matchEngine.js` (pipeline), `services/dispatch.js` (atomic reservation + fallthrough) |
| 5 - Workflow (capture/verify/match/dispatch/confirm) | `routes/needs.js`, `routes/deliveries.js` |
| 9 - Architecture | `server/server.js` (API+sockets), `client/` (React/Leaflet/Socket.IO), `services/notify.js` (Twilio) |
| 10 - Metrics | `server/scripts/simulateFlood.js` |
| 7 - Horizontal scale (sharding by district) | `server/scripts/sharding/` (real config-server + 2-shard + mongos cluster) |
| 7 - Atlas Search | `routes/needs.js` `GET ?q=` (local text-index today, one-line swap to `$search` on Atlas) |
