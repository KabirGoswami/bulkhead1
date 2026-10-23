# PHANTOM API — Phase 1

A standalone Fastify 5 + TypeScript API. It serves a deterministic, explicitly
simulated capture of four devices. It does not import React or frontend runtime
code. Existing frontend scripts and source files are unchanged.

## Install and run

Use Node.js 22.18+ (Node 24 recommended). Native TypeScript execution avoids a
second transpiler and does not change the Vite build configuration.

From the repository root:

```sh
npm --prefix server install
npm run server:dev
```

Development mode watches backend source. To run without watching:

```sh
npm run server:start
```

Default address: `http://127.0.0.1:3001`. Configure `server/.env` by copying
`server/.env.example`, or export the environment variables directly. The actual
`.env` file is ignored. No credentials are needed.

| Variable | Default |
| --- | --- |
| `SERVER_HOST` | `127.0.0.1` |
| `SERVER_PORT` | `3001` (falls back to `PORT` if set) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |
| `LOG_LEVEL` | `info` |

CORS origins must be exact HTTP(S) origins, comma-separated, without trailing
slashes, paths, or wildcards. An unlisted browser origin receives no CORS access
header; CORS is not authentication. No authentication is implemented in Phase 1.
The default listener is loopback only.

## Endpoints

- `GET /api/health`: `{ status: "ok", service: "phantom-api", version: "0.1.0", simulation: true }`
- `GET /api/v1/devices`: `{ simulation, scenarioId, capturedAt, devices }`
- `GET /api/v1/snapshot`: `{ simulation, scenarioId, capturedAt, devices, flows, findings, events }`

Every data response has `simulation: true` and a fixed scenario/capture timestamp.
`lastSeenAt` provides absolute timestamps. Existing `lastSeen` display strings
are relative to that capture, not the current wall clock. All findings are
prewritten fixture data, not outputs of a running detector. External IPs are
reserved documentation addresses.

Snapshots are copied per request so future handlers cannot mutate shared fixtures.
There are no random values or time-dependent changes to the simulation responses.
All endpoint responses use `Cache-Control: no-store`.

## Verification

```sh
npm run server:typecheck
npm run server:test
npm run build
npm run lint
```

The API tests use Fastify injection for response contracts, consistency, CORS,
and absent mutation routes. The HTTP test starts an actual TCP listener and
requests all three endpoints with native `fetch`. It fails rather than skipping
if network/socket access is unavailable. Configuration/fixture tests can also run
before Fastify installation:

```sh
node --test server/test/simulation.test.ts
```

With the server running, independently verify all three real HTTP responses with
`npm run server:smoke` (override `API_BASE_URL` if needed), or use curl:

```sh
curl --fail --include http://127.0.0.1:3001/api/health
curl --fail --include http://127.0.0.1:3001/api/v1/devices
curl --fail --include -H 'Origin: http://localhost:5173' http://127.0.0.1:3001/api/v1/snapshot
```

## Structure and scope

- `src/app.ts`: application factory; `src/index.ts`: listening and graceful shutdown.
- `src/routes/`: the three read-only HTTP endpoints.
- `src/types/`: frontend-compatible domain types and API response contracts.
- `src/simulation/`: adapted deterministic fixtures; no browser imports.
- `src/security/`, `src/containment/`, `src/database/`: reserved, documented module
  boundaries. No detection, containment, authentication, or database integration
  is implemented or claimed.
- `test/`: API contract, configuration, fixture, and real HTTP tests.

Dependencies are installed in `server/node_modules`; the frontend's existing
package-lock is preserved. Supabase is not initialized. The frontend does not
call this API yet.
