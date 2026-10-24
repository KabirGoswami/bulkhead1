import { useEffect, useRef, useState } from 'react'
import { Camera, LockKeyhole, Router, Shield, ArrowUpRight, Check, RefreshCw, X, Activity } from 'lucide-react'
import { SecurityOverview } from './workspace/SecurityOverview'
import { SecurityWorkspace } from './workspace/SecurityWorkspace'
import { devices, type DeviceId, type DeviceKind } from '../data/devices'
const icons = { lock: LockKeyhole, camera: Camera, alarm: Shield, router: Router } satisfies Record<DeviceKind, typeof Camera>
export function CommandCenter() {
  const [isolated, setIsolated] = useState<Set<DeviceId>>(new Set())
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanTime, setScanTime] = useState('14:32:08')
  const modal = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!selected) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
      if (event.key !== 'Tab') return
      const buttons = modal.current?.querySelectorAll<HTMLButtonElement>('button')
      if (!buttons?.length) return
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [selected])
  const device = devices.find(d => d.id === selected)
  function scan() { setScanning(true); window.setTimeout(() => { setScanning(false); setScanTime(new Date().toLocaleTimeString('en-GB')); }, 1200) }
  return <section id="command-center" className="command-section">
    <div className="section-kicker"><span>02 / COMMAND CENTER</span><span className="demo-label">INTERACTIVE PREVIEW</span></div>
    <div className="section-heading"><div><h2>Your home. The whole picture.</h2><p>Reported status is only half the story. See the evidence behind every device.</p></div><button className="secondary-button" onClick={scan} disabled={scanning}><RefreshCw size={14} className={scanning ? 'spinning' : ''}/>{scanning ? 'Scanning…' : 'Run integrity scan'}</button></div>
    <SecurityOverview isolated={isolated} scanning={scanning} onInspect={setSelected}/>
    <div className="overview-bar" aria-live="polite"><span><Activity size={15}/> {devices.length - isolated.size} devices connected{isolated.size > 0 ? ` · ${isolated.size} isolated` : ''}</span><span className="risk-text">3 discrepancies detected</span><span>Last scan {scanTime} · Local simulation</span></div>
    <nav className="workspace-nav" aria-label="Command Center sections"><a href="#device-overview">01 Device overview</a><a href="#network-monitor">02 Network monitor</a><a href="#threat-intelligence">03 Threat intelligence</a><a href="#incident-timeline">04 Incident timeline</a><a href="#phantom-mode">05 Phantom mode</a></nav>
    <div id="device-overview" className="device-tabs" role="group" aria-label="Filter devices">{[['all','All devices',4],['attention','Needs attention',3],['secure','Verified',1]].map(([value,label,count]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(String(value))}>{label}<span>{count}</span></button>)}</div>
    <div className="device-grid">{devices.filter(d => filter === 'all' || (filter === 'secure' ? d.risk === 'secure' : d.risk !== 'secure')).map(d => { const Icon = icons[d.kind]; return <button className={`device-card ${d.risk}`} key={d.id} onClick={() => setSelected(d.id)}><div className="device-top"><Icon size={23} strokeWidth={1.3}/><span className="device-risk"><i/>{isolated.has(d.id) ? 'ISOLATED' : d.risk === 'secure' ? 'VERIFIED' : d.risk.toUpperCase()}</span></div><h3>{d.name}</h3><p>{d.location} <span> / {d.address}</span></p><div className="device-status"><span>REPORTED<strong>{d.reported}</strong></span><span>OBSERVED<strong>{d.observed}</strong></span></div><div className="device-bottom">Inspect evidence<ArrowUpRight size={15}/></div></button> })}</div>
    <p className="simulation-note"><Check size={12}/> Demonstration data. No devices are connected and no network actions are performed.</p>
    <SecurityWorkspace isolated={isolated} onIsolatedChange={setIsolated}/>
    {device && <div className="modal-backdrop" onClick={() => setSelected(null)}><section ref={modal} role="dialog" aria-modal="true" aria-labelledby="evidence-title" className="evidence-modal" onClick={e => e.stopPropagation()} onKeyDown={e => { if(e.key === 'Escape') setSelected(null) }}><button autoFocus className="close-modal" onClick={() => setSelected(null)} aria-label="Close evidence"><X size={20}/></button><span className="eyebrow">DEVICE EVIDENCE / {device.id.toUpperCase()}</span><h2 id="evidence-title">{device.name}</h2><p className="evidence-status">{device.observed}</p><p>{device.evidence}</p><dl><div><dt>Local address</dt><dd>{device.address}</dd></div><div><dt>Last response</dt><dd>{device.lastSeen}</dd></div><div><dt>Source</dt><dd>Simulated telemetry</dd></div></dl><button className="primary-button" onClick={() => setSelected(null)}>Back to overview <ArrowUpRight size={16}/></button></section></div>}
  </section>
}
