# PHANTOM × BULKHEAD — Repository-Specific Product Requirements Document

**Target repository:** https://github.com/KabirGoswami/bulkhead1  
**Reference branch inspected:** `main` (2026-10-24)  
**Status:** Implementation specification for an existing project, not a claim that the functionality is already deployed  
**Product:** PHANTOM, a reality-aware security feature inside Bulkhead

## 1. Product thesis

Bulkhead already models smart-home devices, baseline events, threats, household authorization, incident workflows, policies, and a **limited, explicitly configured** network-quarantine adapter. PHANTOM must add something substantively different: verify whether an incoming sensor report is contextually plausible *and* whether any proposed automation that depends on that report is safe to execute. Do not rewrite Bulkhead, invent a replacement UI, or misrepresent simulation as real-world device protection.

**Value proposition:** “Bulkhead asks whether a device is risky. PHANTOM asks whether the *specific event it reports* is trustworthy enough to trigger the *specific action* about to occur.”

**North-star demo:** A simulated compromised door sensor sends an authenticated but false event. Existing messages look legitimate, but supporting sensors disagree. PHANTOM marks the event unverified, preserves routine low-risk convenience, and holds a high-impact automation. An authenticated homeowner can review the evidence and approve or deny a *specific* command. The same scenario in an explicitly isolated vulnerable-mode simulator reveals what would have happened without PHANTOM.

## 2. Verified repository baseline and integration boundaries

The repository currently contains:

| Existing subsystem | Real repository path | Reuse/constraint |
|---|---|---|
| API / route registration | `backend/app.py` | Register new PHANTOM router; keep `/api/v1` conventions and middleware |
| Session/CSRF/roles | `backend/bulkhead/security.py`, `backend/bulkhead/auth.py`, `backend/bulkhead/households.py` | Reuse `CurrentUser`, `household_access`, origin/CSRF checking and membership roles |
| Persistent household data | `backend/bulkhead/db.py`, `backend/migrations/*` | Add versioned migrations; avoid process-global state |
| State, seed, scenario ticks | `backend/bulkhead/service.py`, `backend/simulator.py` | Extend carefully; do not break A/B/C scenarios or detector baselines |
| Existing network events/alerts | `backend/events.py`, `backend/detector.py`, `backend/alert_model.py`, `backend/bulkhead/incidents.py` | Reuse incident/audit primitives where semantically appropriate |
| Network policy simulation | `backend/bulkhead/policies.py`, `backend/policy.py`, `backend/blast.py` | Do not confuse network policy with PHANTOM's new automation action policy |
| Gateway isolation adapter | `backend/bulkhead/gateway.py`, `gateway/agent.py`, `lab/` | Never reuse for arbitrary locks; real adapter limited to approved fixture and explicit flags |
| Server events and worker | `backend/bulkhead/events.py`, `backend/bulkhead/worker.py` | Reuse household-scoped event sequence, resumable WebSocket and worker model |
| Frontend shell/navigation | `frontend/src/App.tsx`, `frontend/src/lib/api.ts` | Preserve existing design, authenticated requests, styles, and route conventions |
| Visualization | `frontend/src/components/HomeMap.tsx` | Preserve existing React Flow network topology; optionally add a reality-evidence view |
| Demo panel | `frontend/src/components/ScenarioControl.tsx` | Add separate PHANTOM scenarios or clearly labeled tabs rather than breaking A/B/C |
| Alerts and permissions UI | `frontend/src/components/AlertFeed.tsx`, `PoliciesPage.tsx` | Integrate explanatory evidence and pending approvals |
| Tests | `tests/test_application.py`, `tests/test_security.py`, `tests/test_integrations.py`, `backend/tests/*` | Keep existing regressions passing; add PHANTOM tests |

Important existing facts: `service.snapshot()` advertises simulation/physical-protection capability flags; network quarantine can be real **only** for an authorized, restricted fixture; event stream rechecks access; database changes and emitted event records are transactionally coupled; existing simulation tick and alert engine are already present. All of these must remain true.

The app currently uses Python/FastAPI, SQLAlchemy with SQLite/PostgreSQL, React/TypeScript/Vite, and server WebSockets; **MQTT is not currently a verified production dependency**. Avoid adding Mosquitto unless an optional adapter has a clear purpose.

## 3. Target users

- **Owner/Admin:** inspect suspicious reality evidence, manage safe automation rules, approve a narrowly scoped sensitive action.
- **Viewer/guest:** read only household-appropriate statuses; never bypass protected actions; roles/expiry continue to apply.
- **Hackathon judge:** watch a deterministic simulated sensor discrepancy, see *why* a sensitive action was held, compare before/after, and verify normal conveniences remain functional.
- **Developer:** run tests offline, seed a demonstration without cloud credentials/hardware, and inspect audit records.

## 4. Threat model and non-goals

### In scope
1. Replayed valid-looking simulated sensor messages.
2. Forged messages from unregistered device identities (in controlled demo ingest).
3. Compromised *registered* simulated sensor that reports contextually inconsistent data.
4. Unsafe event-to-action causality (e.g. one sensor event causing a high-impact command without independent authorization).
5. Unauthorized/expired user approval and cross-household access.
6. Benign failures: missing, delayed, stale, noisy or disconnected sensors.

### Out of scope for hackathon MVP
- Proven physical-world truth from metadata alone.
- Generic sniffing, decrypting, or mediating every proprietary device protocol.
- Disabling smoke alarms, interfering with emergency egress, controlling physical locks/medical devices.
- Claiming voice biometrics, passkeys, or physical enforcement without a correctly integrated implementation.
- Training foundation models or requiring constant audio/video recording.

**Fundamental premise:** Authentication proves sender origin, not sensor truth. Absence of a motion event is not proof that a door never opened; a door may open without an entry. Treat ambiguity as **unknown**, not malicious.

## 5. Design objectives and measurable acceptance criteria

**P0 — secure event-to-action pipeline**
- Every proposed **simulated** sensitive automation passes a server-owned PHANTOM decision before any mutation of simulated actuator state. Browser code must not be able to bypass this.
- Reject duplicate message ID or stale/out-of-order sequence for a device. Rejected messages cannot trigger actions.
- Household partitioning is enforced on every query, event, decision, command and approval.
- Security decisions are explainable: evidence, rule IDs, risk, action attempted, allow/hold/deny and reason.
- Deterministic scenario suite runs without a real smart device or vendor account.

**P1 — resident experience**
- Ordinary lighting/comfort actions continue without step-up approval on valid low-risk events.
- High-impact simulated actuation requires adequate verification; pending approval is bound to actor, home, exact target, action, payload hash, policy revision and expiry.
- Owner/Admin can reject or approve once; a consumed or expired approval is not reusable.
- UI distinguishes `verified`, `inconsistent`, `unknown`, and `rejected`; never labels contradiction as conclusive hacking.
- Privacy: event metadata only by default; no raw surveillance footage/recorded audio; retention configurable; do not expose device secrets.

**P2 — polished demonstration and metrics**
- Before/after mode displays the actual result of two *separate simulated policy evaluations* and never globally disables the app's existing security.
- Show accepted/rejected messages, held sensitive actions, approval latency, false alerts under benign fault, and normal actions unaffected.
- README/demo script documents setup, limitations and three deterministic scenarios.

## 6. Proposed data and event contracts

Implement new Pydantic schemas and SQLAlchemy models, naming them to avoid collision with `EventRecord`, `Action`, `PolicyRecord`. Fields below describe the data contract, not mandatory literal table names.

### SensorEvent
`event_id`, `household_id`, `device_id`, `event_type`, `observed_at`, `received_at`, `sequence`, `source` (`simulated` / supported adapter), `attributes` (allowlisted, non-sensitive), `auth_status`, `ingress_verdict`, `scenario_run_id`. Restrict event types to known schema (e.g. `door.open`, `door.closed`, `motion.detected`, `lock.locked`, `lock.unlocked`, `presence.detected`, `sensor.offline`). Validate time skew, IDs and payload sizes.

### Evidence / RealityAssessment
`id`, `household_id`, `trigger_event_id`, `window_start/end`, `supporting_event_ids`, `missing_sensor_ids`, `conflicts`, `risk_score`, `state` (`verified`, `inconsistent`, `unknown`, `rejected`), `reason_codes`, `explanation`, `created_at`, `expires_at`. Confidence must be transparent and deterministic for demo. Never claim Bayesian certainty without validated calibration.

### AutomationRule and CommandDecision
`rule_id`, `household_id`, `trigger`, `action`, `target_device_id`, `sensitivity` (`routine`, `protected`), `enabled`, `revision`.
`command_id`, `idempotency_key`, `assessment_id`, `decision` (`allow`, `hold`, `deny`), `reason_codes`, `policy_revision`, `actor_id`, `created_at`, `executed_at`, `execution_mode: simulation`.

### ApprovalChallenge
`challenge_id`, `household_id`, `requesting_actor_id`, `required_role`, `command_id`, `payload_digest`, `policy_revision`, `expires_at`, `consumed_at`, `decision`, `approver_id`. Never store raw password, CSRF token, bearer secrets or passkeys in logs; use existing server-side sessions and confirmed recent authentication for step-up, if safely available. Reject cross-user/cross-home approvals. If true step-up authentication cannot be completed, explicitly label a secure owner-session confirmation as **approval** rather than biometric verification.

### Virtual actuator state
Add scoped simulated actuators/actions (`hallway_light`, `entry_lock`, `privacy_camera`, etc.) separate from real router/device state. Use durable server-side state; no frontend-only `blocked=true` flags.

## 7. Detection and decision rules

### Input verification
- Registered device + household linkage check.
- Cryptographically authenticated source for any external device adapter; a server-owned simulator is not an untrusted physical device. If using per-device HMAC, canonicalize messages; rotate/store secrets securely; compare in constant time. Do not put signing keys in browser JavaScript.
- Message ID replay protection and per-device monotonic counter in durable storage with transactionally enforced uniqueness. Time window allows reasonable skew, but not duplicate execution.
- Never expose a public, unauthenticated endpoint where arbitrary events enter another household's timeline.

### Contextual verification (starter deterministic rule engine)
- **Expected corroboration:** door open followed by nearby motion *may* corroborate entry; no motion => uncertainty, not proof of spoofing.
- **Physical sequence:** lock state and door state can raise confidence but are not required to agree at every instant.
- **Timing:** assign explicit correlation window (e.g. 10 seconds) and handle out-of-order events, offline sensors, clock skew and grace period.
- **Confidence:** positive evidence and contradictions with weights, but use fixed, documented scoring and exact reason codes; do not pretend a bare score is an attack probability.
- **Safety:** do not suppress alarms/emergency notifications based on conflicting readings.

### Enforcement policy
- Routine actions such as hallway light ON may execute even if context is ambiguous, if risk is low.
- Protected simulated commands such as entry-door unlock, security-mode disable or footage sharing must be held/denied without required evidence and strong authorization.
- Locking can have different risk semantics than unlocking; respect evacuation/safety constraints. Do not automatically lock out occupants.
- Held commands are never executed by background timer; must pass fresh authorization and reevaluate current policy/reality before execution.
- Policy changes, logout, membership revocation and expiry invalidate pending approvals.
- A `deny` or `hold` must result in no actuator state mutation and a testable audit decision.

## 8. API design (suggested; adapt to existing router conventions)

All interactive household routes under `/api/v1/households/{household_id}/phantom`, using `CurrentUser`, `household_access`, CSRF/origin middleware, transactional audit and `changed()` where applicable.

| Method/path suffix | Role | Purpose |
|---|---|---|
| `GET /overview` | member | Current evidence, decisions, actuator state, privacy/simulation capabilities |
| `GET /assessments` | member | Household-scoped assessment history with safe pagination |
| `GET /decisions` | member | Causal decision timeline, no secrets |
| `GET /rules` | member | Configured automation policy |
| `POST /rules` | Owner/Admin | Validated, revisioned rule creation/editing |
| `POST /demo/run` | Owner/Admin | Execute known scenario ID in isolated simulation, deterministic seed; no arbitrary event injection |
| `POST /demo/reset` | Owner/Admin | Reset PHANTOM-only simulated state; preserve existing A/B/C and audits |
| `POST /commands` | Owner/Admin | Propose exact simulated command; mediated by PHANTOM |
| `POST /approvals/{id}/decision` | Authorized actor | Approve/deny exact pending challenge; single-use, fresh auth, idempotent |
| `PATCH /privacy` | Owner/Admin | Retention and metadata storage choices |

If needed add a separately authenticated non-browser ingest route for a **known simulated device harness**, not a generic user-accessible injection route. Use event stream `emit(...)` with PHANTOM-specific types; preserve existing `SIM_TICK`, `STATE_UPDATE` and reconnect semantics.

## 9. Frontend product requirements

- Add a *PHANTOM / Reality Check* entry within the existing `frontend/src/App.tsx` route/nav model. Preserve the current branding and colors rather than replacing it.
- Build `frontend/src/components/PhantomPage.tsx` and small components for status, evidence, decision chain, approval and a demo switcher. Prefer existing CSS conventions and `lucide-react`.
- Reuse `frontend/src/lib/api.ts` (credentials + CSRF), session context and existing household selection; no direct insecure fetch wrappers or new auth logic.
- Show intuitive path: **device message → identity/freshness → physical evidence → risk assessment → policy → action/approval**.
- Reuse/enhance `HomeMap` React Flow carefully; visual link to affected sensor and actuator, and explain which sensor *disagrees*. Avoid rendering camera imagery.
- Provide evidence drawer: device, timeline, other signals, reason code, impact, permitted next action, explicit simulation disclaimer.
- The UI must read decisions from backend; no fake local-only allow/block decisions. Add loading, unauthorized, expired challenge, stale revision, no-home and error states.
- The normal Bulkhead dashboard, login, household, device, policy, alerts and original scenario tabs must remain functional.

## 10. Phased implementation plan

**Phase 0 — audit and baseline:** run existing tests/build, inspect schema/migrations and routes, map semantics of `tick`, `Action`, `PolicyRecord`, gateway, and WebSocket event store. Create feature branch and record baseline failures.

**Phase 1 — schemas and ingress:** create versioned data models/migration, allowlisted event schemas, household/device trust and durable freshness guard. Unit test unregistered, replay, stale, cross-household and concurrent duplicate events.

**Phase 2 — verification engine:** deterministic sensor correlation windows, explicit unknown vs inconsistent states and reason codes. Unit test door opens without entry, late motion, offline sensor, false sensor message, conflicting lock status.

**Phase 3 — protected action enforcement:** backend automation mediator and durable simulated actuator state; enforce no bypass, no double-execution and routine convenience. Integrate exact-action approval using existing owner/admin permissions and recent-auth requirements if feasible.

**Phase 4 — frontend and demo:** integrate PHANTOM page and explainable visual chain; deterministic scenario run, reset and safe comparison; privacy controls and capability labels.

**Phase 5 — hardening:** re-run security/functional regressions and builds; concurrency tests; docs; screenshots optional; complete a final requirements matrix with limitations.

## 11. Required deterministic scenarios

1. **Normal entry:** door opens → motion follows within allowed window → hallway light turns on, no approval. Do not falsely claim an exact resident identity.
2. **Compromised valid sensor:** authenticated door event with missing/contradictory corroboration; status `unknown`/`inconsistent`, alert explains ambiguity; protected auto-unlock is **held** and actuator state unchanged.
3. **Replay:** exact old message submitted again; rejected at ingress, no repeated effect.
4. **Forged/unregistered:** unknown simulated device key fails authentication; does not modify state.
5. **Sensitive command approval:** owner action gets narrow single-use challenge; wrong role, expired, stale policy, forged command payload and second approval all fail.
6. **Benign sensor dropout:** sensor offline; risk is unknown rather than attacker; normal lights remain usable; no dangerous suppressions.
7. **Cross-household isolation:** Household A cannot read/approve/trigger or obtain PHANTOM evidence from Household B.
8. **Existing Bulkhead regression:** original A/B/C, alerts, existing incident/contain/undo and gateway dry-run remain unchanged.

## 12. Nonfunctional requirements

- Fast enough for interactive hackathon demo; record p50/p95 end-to-end decision latency rather than inventing performance claims.
- Deterministic outcomes for seeded fixtures; simulate network jitter and fault intentionally.
- Retention defaults defined (recommend 7 days for detailed sensor-event metadata, configurable; summarize metrics longer if desired), no raw audio/video; strict authorization and no secret leakage.
- Concurrency-safe idempotency. New migrations work on SQLite and PostgreSQL, with rollback documentation.
- Clear separation between **simulation** and **physical enforcement** (the restricted current OpenWRT fixture is unrelated to smart-lock actuation).
- No LLM in the critical allow/deny path. Optional LLM may summarize existing explainable decisions after enforcement, but is never authoritative.

## 13. Commands and release gate

After reading repo scripts/requirements, run and report results for:

```bash
python -m pytest -q
cd frontend && npm ci && npm run check && npm run build
```

A failing baseline is not permission to delete/relax tests. Do not silently edit or reset unrelated code. Keep diff reviewable and commit PHANTOM separately if working in a development agent workspace. CI/dependencies may vary; report actual commands used, evidence and limitations.

**Definition of done:** normal actions flow; risky actions cannot execute without server permission; replay/forgery/inconsistency are visibly and correctly differentiated; scope/CSRF/roles respected; privacy minimal; no regression of Bulkhead; capabilities truthfully labeled; tested and demonstrable without physical hardware.
