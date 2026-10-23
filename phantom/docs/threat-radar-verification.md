# Threat radar verification

The radar uses a 14-second CSS sweep. The beam begins at north and rotates
clockwise. Every marker's pulse starts at `bearing / 360 * 14` seconds; both the
beam and contacts inherit the same duration and play state. Scan Again remounts
that shared clock and resumes it. There is no animation-frame React state loop.

Verified in the running Safari preview:

- Clicking the door marker selects it, expands its existing card, and updates
  adjacent evidence, device, timestamp, severity, confidence, and uncertainty.
- Clicking the existing camera card highlights the camera marker and updates
  the adjacent panel with camera evidence.
- Pause changes to Resume; Scan Again resumes and restarts the cycle while
  retaining the same three findings.
- Critical filtering displays only the door marker, door evidence, and door card.

Additional checks passed:

- Marker positions remain within the radar and polar bearings match pulse timing.
- Each finding's evidence renders in the adjacent panel.
- Severity filtering preserves the expected marker counts.
- Correlation lines reference existing findings and the captured correlation event.
- Production build and lint pass.

Outstanding visual acceptance check:

Safari reports the inspected page as `document.visibilityState === 'hidden'`.
Its CSS animation is `running`, with duration 14000ms, but `currentTime` remains
0 across delayed samples. This is browser background-animation suspension.
Continuous rotation and beam-contact illumination must be checked with PHANTOM
in the foreground before claiming full visual acceptance.

With the radar visible, watch a complete cycle: marker 01 illuminates at 0.778s,
marker 02 at 5.444s, and marker 03 at 10.111s. Each repeats every 14 seconds.
Select a marker and check its focus ring and brief dashed time-window association
lines. Click Scan Again and confirm the beam immediately resets to north.
Reduced motion should show a static beam and keep all investigation controls usable.
