Bulkhead backend and frontend review — 23 October 2026

The Bulkhead React frontend connects to the local HTTP API, but the application does not work correctly end to end. The initial WebSocket state arrives; the first live tick crashes the background simulation. Several response-policy, detection, and UI-state bugs remain even after that transport failure is addressed.

Application files were not modified. Tests used a dedicated backend process, a temporary frontend production build, and isolated in-memory fixtures. The existing untracked root index.html was preserved.

Scope and entry points

Reviewed the backend application, models, simulator, baseline/detector, reachability/exposure calculation, audit/fixes, profiles, response policy, all 14 existing tests, active frontend components and styles, build configuration/manifests, and setup documentation. Vendored dependencies and generated bundles were treated as dependencies rather than application source.

Bulkhead starts from [frontend/index.html](/workspace/bulkhead1/frontend/index.html:10), which imports frontend/src/main.tsx and App.tsx. The tracked root src/components directory contains unused older copies. The untracked [root index.html](/workspace/bulkhead1/index.html:1) is the separately requested Driftbar footer: it has no JavaScript or backend requests and is not Bulkhead's Vite entry point.

Verification results

| Check | Result and limits |
|---|---|
| Backend startup | Pass using the documented backend working directory and python app.py. |
| Existing backend test suite | 14 passed; no tests skipped. These are unit tests and do not catch the failing live WebSocket workflow. |
| GET /state | HTTP 200; 10 devices, 2 accounts, initial exposure score 100. |
| GET /audit | HTTP 200; 7 initial findings. |
| GET /blast/plug_1 | HTTP 200; 12 reachable nodes. |
| Local browser CORS preflight | Pass for the frontend origin and POST /profile. |
| Profile requests | Admin, Family, Work, Solo accepted. This verifies requests, not correctness of policy overrides. |
| Scenario trigger requests | A, B, C accepted. This does not verify detection or containment. |
| Normal firmware audit fix | Pass; finding removed and firmware age updated. |
| Device confirmation / undo | Valid action record and successful undo response. Containment does not reduce modeled reachability. |
| Reset / invalid requests | Fail; reset is shadowed and error branches return HTTP 200 with an error/status tuple encoded as a JSON array. |
| Real WebSocket | Initial STATE_UPDATE received; no SIM_TICK within three seconds. Backend logged TypeError and background-task termination. |
| Real browser connection | 12 map nodes, two real GET /state calls, two initial STATE_UPDATE frames, zero SIM_TICK frames; UI still says API connected. |
| Browser error/state checks | Reproduced false secure audit, stale map, profile reset on reload, and notify-only containment request. No JavaScript runtime exception was needed to trigger them. |
| Standard npm run build | Fails in this Linux checkout: vite: Permission denied. |
| Frontend build with existing Linux helper packages | Pass; 2,161 modules transformed. This is a workaround, not a passing standard build command. |
| TypeScript check | Pass with explicit Vite-compatible compiler settings and the existing Linux TypeScript helper. |

Test runtime: Python 3.12.14, FastAPI 0.141.1, Uvicorn 0.52.1, Pydantic 2.13.4, NumPy 2.3.5, Node 24.19.0. Pytest 9.1.1 was installed into a temporary environment with system packages available. Build outputs and diagnostics were written outside the checkout.

Prioritized findings

1. **P1 — A real browser subscription crashes live simulation.**

   [app.py:101](/workspace/bulkhead1/backend/app.py:101) sends event .dict() values containing Python datetime objects through [broadcast at line 50](/workspace/bulkhead1/backend/app.py:50). Starlette's send_json uses json.dumps and raises TypeError: Object of type datetime is not JSON serializable. The exception escapes the unsupervised background task created at line 60. A real socket received its initial state and timed out waiting for its next tick; the process log confirmed the exception. GET /state still returned 200 afterward, so the frontend's HTTP-based API connected indicator does not reflect whether simulation is alive. Alerts, timeline updates, detection, and automatic response stop together.

2. **P1 — The API and WebSocket addresses are not usable for normal remote hosting.**

   [App.tsx:17](/workspace/bulkhead1/frontend/src/App.tsx:17), [AlertFeed.tsx:6](/workspace/bulkhead1/frontend/src/components/AlertFeed.tsx:6), HomeMap, AccessHealth, ProfileSwitcher, ScenarioControl, and Timeline hardcode localhost:8000. [vite.config.ts:6](/workspace/bulkhead1/frontend/vite.config.ts:6) has no API proxy or shared configurable backend origin. Local connectivity was verified. A person opening a hosted frontend will instead send requests to their own machine's localhost. Endpoint configuration needs to account for the actual host and HTTP/WebSocket schemes.

3. **P1 — Failed audit requests display a successful security result.**

   [AccessHealth.tsx:28](/workspace/bulkhead1/frontend/src/components/AccessHealth.tsx:28) only logs errors, and finally clears loading. Initial findings remain empty, so [line 58](/workspace/bulkhead1/frontend/src/components/AccessHealth.tsx:58) renders All Systems Secure. A browser diagnostic aborted GET /audit and reproduced that exact heading. Failed loading needs an explicit error state rather than the successful empty-result state.

4. **P1 — Notify-only alerts are converted into containment requests.**

   [AlertFeed.tsx:89](/workspace/bulkhead1/frontend/src/components/AlertFeed.tsx:89) renders Confirm whenever response exists, regardless of requires_confirmation or action. [Line 42](/workspace/bulkhead1/frontend/src/components/AlertFeed.tsx:42) always submits CONTAIN. A deterministic WebSocket fixture with thermostat, action NOTIFY, requires_confirmation false, and can_auto_act false displayed Confirm; clicking it made a real API request that created a CONTAIN action. The backend confirmation endpoint does not check that the action matches a pending alert's policy. This tests UI policy handling with a fixture; it does not claim the broken real stream delivered the event.

5. **P1 — Sources first seen after warmup never become detectable.**

   [baseline.py:65](/workspace/bulkhead1/backend/baseline.py:65) learns only during the first 100 events globally and finalizes only the baselines present at event 100. Later sources are created with is_learned false forever; [detector.py:21](/workspace/bulkhead1/backend/detector.py:21) drops all their events. Normal simulator traffic does not create account authentication baselines. After 100 ordinary flow events, ten anomalous failed logins from camera_vendor_acc produced zero alerts and its baseline stayed unlearned. Scenario B therefore cannot work when first started after normal warmup, independently of the WebSocket failure.

6. **P1 — Containment does not limit the application's modeled blast radius.**

   [policy.py:75](/workspace/bulkhead1/backend/policy.py:75) narrows destinations and clears explicit peers, but [blast.py:37](/workspace/bulkhead1/backend/blast.py:37) still traverses same-zone and shared-account paths. Live API testing confirmed that plug_1 reaches the identical 12 nodes before and after CONTAIN. Isolated policy testing also leaves exposure at 100. There is no isolation state recognized by the reachability model, and simulator traffic also does not consult the containment restrictions.

7. **P1 — A failed WebSocket can also kill shared work or fail writes after mutation.**

   [app.py:48](/workspace/bulkhead1/backend/app.py:48) does not isolate send errors between subscribers. An isolated closed-socket diagnostic stopped simulation at tick one and prevented delivery to a healthy subsequent socket. The same failure made /audit/fix return 500 after applying the firmware change. [The WebSocket handler](/workspace/bulkhead1/backend/app.py:233) also appends before the initial send and only removes on WebSocketDisconnect, so other send failures can leave stale subscribers. JSON serialization and socket-lifecycle failures need separate treatment.

8. **P2 — Reset is unreachable, and API errors use successful HTTP status codes.**

   [app.py:214](/workspace/bulkhead1/backend/app.py:214) registers /scenario/{scenario_id} before /scenario/reset. Reset is treated as an invalid scenario; its handler at line 224 never runs. Live POST /scenario/reset returned HTTP 200 and [{"error":"Invalid scenario"},400]. Invalid profiles, unknown findings, invalid scenarios, and missing undo actions likewise return tuple arrays with HTTP 200, because FastAPI does not interpret Flask-style (body, status) return values. Axios consequently sees failed operations as successful responses.

9. **P2 — Account confirmation reports success without executing an action.**

   Account anomalies get a confirmation/containment recommendation, but [policy.py:66](/workspace/bulkhead1/backend/policy.py:66) looks up only device IDs. Live POST /action/confirm for camera_vendor_acc returned {"status":"confirmed","action":null}. This prevents the Scenario B account path from being remediated even after account detection is repaired. Unknown nodes are also falsely confirmed. ActionConfirmRequest additionally accepts arbitrary action strings and fabricated alert IDs without validation; an isolated request for action RANDOM created an action record with no state change.

10. **P2 — The shared-account Apply Fix action is a no-op.**

    [audit.py:69](/workspace/bulkhead1/backend/audit.py:69) emits SPLIT_ACCOUNT with empty fix_params. apply_fix only assigns entries from fix_params. A live fix for shared_household_admin returned status fixed, but the finding and account links remained. This finding should have a working operation or be presented as guidance without a misleading executable fix.

11. **P2 — Profiles do not execute their declared criticality overrides.**

    [profiles.py:22](/workspace/bulkhead1/backend/profiles.py:22) marks Work's router/laptop as safety-critical, but criticality_overrides is never consumed. [app.py:80](/workspace/bulkhead1/backend/app.py:80) uses the original device criticality and applies Work's high-to-auto rule instead. An isolated actual-loop diagnostic auto-contained the router while its safety override was ignored. Updating autonomy also changes only level/boolean fields; Solo can produce level 2 and requires_confirmation true while action and explanation still say NOTIFY.

12. **P2 — The displayed profile can disagree with the backend's active policy.**

    [ProfileSwitcher.tsx:9](/workspace/bulkhead1/frontend/src/components/ProfileSwitcher.tsx:9) always starts at Admin and changes selection before the request succeeds. Backend profile state is global and is not included in GET /state. Browser testing selected Work, reloaded, and saw Admin selected with no request resetting the backend profile. Failed requests and other browser clients produce the same disagreement. The active profile needs a server-readable representation and successful-request synchronization.

13. **P2 — The network map becomes stale and cannot explain all modeled connections.**

    [HomeMap.tsx:113](/workspace/bulkhead1/frontend/src/components/HomeMap.tsx:113) fetches once and ignores STATE_UPDATE broadcasts. While its map stayed open, a real audit fix changed speaker from main to iot in the backend; the UI still showed main zone. Its edge construction also omits explicit allowed_peers and the device-to-account direction traversed by the backend. These omissions make highlighted reachability difficult to reconcile with displayed paths.

14. **P2 — Action completion, undo, and stream recovery are incomplete in the UI.**

    [AlertFeed.tsx:40](/workspace/bulkhead1/frontend/src/components/AlertFeed.tsx:40) discards the returned action and never marks confirmation complete; the browser retained Confirm after a successful real request. Its undo handler has no rendered control or retained action ID. [Timeline.tsx:19](/workspace/bulkhead1/frontend/src/components/Timeline.tsx:19) only accepts SIM_TICK alerts, so manual actions sent as STATE_UPDATE have no timeline entry. Both subscribers only register onmessage and have no reconnection, onclose/onerror status, or replay after a backend restart. Page navigation now preserves mounted history, but transport loss still silently stops it.

15. **P2 — Alert and action IDs collide within the same second.**

    [detector.py:67](/workspace/bulkhead1/backend/detector.py:67) and [policy.py:82](/workspace/bulkhead1/backend/policy.py:82) use integer Unix seconds as identifiers. Isolated fixed-time diagnostics created two actions with the same ID; undo of the second restored the first device and removed both records. Duplicate alert IDs are also used as React keys. The event rate can routinely exceed one alert/action per second.

16. **P2 — Benign vendor updates lack the advertised recognition logic.**

    [detector.py:29](/workspace/bulkhead1/backend/detector.py:29) considers only learned exact destinations and traffic volume, without consulting verified/vendor destination rules. An isolated trained thermostat received both NEW_EXTERNAL_DESTINATION and VOLUME_SPIKE for a 2 MB updates.google.com event. [The existing benign-update test](/workspace/bulkhead1/backend/tests/test_detector.py:46) manually adds that destination and only checks the absence of one reason, so it does not establish benign classification. Safety-critical policy prevents automatic containment by default, but that is different from recognizing the update as benign.

17. **P2 — Rapid graph selection can display another source's results.**

    [HomeMap.tsx:132](/workspace/bulkhead1/frontend/src/components/HomeMap.tsx:132) launches requests without cancellation or matching each result to the current selection. Source review shows that selecting A then B, followed by a late A response, leaves B selected with A's reachability. This was identified by source review rather than a live latency-injection reproduction.

18. **P2 — The checked-in dependency tree and runtime documentation are not portable.**

    The tracked frontend/node_modules tree contains Windows shims/native packages. Its .bin/vite is stored with Git mode 100644; standard npm run build fails with Permission denied in this Linux environment. The build passes with the previously installed Linux native helper packages and a direct Node invocation, while dependency declarations and lockfiles remain unchanged. [README.md:41](/workspace/bulkhead1/README.md:41) also says Node 18+, whereas the locked Vite 8/plugin-react 6 packages require ^20.19.0 or >=22.12.0. Backend dependencies are documented as an unpinned pip install rather than a dependency manifest; tests also need the backend directory on PYTHONPATH.

Suggested repair order

Restore JSON-safe live events and resilient subscriber/background-task handling first. Centralize environment-aware API/WebSocket addresses and truthful connection/error states next. Then repair detection warmup, containment semantics, policy/action validation, reset/status handling, and profile/state synchronization. Add real API/WebSocket/browser integration tests for these behaviors; the passing unit suite currently gives no protection against the main integration failures.

Reproduction artifacts

- Existing tests: PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/workspace/bulkhead1/backend /tmp/bulkhead-review-venv/bin/python -m pytest -q -p no:cacheprovider backend/tests
- Live API/WebSocket probe: /tmp/bulkhead-live-review.py, using a dedicated backend process on localhost:8000.
- Browser probe: /tmp/bulkhead-browser-review.py, using a temporary production build served on localhost:4181.
- Frontend build workaround: NODE_PATH=/workspace/bulkhead-tools/node_modules node node_modules/vite/bin/vite.js build --outDir /tmp/bulkhead-review-build, from frontend/.

Fixture-driven UI checks and isolated module diagnostics are identified above. They verify specific UI/policy/model defects and are not presented as a working live end-to-end simulation.
