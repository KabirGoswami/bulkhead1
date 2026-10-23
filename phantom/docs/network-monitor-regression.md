# Network Monitor selection regression

No browser/component test runner is installed in this project. Run these checks
in Safari with the JavaScript console open, and repeat in another browser when
available. Build and lint alone cannot verify this runtime interaction.

1. Run `npm run dev` and open the displayed local URL. Scroll to Network Monitor.
2. Use the dropdown to select Front door lock, Living room camera, Security hub,
   and Home gateway, in that order. Repeat forward and backward at least five times,
   including rapid switches. Each selection must update the device address,
   destination, and captured volume, and highlight exactly the matching node.
3. Click each of the four device nodes. The dropdown, node highlight, and inspector
   must agree after every click. Click the selected node again: selection stays stable.
4. Tab to a different diagram node and press Enter or Space. Verify the same update.
   Expected destination nodes must not become inspectable device selections.
5. Pan the canvas and use zoom controls, wheel zoom, and Fit View. Change the dropdown
   again: pan/zoom remain usable and selection does not reset the viewport.
6. Play the incident timeline and switch the network dropdown during playback.
   Pause playback; selecting a device must remain stable with no further updates.
7. Isolate the camera in Phantom Mode, confirming the dialog. Return to Network
   Monitor and switch through all four devices. The camera remains isolated,
   its unusual route remains blocked, and the other devices stay connected.
   Restore the camera and repeat device switching.
8. With reduced motion enabled, repeat dropdown and keyboard selections. Data-flow
   animations stop; selection and pan/zoom remain functional.

Throughout: no blank page, React maximum-update-depth warning, StoreUpdater error,
or continuously alternating dropdown/highlight. The landing page and Reality
Reveal must still work after the checks.

## Cause and correction

Controlled `nodes[].selected` and the effect-driven `onSelectionChange` callback
both wrote to workspace selection. A dropdown render could receive the previous
React Flow selection before StoreUpdater installed the new nodes, writing the
old device back and repeating the cycle. The inline listener also changed identity
on every render and retriggered React Flow's selection effect.

Selection now travels in one direction: workspace state -> controlled nodes.
Explicit pointer/keyboard selection uses a memoized `onNodesChange` handler that
accepts only `select: true` changes for a different valid device. Dimensions,
positions, deselection, and store synchronization never write workspace state.
There is no duplicate node-click setter or selection-snapshot callback. Node and
edge arrays remain memoized; Fit View and Pro options are module-level constants.

## Network animation checks

- Normal device links show two cyan packets moving in opposite directions along
  the actual edge. Camera and unusual-egress links show seven faster amber packets.
  The amber alert badge explicitly says SIMULATED.
- Click a device, then click it again: each click emits one expanding node outline
  and one scanning pass along its device/gateway/destination route. Switch via
  dropdown and keyboard; selection and the inspector must remain synchronized.
- Isolate each peripheral in Phantom Mode: its local edge shows a physical gap
  and break marker, and no packets. Camera isolation also stops unusual egress.
  Remaining devices and the vendor uplink continue sending packets.
- Restore the device: its edge and packets return. Pause/resume packets using the
  existing control. With reduced motion enabled, all packets and scan animation
  stop while routes, labels, selection, and the inspector remain available.
- Pan and zoom while packets move: packets must stay attached to their edge paths,
  with no floating dots and no continuous React state update loop.
