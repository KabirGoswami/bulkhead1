import { useCallback, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, MarkerType, Position, type Node, type NodeChange, type FitViewOptions } from '@xyflow/react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Network, Unplug, Camera, LockKeyhole, Shield, Router } from 'lucide-react'
import { devices } from '../../data/devices'
import { snapshot, timeLabel, volumeLabel, type DeviceId, type IncidentEvent } from '../../data/security'
import { LivingEdge, type LivingNetworkEdge } from './LivingEdge'
import '@xyflow/react/dist/style.css'
const EDGE_TYPES = { living: LivingEdge }
const FIT_VIEW_OPTIONS: FitViewOptions = { padding: .2 }
const DEVICE_ICONS = { camera: Camera, lock: LockKeyhole, alarm: Shield, router: Router }
const PRO_OPTIONS = { hideAttribution: true }

interface Props { selected: DeviceId; onSelect: (id: DeviceId) => void; isolated: Set<DeviceId>; event: IncidentEvent | null }
export function NetworkMonitor({ selected, onSelect, isolated, event }: Props) {
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [scanRequest, setScanRequest] = useState({ deviceId: selected, count: 0 })
  const selectedScanKey = `${selected}-${scanRequest.deviceId === selected ? scanRequest.count : 0}`
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (!devices.some(device => device.id === node.id)) return
    // This callback only restarts the finite scan. Selection has a single writer
    // in handleNodesChange, including pointer, touch, and keyboard selection.
    setScanRequest(previous => ({ deviceId: node.id as DeviceId, count: previous.count + 1 }))
  }, [])
  const focused = hovered ?? selected
  const handleNodeEnter = useCallback((_: React.MouseEvent, node: Node) => setHovered(node.id), [])
  const handleNodeLeave = useCallback(() => setHovered(null), [])
  // Workspace selection is authoritative. Do not mirror React Flow's selection
  // listener back into it: that effect can still contain the previous selection
  // while StoreUpdater applies a dropdown-driven nodes update.
  // Node changes represent explicit pointer/keyboard selection, not store snapshots.
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const change = changes.find(change => change.type === 'select' && change.selected)
    if (!change || change.type !== 'select' || change.id === selected) return
    const device = devices.find(device => device.id === change.id)
    if (device) onSelect(device.id)
  }, [selected, onSelect])
  const nodes = useMemo<Node[]>(() => [
    { id: 'external-trusted', position: { x: 0, y: 0 }, data: { label: <><span className="node-kicker">BASELINE DESTINATIONS</span><strong>Expected vendor relays</strong><span>192.0.2.0/24 · simulated</span></> }, className: 'topology-node external-node', selectable: false, focusable: false, targetPosition: Position.Bottom },
    ...snapshot.flows.filter(flow => flow.suspicious).map(flow => ({ id: `external-${flow.id}`, position: { x: 490, y: 0 }, data: { label: <><span className="node-kicker">{isolated.has(flow.deviceId) ? 'ROUTE BLOCKED' : 'UNUSUAL DESTINATION'}</span><strong>{flow.destination}:{flow.port}</strong><span>{flow.destinationName}</span></> }, className: `topology-node external-node ${isolated.has(flow.deviceId) ? 'isolated-node' : 'flagged-node'}`, selectable: false, focusable: false, targetPosition: Position.Bottom })),
    ...devices.map((d, index) => { const Icon = DEVICE_ICONS[d.kind]; return ({ id: d.id, sourcePosition: Position.Top, targetPosition: Position.Bottom, position: d.kind === 'router' ? { x: 245, y: 145 } : { x: index * 245, y: 320 }, data: { label: <><Icon className="topology-device-icon" size={22} strokeWidth={1.2}/><span className="node-kicker">{isolated.has(d.id) ? 'ISOLATED' : d.kind === 'router' ? 'HOME GATEWAY' : d.address}</span><strong>{d.name}</strong><span>{isolated.has(d.id) ? 'Network access blocked' : event?.deviceId === d.id ? `Event · ${timeLabel(event.timestamp)}` : d.observed}</span>{selected === d.id && !reduced && !paused && <motion.i key={selectedScanKey} className="network-node-scan" aria-hidden="true" initial={{ scale: 1, opacity: .85 }} animate={{ scale: 1.55, opacity: 0 }} transition={{ duration: 1.4, ease: 'easeOut' }}/>}</> }, selected: selected === d.id, className: `topology-node ${isolated.has(d.id) ? 'isolated-node' : d.risk === 'secure' ? '' : 'flagged-node'}` }) }),
  ], [selected, isolated, event, selectedScanKey, reduced, paused])
  const edges = useMemo<LivingNetworkEdge[]>(() => [
    { id: 'uplink', source: 'net-01', target: 'external-trusted', animated: !reduced, label: 'Expected vendor routes', style: { stroke: '#89a79b' }, className: 'topology-link' },
    ...snapshot.flows.filter(flow => flow.suspicious).map(flow => ({ id: `egress-${flow.id}`, source: 'net-01', target: `external-${flow.id}`, animated: !reduced && !isolated.has(flow.deviceId), label: isolated.has(flow.deviceId) ? 'Blocked at source · 0 KB/s' : `${volumeLabel(flow.outboundKB)} / ${flow.windowSeconds / 60} min · ${flow.protocol}`, style: { stroke: isolated.has(flow.deviceId) ? '#5d635c' : '#e6947d', strokeDasharray: isolated.has(flow.deviceId) ? '4 6' : undefined }, className: 'topology-link' })),
    ...devices.filter(d => d.kind !== 'router').map(d => ({ id: `edge-${d.id}`, source: d.id, target: 'net-01', animated: !reduced && !isolated.has(d.id), label: isolated.has(d.id) ? 'ISOLATED · 0 KB/s' : snapshot.flows.filter(flow => flow.deviceId === d.id).map(flow => `${volumeLabel(flow.outboundKB)} / ${flow.windowSeconds / 60} min${flow.suspicious ? ' · unusual' : ''}`).join(' · '), style: { stroke: isolated.has(d.id) ? '#5d635c' : snapshot.flows.some(flow => flow.deviceId === d.id && flow.suspicious) ? '#e6947d' : '#88a799', strokeDasharray: isolated.has(d.id) ? '4 6' : undefined, strokeWidth: event?.deviceId === d.id ? 2.5 : 1.3 }, markerEnd: { type: MarkerType.ArrowClosed, color: isolated.has(d.id) ? '#5d635c' : '#adbaa7' }, className: `topology-link ${isolated.has(d.id) ? 'blocked-link' : ''}` })),
  ].map(edge => {
    const flow = snapshot.flows.find(flow => edge.id === `egress-${flow.id}` || edge.id === `edge-${flow.deviceId}`)
    const blocked = flow ? isolated.has(flow.deviceId) : false
    const routeFocused = edge.id === 'uplink'
      ? snapshot.flows.some(flow => flow.deviceId === focused && !flow.suspicious)
      : flow?.deviceId === focused
    return { ...edge, type: 'living', animated: false, data: { blocked, suspicious: flow?.suspicious ?? false, focused: routeFocused, paused, scanKey: `${focused}-${selectedScanKey}-${hovered ? 'hover' : 'selected'}`, bidirectional: edge.id.startsWith('edge-') } }
  }), [isolated, reduced, event, focused, hovered, paused, selectedScanKey])
  const device = devices.find(d => d.id === selected)!
  const flows = snapshot.flows.filter(f => f.deviceId === selected)
  return <section className="workspace-section" id="network-monitor" aria-labelledby="network-heading">
    <div className="workspace-heading"><div><span className="eyebrow">02 / NETWORK MONITOR</span><h2 id="network-heading">Follow the signal.</h2><p>Animated simulation of captured traffic. Select a device to scan its routes and inspect its destinations.</p></div><span className="capture-label">SNAPSHOT · {timeLabel(snapshot.capturedAt)} IST</span></div>
    <div className="network-layout"><div className="topology-shell"><div className="topology-caption"><Network size={14}/><span>{devices.length - isolated.size} connected · {isolated.size} isolated</span><button className="packet-toggle" disabled={!!reduced} aria-pressed={!paused && !reduced} onClick={() => setPaused(!paused)}>{reduced ? 'Motion reduced' : paused ? 'Resume packets' : 'Pause packets'}</button></div><div className="topology-canvas" role="group" aria-label="Home network topology"><ReactFlow nodes={nodes} edges={edges} onNodesChange={handleNodesChange} edgeTypes={EDGE_TYPES} onNodeClick={handleNodeClick} onNodeMouseEnter={handleNodeEnter} onNodeMouseLeave={handleNodeLeave} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} multiSelectionKeyCode={null} selectionKeyCode={null} deleteKeyCode={null} fitView fitViewOptions={FIT_VIEW_OPTIONS} minZoom={.3} maxZoom={1.5} colorMode="dark" proOptions={PRO_OPTIONS}><Background color="#4b5d4b" gap={28} size={.7}/><Controls showInteractive={false}/></ReactFlow></div><div className="topology-legend"><span><i/> Cyan / expected</span><span><i className="warning-dot"/> Amber / unusual</span><span><i className="blocked-dot"/> Isolated</span></div></div>
    <aside className="network-inspector"><label htmlFor="network-device">INSPECT DEVICE</label><select id="network-device" value={selected} onChange={e => onSelect(e.target.value as DeviceId)}>{devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><div className="inspector-state">{isolated.has(selected) ? <Unplug size={16}/> : <Network size={16}/>}<span>{isolated.has(selected) ? 'Isolated in this simulation' : 'Connected to home gateway'}</span></div><p className="inspector-address">{device.address}</p>{flows.map(flow => <div className="traffic-detail" key={flow.id}><span className={`severity ${flow.suspicious ? 'high' : 'baseline'}`}>{flow.suspicious ? 'UNUSUAL DESTINATION' : 'EXPECTED DESTINATION'}</span><h3>{flow.destination}:{flow.port}<ArrowUpRight size={14}/></h3><p>{flow.destinationName}</p><div className="traffic-volume"><span>CAPTURED OUTBOUND / {flow.windowSeconds / 60} MIN</span><strong>{volumeLabel(flow.outboundKB)}</strong><div className="traffic-volume-track" aria-hidden="true"><span style={{ width: `${Math.max(2, flow.outboundKB / Math.max(...snapshot.flows.map(f => f.outboundKB)) * 100)}%` }}/></div><small>Share of the largest captured device transfer</small></div><dl><div><dt>Protocol</dt><dd>{flow.protocol}</dd></div><div><dt>Captured outbound</dt><dd>{volumeLabel(flow.outboundKB)} / {flow.windowSeconds / 60} min</dd></div><div><dt>Simulation now</dt><dd>{isolated.has(selected) ? 'Blocked · 0 KB/s' : 'Route permitted'}</dd></div></dl><p className="evidence-copy">{flow.reason}</p></div>)}<p className="workspace-note">Documentation IP ranges represent simulated external destinations. Captured volumes are historical and remain visible after isolation.</p></aside></div>
  </section>
}
