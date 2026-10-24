import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType, Position,
  type Node, type NodeChange, type FitViewOptions,
} from '@xyflow/react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight, Camera, Laptop, Lightbulb, Lock, Network, Plug,
  Radio, Router, Shield, Smartphone, Speaker,
  Thermometer, Unplug, type LucideIcon,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { LivingEdge, type LivingNetworkEdge } from './workspace/LivingEdge';
import { api, errorText } from '../lib/api';
import { useBulkhead } from '../lib/session';

const EDGE_TYPES = { living: LivingEdge };
const FIT_VIEW_OPTIONS: FitViewOptions = { padding: 0.18 };
const PRO_OPTIONS = { hideAttribution: true };

interface MapDevice {
  id: string;
  name: string;
  kind: string;
  zone: string;
  address: string;
  isolated: boolean;
  risk: string;
  observed: string;
}

const deviceIcons: Record<string, LucideIcon> = {
  router: Router,
  hub: Radio,
  camera: Camera,
  lock: Lock,
  thermostat: Thermometer,
  speaker: Speaker,
  plug: Plug,
  bulb: Lightbulb,
  phone: Smartphone,
  laptop: Laptop,
  alarm: Shield,
};

export default function HomeMap() {
  const reduced = useReducedMotion();
  const { state, path } = useBulkhead();
  const [selected, setSelected] = useState<string>('dev-camera-01');
  const [hovered, setHovered] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [scanRequest, setScanRequest] = useState({ deviceId: selected, count: 0 });
  const [blastRadius, setBlastRadius] = useState<string[]>([]);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const selectedScanKey = `${selected}-${scanRequest.deviceId === selected ? scanRequest.count : 0}`;
  const focused = hovered ?? selected;

  // Extract devices and accounts from Bulkhead backend state
  const devices: MapDevice[] = useMemo(() => {
    if (state?.devices && state.devices.length > 0) {
      return state.devices.map((d: any) => ({
        id: d.id,
        name: d.name,
        kind: d.type || 'router',
        zone: d.zone || 'main',
        address: d.ip || `192.168.1.${d.id.charCodeAt(d.id.length - 1) % 50 + 10}`,
        isolated: !!d.isolated,
        risk: d.isolated ? 'isolated' : (d.id.includes('camera') || d.id.includes('plug') ? 'warning' : 'secure'),
        observed: d.isolated ? 'Isolated · traffic blocked' : d.id.includes('camera') ? 'Feed frozen · latency spike' : 'Verified secure',
      }));
    }
    // Fallback devices if state is loading
    return [
      { id: 'dev-router-01', name: 'Home Router', kind: 'router', zone: 'main', address: '192.168.1.1', isolated: false, risk: 'secure', observed: 'Verified secure' },
      { id: 'dev-camera-01', name: 'Front Door Camera', kind: 'camera', zone: 'iot', address: '192.168.1.34', isolated: false, risk: 'warning', observed: 'Feed frozen' },
      { id: 'dev-lock-01', name: 'Front Door Lock', kind: 'lock', zone: 'iot', address: '192.168.1.21', isolated: false, risk: 'critical', observed: 'Door open' },
      { id: 'dev-hub-01', name: 'Smart Hub', kind: 'hub', zone: 'main', address: '192.168.1.12', isolated: false, risk: 'secure', observed: 'Normal traffic' },
      { id: 'dev-thermostat-01', name: 'Nest Thermostat', kind: 'thermostat', zone: 'iot', address: '192.168.1.45', isolated: false, risk: 'secure', observed: 'Normal telemetry' },
      { id: 'dev-plug-01', name: 'Smart Plug', kind: 'plug', zone: 'main', address: '192.168.1.50', isolated: false, risk: 'warning', observed: 'Compromised source' },
    ];
  }, [state?.devices]);

  const router: MapDevice = devices.find((d: MapDevice) => d.kind === 'router') || devices[0];
  const isolatedSet = useMemo(() => new Set(devices.filter((d: MapDevice) => d.isolated).map((d: MapDevice) => d.id)), [devices]);

  // Set default selection to first device once loaded
  useEffect(() => {
    if (devices.length > 0 && !devices.some((d: MapDevice) => d.id === selected)) {
      setSelected(devices[1]?.id || devices[0].id);
    }
  }, [devices, selected]);

  // Fetch blast radius whenever selection changes
  useEffect(() => {
    setBlastRadius([]);
    setAnalysisError('');
    if (!selected) return;

    const controller = new AbortController();
    setAnalysisLoading(true);
    api(path(`/blast/${selected}`), { signal: controller.signal })
      .then(response => {
        if (!controller.signal.aborted) setBlastRadius(response.reachable || []);
      })
      .catch(err => {
        if (!controller.signal.aborted) setAnalysisError(errorText(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnalysisLoading(false);
      });

    return () => controller.abort();
  }, [selected, path, state?.sequence]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (!devices.some((device: MapDevice) => device.id === node.id)) return;
    setScanRequest(previous => ({ deviceId: node.id, count: previous.count + 1 }));
  }, [devices]);

  const handleNodeEnter = useCallback((_: React.MouseEvent, node: Node) => setHovered(node.id), []);
  const handleNodeLeave = useCallback(() => setHovered(null), []);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const change = changes.find(c => c.type === 'select' && (c as any).selected);
    if (!change || change.type !== 'select' || (change as any).id === selected) return;
    const device = devices.find((d: MapDevice) => d.id === (change as any).id);
    if (device) setSelected(device.id);
  }, [selected, devices]);

  // Build nodes in the exact Phantom NetworkMonitor topology layout
  const nodes = useMemo<Node[]>(() => {
    const otherDevices = devices.filter((d: MapDevice) => d.id !== router.id);
    const cols = Math.min(4, Math.max(3, otherDevices.length));

    return [
      // 1. External baseline destination (Top Left)
      {
        id: 'external-trusted',
        position: { x: 30, y: 0 },
        data: {
          label: (
            <>
              <span className="node-kicker">BASELINE DESTINATIONS</span>
              <strong>Expected vendor relays</strong>
              <span>192.0.2.0/24 · simulated</span>
            </>
          ),
        },
        className: 'topology-node external-node',
        selectable: false,
        focusable: false,
        targetPosition: Position.Bottom,
      },
      // 2. External unusual destination (Top Right)
      {
        id: 'external-unusual',
        position: { x: 530, y: 0 },
        data: {
          label: (
            <>
              <span className="node-kicker">
                {isolatedSet.has('dev-camera-01') || isolatedSet.has(selected) ? 'ROUTE BLOCKED' : 'UNUSUAL DESTINATION'}
              </span>
              <strong>203.0.113.42:8443</strong>
              <span>Unrecognized destination</span>
            </>
          ),
        },
        className: `topology-node external-node ${isolatedSet.has(selected) ? 'isolated-node' : 'flagged-node'}`,
        selectable: false,
        focusable: false,
        targetPosition: Position.Bottom,
      },
      // 3. Home Gateway Router Node (Center Middle)
      {
        id: router.id,
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
        position: { x: 280, y: 145 },
        data: {
          label: (
            <>
              <Router className="topology-device-icon" size={22} strokeWidth={1.2} />
              <span className="node-kicker">HOME GATEWAY</span>
              <strong>{router.name}</strong>
              <span>{router.address} · secure baseline</span>
              {selected === router.id && !reduced && !paused && (
                <motion.i
                  key={selectedScanKey}
                  className="network-node-scan"
                  aria-hidden="true"
                  initial={{ scale: 1, opacity: 0.85 }}
                  animate={{ scale: 1.55, opacity: 0 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
              )}
            </>
          ),
        },
        selected: selected === router.id,
        className: 'topology-node',
      },
      // 4. Connected Devices (Bottom grid rows)
      ...otherDevices.map((d: MapDevice, index: number) => {
        const Icon = deviceIcons[d.kind] || Network;
        const col = index % cols;
        const row = Math.floor(index / cols);
        const xPos = col * 240;
        const yPos = 310 + row * 140;
        const isIsolated = isolatedSet.has(d.id);
        const isReachable = blastRadius.includes(d.id);

        return {
          id: d.id,
          sourcePosition: Position.Top,
          targetPosition: Position.Bottom,
          position: { x: xPos, y: yPos },
          data: {
            label: (
              <>
                <Icon className="topology-device-icon" size={22} strokeWidth={1.2} />
                <span className="node-kicker">
                  {isIsolated ? 'ISOLATED' : d.address}
                </span>
                <strong>{d.name}</strong>
                <span>
                  {isIsolated ? 'Network access blocked' : isReachable ? 'Reachable in blast radius' : d.observed}
                </span>
                {selected === d.id && !reduced && !paused && (
                  <motion.i
                    key={selectedScanKey}
                    className="network-node-scan"
                    aria-hidden="true"
                    initial={{ scale: 1, opacity: 0.85 }}
                    animate={{ scale: 1.55, opacity: 0 }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                  />
                )}
              </>
            ),
          },
          selected: selected === d.id,
          className: `topology-node ${isIsolated ? 'isolated-node' : isReachable ? 'flagged-node' : ''}`,
        };
      }),
    ];
  }, [devices, router, selected, isolatedSet, blastRadius, selectedScanKey, reduced, paused]);

  // Build edges with LivingEdge animated packet dots
  const edges = useMemo<LivingNetworkEdge[]>(() => {
    const otherDevices = devices.filter((d: MapDevice) => d.id !== router.id);
    const cameraOrPlug = devices.find((d: MapDevice) => d.kind === 'camera' || d.kind === 'plug') || otherDevices[0];
    const isSuspicious = cameraOrPlug ? !isolatedSet.has(cameraOrPlug.id) : true;

    return [
      // Uplink to expected external vendor relay
      {
        id: 'uplink',
        source: router.id,
        target: 'external-trusted',
        animated: !reduced,
        label: 'Expected vendor routes',
        style: { stroke: '#89a79b' },
        className: 'topology-link',
      },
      // Egress to unusual external destination
      {
        id: 'egress-unusual',
        source: router.id,
        target: 'external-unusual',
        animated: !reduced && isSuspicious,
        label: isSuspicious ? '18.64 MB / 5 min · TLS' : 'Blocked at source · 0 KB/s',
        style: {
          stroke: isSuspicious ? '#e6947d' : '#5d635c',
          strokeDasharray: isSuspicious ? undefined : '4 6',
        },
        className: 'topology-link',
      },
      // Links between devices and the home router
      ...otherDevices.map((d: MapDevice) => {
        const isIsolated = isolatedSet.has(d.id);
        const suspicious = d.kind === 'camera' || d.kind === 'plug' || blastRadius.includes(d.id);
        const labelText = isIsolated
          ? 'ISOLATED · 0 KB/s'
          : d.kind === 'camera'
          ? '18.64 MB / 5 min · unusual'
          : d.kind === 'lock'
          ? '28 KB / 5 min'
          : d.kind === 'hub'
          ? '64 KB / 5 min'
          : '14 KB / 5 min';

        return {
          id: `edge-${d.id}`,
          source: d.id,
          target: router.id,
          animated: !reduced && !isIsolated,
          label: labelText,
          style: {
            stroke: isIsolated ? '#5d635c' : suspicious ? '#e6947d' : '#88a799',
            strokeDasharray: isIsolated ? '4 6' : undefined,
            strokeWidth: selected === d.id ? 2.2 : 1.3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isIsolated ? '#5d635c' : '#adbaa7',
          },
          className: `topology-link ${isIsolated ? 'blocked-link' : ''}`,
        };
      }),
    ].map(edge => {
      const isBlocked = edge.id === 'egress-unusual' ? !isSuspicious : edge.label?.includes('ISOLATED') || false;
      const suspicious = edge.id === 'egress-unusual' || edge.label?.includes('unusual') || false;
      const routeFocused = focused === router.id || edge.id.includes(focused);

      return {
        ...edge,
        type: 'living',
        animated: false,
        data: {
          blocked: isBlocked,
          suspicious,
          focused: routeFocused,
          paused,
          scanKey: `${focused}-${selectedScanKey}-${hovered ? 'hover' : 'selected'}`,
          bidirectional: edge.id.startsWith('edge-'),
        },
      };
    });
  }, [devices, router, isolatedSet, reduced, focused, hovered, paused, selected, selectedScanKey, blastRadius]);

  const activeDevice = devices.find((d: MapDevice) => d.id === selected) || devices[0];

  return (
    <div className="network-layout" style={{ height: '100%', minHeight: '620px' }}>
      <div className="topology-shell">
        <div className="topology-caption">
          <Network size={14} />
          <span>{devices.length - isolatedSet.size} connected · {isolatedSet.size} isolated</span>
          <button
            className="packet-toggle"
            disabled={!!reduced}
            aria-pressed={!paused && !reduced}
            onClick={() => setPaused(!paused)}
          >
            {reduced ? 'Motion reduced' : paused ? 'Resume packets' : 'Pause packets'}
          </button>
        </div>

        <div className="topology-canvas" role="group" aria-label="Home network topology" style={{ height: '540px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            edgeTypes={EDGE_TYPES}
            onNodeClick={handleNodeClick}
            onNodeMouseEnter={handleNodeEnter}
            onNodeMouseLeave={handleNodeLeave}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            multiSelectionKeyCode={null}
            selectionKeyCode={null}
            deleteKeyCode={null}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={0.3}
            maxZoom={1.5}
            colorMode="dark"
            proOptions={PRO_OPTIONS}
          >
            <Background color="#4b5d4b" gap={28} size={0.7} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="topology-legend">
          <span><i /> Cyan / expected route</span>
          <span><i className="warning-dot" /> Amber / unusual traffic</span>
          <span><i className="blocked-dot" /> Isolated boundary</span>
        </div>
      </div>

      <aside className="network-inspector">
        <label htmlFor="network-device-select">INSPECT DEVICE</label>
        <select
          id="network-device-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          {devices.map((d: MapDevice) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <div className="inspector-state">
          {isolatedSet.has(selected) ? <Unplug size={16} /> : <Network size={16} />}
          <span>{isolatedSet.has(selected) ? 'Isolated in this simulation' : 'Connected to home gateway'}</span>
        </div>

        <p className="inspector-address">{activeDevice?.address}</p>

        <div className="traffic-detail">
          <span className={`severity ${activeDevice?.risk === 'secure' ? 'baseline' : 'high'}`}>
            {activeDevice?.risk === 'secure' ? 'EXPECTED DESTINATIONS' : 'UNUSUAL TRAFFIC FLAGGED'}
          </span>
          <h3>{activeDevice?.name}<ArrowUpRight size={14} /></h3>
          <p>{activeDevice?.observed}</p>

          <div className="traffic-volume">
            <span>CAPTURED OUTBOUND / 5 MIN</span>
            <strong>{activeDevice?.kind === 'camera' ? '18.64 MB' : '64 KB'}</strong>
            <div className="traffic-volume-track" aria-hidden="true">
              <span style={{ width: activeDevice?.kind === 'camera' ? '92%' : '14%' }} />
            </div>
            <small>Share of largest captured device transfer</small>
          </div>

          <dl>
            <div>
              <dt>Protocol</dt>
              <dd>{activeDevice?.kind === 'camera' ? 'TLS / 8443' : 'HTTPS / 443'}</dd>
            </div>
            <div>
              <dt>Zone</dt>
              <dd>{activeDevice?.zone || 'main'}</dd>
            </div>
            <div>
              <dt>Blast radius</dt>
              <dd>
                {analysisLoading
                  ? 'Analyzing…'
                  : analysisError
                  ? 'Unavailable'
                  : `${blastRadius.length} reachable nodes`}
              </dd>
            </div>
            <div>
              <dt>Simulation status</dt>
              <dd>{isolatedSet.has(selected) ? 'Blocked · 0 KB/s' : 'Route permitted'}</dd>
            </div>
          </dl>

          {blastRadius.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1px', color: 'var(--muted)' }}>
                REACHABLE PEERS:
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {blastRadius.map((id: string) => (
                  <li key={id} style={{ fontSize: '10px', background: 'rgba(230, 148, 125, 0.15)', color: '#ef9987', padding: '3px 7px', borderRadius: '2px' }}>
                    {devices.find((d: MapDevice) => d.id === id)?.name || id}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="workspace-note">
          Simulated network visualization. Nodes show live blast radius and traffic flows matching the Phantom theme.
        </p>
      </aside>
    </div>
  );
}
