# Application and trust boundaries

The root `index.html` is the standalone Driftbar footer. The application entry
point remains `frontend/index.html` → `frontend/src/main.tsx` → `App.tsx`.
The obsolete root `src/components` copies are removed after the active frontend
migrated; no legacy HTTP routes or unauthenticated WebSocket endpoint remain.

The API exposes modules for authentication, households, inventory, policies,
incidents, integrations and events. A separate supervised worker owns simulation
jobs and the email outbox. PostgreSQL stores application users, provider identities,
opaque sessions, single-use tokens, households, memberships, device/vendor
records, policy history, incidents, actions, audit events, events and jobs. No
household simulator, policy engine, baseline or subscriber list is shared globally.
Each tick reconstructs its domain objects from household records and persists its
baseline and scenario progress. Seeded simulation households start with a baseline
from 100 known benign samples per source; newly added sources learn independently.

All API mutations and their audit/event records share a database transaction.
Writers serialize on the household row; event sequences are unique per household.
Readers acquire a shared household lock for a consistent snapshot. Workers claim
jobs with `FOR UPDATE SKIP LOCKED` and expiring leases. A tick, its events, completed
job and next tick commit together. A crashed worker's lease is reclaimable. A
replayed command key returns the original action; different commands cannot apply
overlapping simulated actions to the same node. Manual confirmation reevaluates
both the persisted incident and the current policy revision. A resolved incident
cannot initiate containment. Resolving an incident retains active containment;
undo/recovery is a separate, attributed action.

The event endpoint reads committed events, independently of the mutation path.
It checks the session and membership before accept and every 750 ms afterward;
revocation and guest expiry terminate the stream. Slow/disconnected clients only
lose their own delivery. Reconnect uses the last sequence and replays events.
New tabs load a consistent snapshot. The client shares one authenticated stream,
reconnects with backoff, deduplicates sequences, checks heartbeat staleness and
polls state for recovery. Household changes remount the scoped UI state.

A response profile (Admin/Family/Work/Solo) cannot grant household privileges.
Membership roles (Owner/Admin/Viewer) cannot change response criticality. Only an
Owner can grant Admin, including through invitations. Invitations expire after
seven days. Guests default to 24 hours from acceptance. Invite acceptance checks
the verified recipient and the inviter's current authority again.

Passwords use Argon2id (64 MiB, three passes, four lanes, random salt). Server-side
sessions and tokens store SHA-256 digests of random 256-bit or stronger secrets.
Cookies are HttpOnly and SameSite=Lax; Secure is mandatory except explicit loopback
development. Unsafe cookie-authenticated operations require a server-validated
CSRF token and exact Origin. There is no wildcard credentialed CORS. Rate counters
are shared atomic upserts in independent transactions so failed logins count.
Recovery revokes all sessions; WebSocket authorization observes that revocation.

Google uses browser-bound single-use state, nonce, S256 PKCE, a fixed token/JWKS
endpoint, RS256 signature checks, issuer/audience/authorized-party/expiry checks,
and verified email. Provider subject, rather than email, identifies an identity.
An existing matching email produces a conflict until the authenticated user
explicitly confirms linking with a recent login. Failed callback attempts consume
state. Real provider checks require configured credentials and remain pending.

Network containment blocks routed simulated traffic to and from a device. The
compromise graph separately preserves device↔vendor-account links until the
vendor account's simulated access is revoked. Both edge directions and explicit
peer edges come from the same backend topology used by reachability. Simulated
account revocation is persistent until undo; network containment has a 15-minute
lease. None of these operations calls a vendor cloud API.

NVD requests use a fixed trusted endpoint and require an explicit CPE 2.3 name
whose version equals the device's recorded firmware version. Results cache for a
day; no result, unidentified products and lookup failures never imply safety.
Email jobs deduplicate incident/member pairs. Failed SMTP attempts retry with
backoff; a stable Message-ID helps downstream deduplication. SMTP cannot guarantee
exactly-once delivery across a crash after acceptance and before commit. Delivered
outbox payloads are cleared. Expired/removed incident recipients are rechecked.

The Windows gateway has an independent scoped bearer credential. An Owner issues
a short-lived enrollment token. A gateway cannot use application sessions or
access another household. Real jobs require an explicit device-specific
confirmation, matching incident/policy revision and an approved trusted mapping;
they are revalidated at delivery. Local and server adapter/dry-run flags both
must permit enforcement. V1 restricts the fixture to one synthetic plug; the
router's forced-command helper independently pins its UUID, IPv4 and MAC.

The helper manages only `table ip bulkhead`, applies a checked nft transaction,
protects router input/output and management addresses, and uses a kernel timeout
so expiry restores forwarding even if the agent/API is unavailable. Verification
must show plug blocking and unaffected work traffic. Failed verification attempts
restoration; uncertainty remains failed until packet recovery is verified. Agent
journaling and command IDs survive process restarts without extending leases.
