# Repairs after the checkpoint recheck

`recheck.md` records the pre-edit evidence for all 18 findings. The existing
14 domain tests remain. The new suite verifies the following replacement paths:

| Review # | Repair and coverage |
|---|---|
| 1, 7 | JSON-safe durable events; subscriber delivery outside mutations. Multiple ticks, disconnect/replay and subsequent mutation tested through ASGI WebSockets. |
| 2 | One same-origin API client and stream; Vite/nginx proxy `/api`. No legacy addresses in application source. |
| 3 | Explicit audit failure/retry UI. Browser acceptance injects HTTP 503; browser run remains pending in this sandbox. |
| 4, 9 | Persisted incident/current revision validation; notify-only rejects containment. Account actions revoke access and return durable IDs. |
| 5 | Per-source sample counts; late-auth baseline test and live simulation Scenario B. |
| 6 | Traffic allowance and topology share isolation rules; account paths remain until separately revoked. |
| 8 | Explicit reset route, valid HTTP error statuses, persisted scenario state. |
| 10 | Shared-account split is guidance; executable simulated audit fixes alter records. |
| 11 | Criticality overrides applied before autonomy; complete response rebuilt consistently. Work router and Solo lock covered. |
| 12 | Server profile/revision in snapshots; UI waits for successful mutation. Profile reload is in browser acceptance. |
| 13 | Snapshot-driven graph using server edges in both account directions and peer links. |
| 14 | Persistent incident/action state, actor audit, completion/undo and reconnect/replay. |
| 15 | UUID alert/action/device/account/household IDs; durable command-key deduplication. |
| 16 | Trusted producer matches verified vendor update before suppressing anomaly; Scenario C has no containment. |
| 17 | Selected-node effect aborts prior fetch; clear-selection/unmount also abort. Browser rapid-selection check authored. |
| 18 | Removed tracked node_modules, dist and bytecode; exact direct dependency/runtime pins and Compose setup. Fresh registry/container install is pending. |

Additional tests cover signup, verification/recovery single use and expiry,
Argon2id, CSRF/origin, shared failure throttling, Google claim failures and linking,
session revocation, roles/invitation/guest expiry, cross-household HTTP/WebSocket
access, worker leases and database reconnect, policies/expiry, incident recovery,
notification deduplication/failure, exact NVD identity/cache, scoped gateway
credentials, explicit confirmation and unchanged dry-run behavior.
