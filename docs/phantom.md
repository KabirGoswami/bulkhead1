# PHANTOM: Reality-Aware Security for Bulkhead

PHANTOM is a security module designed to prevent "sensor spoofing" and unauthorized virtual actuations by correlating claims from multiple independent sensors. It ensures that a high-impact action (like unlocking a door) is only allowed if the reported physical state is corroborated by nearby metadata.

## Technical Design

### Slice 1: Event Ingress & Replay Protection
PHANTOM implements a strict ingestion pipeline for simulated sensor events:
- **Identity & Freshness:** Every event must originate from a registered `PhantomSensor`. 
- **Replay Guards:** The system tracks `accepted_id` (UUID) and `last_sequence` (monotonic counter) per device. Duplicate IDs or stale sequences are rejected immediately.
- **Clock Guards:** Events with an `observed_at` timestamp outside a narrow window relative to server time are rejected as stale or spoofed.
- **Immutability:** Once a report is accepted, it is persisted as a "tombstone" to prevent the same ID from being used again, even if the event metadata is later purged for privacy.

### Slice 2: Physical-Context Correlation
When a "trigger" event occurs (e.g., `door.open`), PHANTOM performs a deterministic assessment:
- **Temporal Window:** It searches for corroborating reports (e.g., `motion.detected`) within a configurable window (default 10s).
- **Location-Based Correlation:** Only sensors in the same `location` (e.g., "entrance") are considered.
- **Verdicts:**
    - `VERIFIED`: Nearby metadata supports the event.
    - `UNKNOWN`: Evidence is incomplete (e.g., a door opened but no motion was detected).
    - `INCONSISTENT`: Reports contradict (e.g., door open contact but bolt sensor reports locked).
    - `REJECTED`: Ingress failed (replay or invalid source).

### Slice 3: Automation Mediation & User Approval
PHANTOM differentiates between **Routine** and **Protected** actions:
- **Routine (e.g., Light On):** Allowed if evidence is `VERIFIED` or `UNKNOWN`.
- **Protected (e.g., Unlock Door):** Always placed on `HOLD`.
- **Binding:** Approvals are bound to an "exact action" using a digest of the household, requester, target, command, and payload.
- **Approval Flow:** A protected action requires an authenticated Owner/Admin confirmation. This approval is single-use, time-limited, and invalidated if the household policy revision changes.

### Slice 4: API & User Experience
The module exposes a set of authenticated endpoints under `/api/v1/households/{id}/phantom` for overview, assessment inspection, and command approval. The frontend `PhantomPage` provides a "Decision Timeline" and a "Reality Check" panel to visualize the evidence chain.

## Demo Scenarios

The following deterministic scenarios can be run via the UI to demonstrate PHANTOM's effectiveness:

1. **Normal Entry**: Door open $\rightarrow$ Hallway motion $\rightarrow$ Light turns on automatically.
2. **Compromised Sensor**: Door open $\rightarrow$ Bolt reports locked $\rightarrow$ Unlock held (Inconsistent).
3. **Replay Attack**: Resend a previous valid message $\rightarrow$ Ingress rejects (Duplicate ID).
4. **Forged Sender**: Unregistered device reports event $\rightarrow$ Ingress rejects (Unregistered).
5. **Owner Approval**: Manual unlock request $\rightarrow$ Put on HOLD $\rightarrow$ Owner approves $\rightarrow$ Actuator state changes.
6. **Sensor Dropout**: Door open $\rightarrow$ Motion sensor offline $\rightarrow$ Light still works (Unknown), but lock remains protected.

## Security Boundaries

- **Simulation Only**: The module currently controls virtual actuators. No real hardware adapters are invoked.
- **No LLM in Loop**: Decisions are made via deterministic heuristics, not LLM inference, to ensure auditability and latency.
- **Privacy**: Sensor metadata is purged after a configurable retention period; only replay identifiers are kept.
- **Ownership**: Approvals cannot be forged by Viewers or users from other households.
