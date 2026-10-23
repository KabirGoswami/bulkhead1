# Validation status

Validation was last checked on **23 October 2026**. The footer checkpoint
`ca2ea2d` is already on main; the connected GitHub API reconfirmed that head before
delivery. The implementation preserves the separate root footer. No force push
has been used.

The checks below establish application behavior and source compilation in this
sandbox. Deployment validation is **incomplete**: fresh registry installation,
live PostgreSQL/Compose startup and browser acceptance remain blocked. Google
and Windows/VirtualBox checks also require credentials or a suitable host. These
limits remain part of the delivery record; recording them does not turn them
into passing checks.

## Executed

- All **39 backend tests passed**, including the original 14 tests; no tests skipped.
  The latest run completed in 19.29 seconds with one Starlette TestClient/httpx
  deprecation warning and no failures.
  New tests use actual SQLAlchemy persistence and FastAPI HTTP/ASGI WebSocket
  handling. Google HTTP/JWT fixtures test failure validation; they do not claim a
  real Google-provider round trip. SMTP/NVD/gateway fixtures exercise their
  respective contracts without contacting a vendor or changing a router.
- Fresh SQLite Alembic upgrade, drift check, downgrade to base and re-upgrade pass.
  The drift check reports no new upgrade operations. All 18 tables and their
  indexes are created. PostgreSQL DDL compiles (46 statements) against its dialect.
- Strict frontend TypeScript check passes. Bulkhead's Vite production build passes
  from **frontend/**, with 2,113 modules transformed. Root index.html remains the
  separate unchanged Driftbar footer and is not used for this application build.
- Exact frontend direct dependency pins agree with the lockfile's root and resolved
  versions. Python syntax compilation, shell syntax checks and Git whitespace
  checks pass. OpenAPI includes 52 versioned paths. Compose YAML structure and
  loopback bindings are checked as configuration, not as a running deployment.
  Tracked dependency/build artifacts and bytecode have been removed from the Git
  index; the existing local dependency files used for compilation are ignored.
- The 18 original defects were rechecked against ca2ea2d before repairs; see
  recheck.md and defect-regressions.md for the evidence and replacement paths.

The sandbox initially had no SQLAlchemy, Alembic, pytest or psycopg. Registry
installation found no packages, and shell network requests did not complete.
For application tests, exact official source tags were retrieved through the
connected GitHub service into **/tmp/bulkhead-deps**, outside the repository:
SQLAlchemy rel_2_0_44, Alembic rel_1_17_1, pytest 9.1.1, pluggy 1.6.0, iniconfig
v2.3.0, Mako rel_1_3_10, MarkupSafe 3.0.3 and psycopg 3.2.12. Generated version
metadata was supplied only for those temporary source checkouts. No dependency
source or binary is added to the repository. This is an alternate test runtime,
not a claim that a fresh registry installation passed.

The sandbox denies socketpair send/receive as well as TCP binding with EPERM.
Even an empty FastAPI TestClient consequently cannot wake its event-loop thread.
`BULKHEAD_TEST_POLL_LOOP=true` is a test-only selector polling accommodation;
it does not enable networking or change production code. The executed suite was:

```sh
BULKHEAD_TEST_POLL_LOOP=true PYTHONDONTWRITEBYTECODE=1 \
PYTHONPATH=/tmp/bulkhead-deps:backend:. PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
python -m pytest -q -p no:cacheprovider backend/tests tests
```

The frontend check/build used existing Linux native helper packages in
/workspace/bulkhead-tools while the old tracked Windows dependency tree was removed
from the Git index. This verifies source compilation, not fresh npm installation:

```sh
# From frontend/
/workspace/bulkhead-tools/node_modules/@typescript/typescript-linux-x64/lib/tsc -p tsconfig.json
NODE_PATH=/workspace/bulkhead-tools/node_modules node node_modules/vite/bin/vite.js build --outDir /tmp/bulkhead-application-final --emptyOutDir
```

## Pending execution

| Check | Current limit / executable follow-up |
|---|---|
| Fresh pip/npm installation and Compose image build | Registry/socket execution access unavailable. Run pinned installation and `docker compose up --build -d`. |
| Live PostgreSQL migrations/locking and database container restart | Docker's local socket is denied with EPERM. SQLite reconnect/lease tests pass; they do not establish PostgreSQL restart behavior. Use a disposable `_test` database and tests/restarts.ps1. |
| Browser acceptance and actual TCP/WebSocket server recovery | Chromium exits during launch: Crashpad `setsockopt: Operation not permitted`. tests/browser.py covers the intended real app/Mailpit flow; it has not run. ASGI stream replay is tested. |
| PowerShell bootstrap, VirtualBox networking and packet fixture | Windows Intel/AMD host unavailable. Run Setup-Lab, Initialize-Lab and baseline/quarantined/restored Test-Lab phases. Compare full nft ruleset before/after dry-run. |
| Real Google sign-in/linking and provider code/PKCE exchange | Credentials unavailable. Use the documented exact localhost callback and an existing-account link confirmation. Claim-validation failures and browser binding are covered with fixtures. |
| Mailpit delivery through the running Compose worker | Queued/deduplicated notification and failure contracts are tested; actual SMTP container delivery awaits Compose. |

TCP binding and Docker socket access were rechecked and still return
`PermissionError: [Errno 1] Operation not permitted`. No user setting that enables
these capabilities has been established for this chat. The follow-up checks
below can run on the reference Windows host; no change to this chat is required.

## Run the remaining deployment checks on Windows

Use a fresh checkout and a disposable local deployment with the runtime versions
in README.md. These commands are **instructions, not executed results**. Keep
their output when updating this record. Do not run migrations backward against
an existing application database or remove an existing Compose volume.

### 1. Fresh dependencies and frontend build

From a new checkout in PowerShell 7.4+, with Python 3.12.14, Node 24.19.0 and npm
11.9.0 available:

```powershell
python --version
node --version
npm --version
python -m venv .venv
./.venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements-dev.txt
python -m pip check
$env:PYTHONPATH = 'backend;.'
python -m pytest -q
Push-Location frontend
npm ci
npm run check
npm run build
Pop-Location
```

Every command must exit successfully. Do not enable `BULKHEAD_TEST_POLL_LOOP` on
the host: the normal event loop is part of this check. Pytest's default database
is a disposable SQLite file, regardless of the application database setting.

### 2. Compose startup, live migrations and health

In the same fresh checkout, start Docker Desktop with Linux containers enabled:

```powershell
Copy-Item .env.example .env
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
docker compose logs --tail 100 migrate api worker
docker compose run --rm migrate alembic -c backend/alembic.ini check
Invoke-RestMethod http://localhost:8080/api/v1/health
```

Allow startup to finish before the health request. Require a successful one-shot
migration, healthy database/API/worker, no Alembic drift, and HTTP 200 reporting a
healthy worker. A built image or a running container alone does not pass this
check. Keep the default adapter-disabled/dry-run configuration.

### 3. PostgreSQL regression suite

Publish the development database port on loopback and create a separate test
database once. This example uses the unchanged development password from
`.env.example`; adjust the connection URL securely if it was changed.

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up -d db mailpit
docker compose exec -T db createdb -U bulkhead bulkhead_test
$env:BULKHEAD_TEST_DATABASE_URL = 'postgresql+psycopg://bulkhead:bulkhead-local@localhost:5432/bulkhead_test'
python -m pytest -q
Remove-Item Env:BULKHEAD_TEST_DATABASE_URL
```

The fixture drops and recreates tables in the explicitly named `_test` database.
Require all tests to pass without skips. This run exercises PostgreSQL-backed
application behavior; actual process/database restart recovery is a separate
check below. The test database must never be the application database.

### 4. Browser and actual Mailpit delivery

With the complete Compose deployment healthy:

```powershell
python -m playwright install chromium
python tests/browser.py
```

The script creates a unique user and household, obtains verification email from
Mailpit, and exercises existing pages, themes, response profiles, scenarios,
incident handling, undo, audit failure, graph selection and responsive layout.
Require its final PASS message and no uncaught page errors. The screenshot is
written under the ignored `test-results/` directory. This is the first check that
establishes real browser behavior and worker-to-Mailpit delivery together.

### 5. Worker/database restarts and reconnect

Sign in to a disposable household in the browser, keep its event stream open, and
obtain that household UUID and your own `bulkhead_session` cookie using browser
developer tools. Supply the cookie through a hidden prompt so it is not saved in
command history:

```powershell
$householdId = Read-Host 'Disposable household UUID'
$sessionCookie = Read-Host 'Your bulkhead_session cookie' -MaskInput
try {
    ./tests/restarts.ps1 -HouseholdId $householdId -SessionCookie $sessionCookie
} finally {
    Remove-Variable sessionCookie
}
```

Require simulation ticks to advance after each restart and household records to
remain present. Also verify that the browser reconnects, receives ordered replay,
and resumes updates without a reload. The PowerShell script checks persistence
and tick recovery; it does not automatically assert browser WebSocket recovery.

### 6. Credential/Windows-dependent acceptance

Follow README.md for the exact Google callback and authenticated account-linking
confirmation. Exercise real sign-in and linking after securely supplying Google
credentials. Record provider success/failure separately from the JWT fixtures.

On the Windows Intel/AMD VirtualBox host, run Setup-Lab and Initialize-Lab, then
Test-Lab in baseline, quarantined and restored phases. Require the plug to reach
IoT before quarantine, fail afterward, and succeed after restoration, while the
work endpoint continues to succeed. Compare the full router ruleset before and
after dry-run; it must be unchanged. Record automatic expiry and failed-change
restoration results, then return both adapter configurations to disabled/dry-run.

The VM image pins come from published checksum information. Image downloads and
on-host integrity comparison still occur in Setup-Lab; they were not executed
here. Signature files are retained by setup, but GPG verification is not claimed.

The application explicitly displays that physical-device protection, vendor-cloud
enforcement and the public simulator are later phases. The adapter stays disabled
and dry-run stays enabled. Unexecuted checks must not be treated as passed.
