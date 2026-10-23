# Bulkhead

Bulkhead is an authenticated, persistent household security simulator with an
optional OpenWrt routed VM lab. The existing Home, Network, Access health, Alerts,
Timeline, Simulation, themes, navigation and footer are retained. Devices,
Policies, Household settings, login, email verification, recovery and onboarding
are added. The independent Driftbar footer remains at **root `index.html`**;
Bulkhead starts at **`frontend/index.html`**.

The footer checkpoint `ca2ea2d` was already on GitHub main when execution resumed.
The connected GitHub API confirmed the remote and local commits match. See
[the recheck](docs/recheck.md), [repair mapping](docs/defect-regressions.md),
[architecture](docs/architecture.md) and [validation](docs/validation.md).

## Local reference deployment

Windows Intel/AMD, Docker Desktop using Linux containers, VirtualBox 7.1+,
PowerShell 7.4+, Python **3.12.14**, Node **24.19.0**, npm **11.9.0**. Python 3.12
and Node 24 are the supported runtime lines; exact development pins are in
`.python-version` and `.node-version`. Python and frontend direct dependencies are
exactly pinned; npm's lockfile also pins transitive packages and integrity hashes.

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Open **http://localhost:8080**. Create an account, read its verification email in
**http://localhost:8025** (Mailpit), verify, sign in and create a private household.
There is no default administrator or public household. Recovery also uses Mailpit.
The development database password is scoped to the internal Compose network;
the API, PostgreSQL and SMTP ports are not published. Frontend and Mailpit ports
bind only to loopback. Keep `.env`, `.secrets` and `.lab` untracked.

Compose runs nginx/frontend, FastAPI, a separate supervised worker, PostgreSQL
17.6 and Mailpit. A one-shot Alembic migration completes before API/worker startup.
PostgreSQL uses a named volume; `docker compose down` retains it. Deleting that
volume deletes application data. Inspect health with:

```powershell
docker compose ps
docker compose logs --tail 50 api worker
Invoke-RestMethod http://localhost:8080/api/v1/health
```

Health returns 503 if the database is unavailable or the worker heartbeat is
stale. A connected socket alone does not mean detection is running. Mail delivery
failures remain queued with bounded exponential retries and visible status.

For HTTPS, set `BULKHEAD_ORIGIN` to the exact HTTPS origin, disable
`BULKHEAD_DEV_LOCALHOST`, terminate TLS at the frontend proxy and adjust its
`connect-src` CSP for that origin's WebSocket URL. Secure cookies are automatic.
HTTP is accepted only with explicit loopback development configuration. This
reference deployment has **no public simulator**.

## Google configuration

Create a Google Web OAuth client with callback exactly:

`http://localhost:8080/api/v1/auth/google/callback`

Set `BULKHEAD_GOOGLE_CLIENT_ID` and supply `BULKHEAD_GOOGLE_CLIENT_SECRET` securely
in the ignored `.env`, then recreate API and worker. Do not commit credentials or
paste them into command history. Alternatively mount a Docker secret file and set
`BULKHEAD_GOOGLE_CLIENT_SECRET_FILE` to its container path on API, worker and
migration services; the file must be mounted wherever the setting is present.
There are no Google credentials bundled with this repository.

Google validates state, nonce, S256 PKCE, signature, issuer, audience and expiry.
An existing email is never silently linked. Sign in to the existing account,
then confirm linking in Household settings within ten minutes of login. Real
Google-provider checks remain pending until credentials are supplied.

## Workflows

- Owner/Admin can approve inventory, edit zones/firmware, preview and apply
  simulated per-device policies, run scenarios and handle incidents. Viewers read.
  Only Owners grant Admin, including via invitations. Invitations expire after
  seven days; optional guest membership defaults to 24 hours after acceptance.
- Response profiles **Admin / Family / Work / Solo** are independent of membership
  roles. Work's safety overrides apply before response autonomy. Notify-only
  incidents offer no containment action.
- Scenario A attempts plug command-and-control traffic and lateral movement.
  Scenario B exercises stolen vendor-account authentication and virtual unlock
  requests. Scenario C is a recognized, verified-vendor firmware update.
- Alerts retain incidents, acknowledgement/resolution, action completion and undo.
  Network containment and vendor-account access are separate simulation changes.
  A quarantined device's account compromise paths remain visible until its vendor
  account access is separately revoked. Simulated network containment expires in
  15 minutes; account revocation persists until undo. Reset stops a scenario and
  retains inventory, incidents, policies and history.
- Policies preview graph reachability, including account paths. Temporary grants
  expire and reveal the underlying persistent policy. These policies change
  simulation only; real V1 enforcement supports explicit quarantine/restoration.
- Audit fixes that are executable change simulated records. Unsupported account
  splitting is guidance. No vendor-cloud operation is claimed to have executed.
- NVD lookup requires an explicitly identified complete CPE 2.3 and exact firmware
  version. Seeded fictional/unknown devices remain unknown. No matching advisory
  never means a device is safe. Cached results expire after one day.

## Interfaces

The OpenAPI schema is at http://localhost:8080/api/v1/openapi.json. Versioned
routes are declared in `backend/bulkhead/`; no old `/state`, `/ws`, `/profile`,
`/audit` or `/action/*` routes remain.

| Interface | Purpose |
|---|---|
| `/api/v1/auth/*` | Registration, CSRF bootstrap, verification, recovery, sessions, Google login/linking |
| `/api/v1/households` | List/create private households |
| `/api/v1/households/{id}` | Household settings, members, invitations and preferences |
| Household `/devices`, `/policies`, `/policies/preview` | Inventory, trusted mappings, policy history and simulation preview |
| Household `/state`, `/topology`, `/risk`, `/blast/{node}` | Consistent household snapshots and graph reachability |
| Household `/audit`, `/audit/fix`, `/audit-events` | Findings, simulated fixes and actor-attributed history |
| Household `/incidents`, `/actions`, `/actions/{id}/undo` | Incident lifecycle and durable action/recovery records |
| Household `/scenarios/{A\|B\|C}`, `/scenarios/reset`, `/profile` | Persisted simulation/profile controls |
| Household `/events?after=N`, `/events/ws?after=N` | Authenticated ordered replay and WebSocket stream |
| Household `/integrations/advisories/{device}` | Cached exact-product NVD lookup |
| Household `/integrations/gateway/*` | Owner enrollment, confirmed gateway actions, restore/revocation |
| `/api/v1/gateway/enroll`, `/heartbeat`, `/jobs`, `/jobs/{id}/results` | Independent scoped agent credential endpoints |

Prefix household paths with `/api/v1/households/{id}`. All cookie-authenticated
mutations require the exact Origin and `X-CSRF-Token` obtained from `/auth/csrf`.
Actions return their UUID, execution mode, policy revision and explicit state:
planned, applied, verified, failed or rolled_back. Idempotency keys survive retries.
The gateway bearer credential cannot authenticate as an application user.

## OpenWrt / Debian VM fixture

**This is routed VM isolation. It demonstrates neither physical Wi-Fi isolation
nor same-segment isolation.** There are no bridged adapters or physical-device
controls. IPv6 and flow offloading are disabled in the initial lab.

Pinned official images:

| Image | SHA-256 |
|---|---|
| `openwrt-24.10.4-x86-64-generic-ext4-combined.img.gz` | `57f43d2a665646b0c45b909328704796db1777f85cc0c8ad51ec9b830d34ffc5` |
| `debian-13.1.0-amd64-netinst.iso` | `658b28e209b578fe788ec5867deebae57b6aac5fce3692bbb116bab9c65568b3` |

Sources: [OpenWrt's published checksums](https://downloads.openwrt.org/releases/24.10.4/targets/x86/64/sha256sums),
[Debian's archived checksums](https://cdimage.debian.org/cdimage/archive/13.1.0/amd64/iso-cd/SHA256SUMS).
The Debian published manifest was also read from the
[Debian mirror](https://mirror.math.princeton.edu/pub/debian-cd/13.1.0/amd64/iso-cd/SHA256SUMS).
`lab/images.json` pins exact official download URLs. Setup verifies the download
against both its pin and the publisher's checksum file, and retains signatures.
The script does not claim GPG signature verification: verify the saved signatures
with independently trusted publisher keys if signature validation is required.
It refuses to overwrite existing VMs.

```powershell
./lab/Setup-Lab.ps1
```

The script creates two VMs with a NAT management NIC and four isolated VirtualBox
internal networks. Only SSH is forwarded, and only on the Windows loopback:
router `127.0.0.1:2222` and probe `127.0.0.1:2223`.

| Internal network | Router | Debian namespace / synthetic endpoint |
|---|---|---|
| bulkhead-main | 192.168.10.1/24 | plug, 192.168.10.10, MAC 02:00:00:00:10:10 |
| bulkhead-iot | 192.168.20.1/24 | iot, 192.168.20.10, HTTP port 8000 |
| bulkhead-work | 192.168.30.1/24 | work, 192.168.30.10 |
| bulkhead-guest | 192.168.40.1/24 | guest, 192.168.40.10 |

Each namespace owns a separate VM NIC and routes cross-zone traffic through
OpenWrt. The Debian root namespace is management only and does not forward.
The initial OpenWrt fixture permits routed traffic among the four lab networks;
no lab network may forward into management. V1 adds only Bulkhead-owned blocking.

Console bootstrap, once per disposable fixture:

1. Generate a separate `lab_admin_ed25519` key in `.secrets` using Windows OpenSSH.
   Install its public key in `/etc/dropbear/authorized_keys` through the OpenWrt
   VM console. Use the console to replace the default network with a DHCP
   management interface on `eth0`, commit it and restart networking:

   ```sh
   uci delete network.lan
   uci -q delete network.wan
   uci -q delete network.wan6
   uci set network.management=interface
   uci set network.management.device=eth0
   uci set network.management.proto=dhcp
   uci commit network
   /etc/init.d/network restart
   ```

   Before SSH bootstrap, set a root password at the console and disable password
   authentication once the admin key is installed. The final configure script
   enforces key-only SSH and binds it to management.
2. Install a minimal Debian from the mounted netinst ISO in the probe VM console,
   selecting SSH server and standard utilities. Using its NAT management NIC,
   install `python3`, `curl`, `iproute2`, `openssh-server` and `sudo` with apt.
   Install the separate admin public key into `/root/.ssh/authorized_keys` through
   the console, configure `PermitRootLogin prohibit-password` and restart the SSH
   service with `systemctl restart ssh`. Eject the ISO
   after installation. No credentials are embedded in an unattended installer.
3. Copy **host public keys from the actual VM consoles**, not from an unverified
   SSH scan: OpenWrt `dropbearkey -y -f /etc/dropbear/dropbear_ed25519_host_key`,
   Debian `cat /etc/ssh/ssh_host_ed25519_key.pub`. Supply only the `ssh-ed25519`
   algorithm and base64 key to initialization. This pins host identity before SSH.
4. In Devices, approve the seeded Smart Plug and set its trusted mapping to
   `192.168.10.10` / `02:00:00:00:10:10`. Copy its UUID from the API snapshot
   or graph node analysis. Run initialization with that UUID and the console keys:

   ```powershell
   ./lab/Initialize-Lab.ps1 -DeviceId '<plug-uuid>' -RouterHostKey 'ssh-ed25519 AAAA...' -ProbeHostKey 'ssh-ed25519 AAAA...'
   ./lab/Test-Lab.ps1 -Expected baseline
   ```

Initialization installs **different agent keys** for router/probe, pins host keys,
restricts Windows key-file ACLs, installs forced-command helpers and creates
`.lab/agent.json`. Router agent keys cannot run a shell or forwarding command.
Only the allowlisted helper can alter its own `table ip bulkhead`; it independently
validates the exact fixture UUID, IP and MAC. It checks nft syntax and atomically
applies a batch. Input/output and management traffic are outside its forward hook.
Nft set timeouts remove the block even if the host, app or agent stops. No physical
router, vendor account or non-Bulkhead firewall table is managed by the agent.

The Debian namespaces are intentionally ephemeral. After reboot, reinstall the
probe fixture with `lab/probe/configure.sh` using the separate admin key. Inspect
and reboot after a partial namespace setup before rerunning it. This bootstrap
and VM/bootstrap behavior still require validation on the Windows host. Probe
interfaces are discovered by their pinned VirtualBox MACs rather than assumed PCI names.

As Owner, create an enrollment token in Household settings and exchange it via
`POST /api/v1/gateway/enroll` with `{"enrollment_token":"..."}`. Store the returned
credential in the agent process's `BULKHEAD_AGENT_CREDENTIAL` environment variable
using a secure prompt; never commit it or place it in command history.

```powershell
python gateway/agent.py --config .lab/agent.json
```

Both server `.env` and local agent config default to **adapter disabled, dry-run
true**. An Owner can queue a dry-run with:

```text
POST /api/v1/households/{id}/integrations/gateway/actions
{
  "incident_id": "<current plug incident UUID>",
  "agent_id": "<enrolled agent UUID>",
  "device_id": "<approved plug UUID>",
  "command_id": "<new UUID>",
  "policy_revision": <current revision>,
  "confirmation": "QUARANTINE <approved plug UUID>",
  "expires_in": 900
}
```

Obtain the incident by running Scenario A. Dry-run validates the helper plan and
checks unchanged status without issuing nft mutations. The returned execution
mode stays `dry_run`. Compare the router's `nft -j list ruleset` through the
separate admin key before/after dry-run for full firewall-state verification.

For an explicitly reviewed real fixture test, enable the adapter and disable
dry-run in **both** server and local agent configuration, recreate API/worker and
submit a **new** confirmed command against the current policy revision. The agent
records applied then verified only after checking actual packets:

```powershell
./lab/Test-Lab.ps1 -Expected quarantined
```

The plug must fail to reach `192.168.20.10:8000`, and work must still succeed.
Restore with `POST .../integrations/gateway/actions/{quarantine-id}/restore`, then:

```powershell
./lab/Test-Lab.ps1 -Expected restored
```

Expiry defaults to 15 minutes and cannot exceed that in V1. Failed verification
attempts restoration immediately. Agent journaling makes retries idempotent and
never extends an existing lease. A failed/unreachable restoration stays uncertain
until verified; the kernel timeout is the offline fallback. Return both configs
to disabled/dry-run after the fixture test.

## Development and tests

```powershell
python -m venv .venv
.venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements-dev.txt
$env:PYTHONPATH = "backend;."
# For non-Compose development, explicitly configure a local PostgreSQL URL.
$env:BULKHEAD_DATABASE_URL = 'postgresql+psycopg://bulkhead:<local-password>@localhost/bulkhead'
$env:BULKHEAD_DEV_LOCALHOST = 'true'
python -m alembic -c backend/alembic.ini upgrade head
python -m alembic -c backend/alembic.ini check
python -m pytest -q
```

For host development, first run `docker compose -f compose.yaml -f compose.dev.yaml up -d db mailpit` to publish PostgreSQL and SMTP on loopback only.

Run API with `python backend/app.py`, worker with `python -m bulkhead.worker`, and
frontend with `npm ci; npm run dev` from `frontend`. Vite serves port 8080 and
proxies `/api` to the local API on 8000. Use `BULKHEAD_SMTP_HOST=localhost` for
Mailpit outside Compose. Never start the legacy unauthenticated entry point.

Frontend checks from `frontend`: `npm run check` and `npm run build`. Browser
acceptance against a **disposable Compose deployment**:

```powershell
python -m playwright install chromium
python tests/browser.py
```

It creates a unique account/household, reads its Mailpit verification email, and
exercises pages, all themes/profiles, scenarios, incident handling, undo, graph
selection, responsiveness and injected audit failure. For worker/database restarts,
run `tests/restarts.ps1` with a disposable household and its session cookie supplied
securely; keep an authenticated event stream open to verify reconnect/replay.

Pytest overrides the application database URL with a unique disposable SQLite file.
To test PostgreSQL, explicitly set `BULKHEAD_TEST_DATABASE_URL` to a disposable
database whose name ends in `_test`; its tables are dropped/recreated. SQLite tests
cover application behavior, not PostgreSQL lock scheduling or a live PostgreSQL
restart. The Compose restart fixture is a separate acceptance check.

See [validation.md](docs/validation.md) for executed evidence and pending checks.
The public simulator, physical-device protection and vendor-cloud enforcement
are later phases and remain visibly unavailable in the application.
