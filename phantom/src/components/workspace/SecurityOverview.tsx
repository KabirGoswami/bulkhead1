import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, ShieldCheck, ScanLine } from 'lucide-react'
import { devices, type DeviceId } from '../../data/devices'
import { SecurityPulse } from './SecurityPulse'
import { snapshot } from '../../data/security'

export function SecurityOverview({ isolated, scanning, onInspect }: { isolated: Set<DeviceId>; scanning: boolean; onInspect: (id: DeviceId) => void }) {
  const reduced = useReducedMotion()
  const critical = snapshot.findings.filter(f => f.severity === 'critical').length
  const verified = devices.filter(d => d.risk === 'secure').length
  return <div className={`security-overview ${scanning ? 'scan-in-progress' : ''}`}>
    <div className="security-dial" role="img" aria-label={`${snapshot.findings.length} findings require review, ${verified} verified device, ${isolated.size} isolated devices. Simulated data.`}>
      <svg viewBox="0 0 320 320" fill="none" aria-hidden="true"><circle cx="160" cy="160" r="143" stroke="#29332f" strokeWidth="1" strokeDasharray="1 9"/><circle cx="160" cy="160" r="123" stroke="#27332c" strokeWidth="13"/>{devices.map((d, i) => <motion.circle key={d.id} cx="160" cy="160" r="123" stroke={isolated.has(d.id) ? '#93b5b2' : d.risk === 'critical' ? '#d78975' : d.risk === 'warning' ? '#c4a37c' : '#879c84'} strokeWidth="13" strokeDasharray="169 773" transform={`rotate(${i * 90 - 86} 160 160)`} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .8, delay: reduced ? 0 : i * .12 }}/>) }<path d="M160 6v10m0 288v10M6 160h10m288 0h10" stroke="#8c9c8b"/>{scanning && <motion.circle cx="160" cy="160" r="100" stroke="#a3d7d4" strokeWidth="1" strokeDasharray="55 574" animate={reduced ? {} : { rotate: 360 }} style={{ transformOrigin: '160px 160px' }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}/>}</svg>
      <div className="dial-content"><span>REQUIRES REVIEW</span><strong>{snapshot.findings.length.toString().padStart(2, '0')}</strong><small>open findings</small></div><span className="dial-annotation">RESIDENCE 01 / INTEGRITY MAP</span>
    </div>
    <div className="security-brief"><span className="eyebrow"><ScanLine size={14}/> SECURITY POSTURE / SIMULATED</span><h3>Green lights.<br/><em>Unresolved signals.</em></h3><p>Your home is connected. Its reported state doesn’t tell the whole story.</p><div className="security-metrics"><div><strong>{critical.toString().padStart(2,'0')}</strong><span>Critical discrepancy</span></div><div><strong>{verified.toString().padStart(2,'0')}</strong><span>Verified device</span></div><div><strong>{isolated.size.toString().padStart(2,'0')}</strong><span>Devices isolated</span></div></div>
    </div><div className="priority-brief"><span className="eyebrow">PRIORITY / PHYSICAL SECURITY</span><span className="priority-tag">CRITICAL DISCREPANCY</span><h4>Check the<br/>front door.</h4><p>The deadbolt reports locked.<br/>The contact sensor reports open.</p><a href="#threat-intelligence" className="text-button">Examine the evidence <ArrowUpRight size={16}/></a><div className="priority-footnote"><ShieldCheck size={14}/><span>Verify physically. Isolation cannot close a door.</span></div></div>
    <SecurityPulse isolated={isolated} scanning={scanning} onInspect={onInspect}/>
  </div>
}
