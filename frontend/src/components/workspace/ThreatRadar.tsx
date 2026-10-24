import { useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { RotateCcw, Pause, Play, ArrowUpRight } from 'lucide-react'
import { snapshot, deviceName, timeLabel, type Severity, type DeviceId } from '../../data/security'
import { findingCorrelations, radarPosition, RADAR_CYCLE_SECONDS } from '../../data/radar'
interface Props { severity: Severity | 'all'; selected: string | null; onSelect: (id: string) => void; onInspect: (id: DeviceId) => void; onEvent: (id: string) => void }
const markers = snapshot.findings.map((finding, index) => ({ finding, index, ...radarPosition(finding, index) }))
export function ThreatRadar({ severity, selected, onSelect, onInspect, onEvent }: Props) {
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const [cycle, setCycle] = useState(0)
  const findings = markers.filter(marker => severity === 'all' || marker.finding.severity === severity)
  const active = findings.find(marker => marker.finding.id === selected)
  const finding = active?.finding
  const correlation = findingCorrelations.find(relation => selected && relation.findingIds.includes(selected))
  const related = active && correlation ? findings.filter(marker => marker.finding.id !== selected && correlation.findingIds.includes(marker.finding.id)) : []
  const clockStyle = { '--active-radar-cycle': `${RADAR_CYCLE_SECONDS}s`, '--active-radar-play': paused ? 'paused' : 'running' } as CSSProperties
  function scanAgain() { setPaused(false); setCycle(previous => previous + 1) }
  return <div className="radar-layout active-radar-layout">
    <div className="radar-display">
      <div className="radar-display-caption"><span>ACTIVE THREAT RADAR</span><span>SIMULATED / {findings.length} FINDINGS</span></div>
      <div key={cycle} className="threat-radar active-threat-radar" style={clockStyle} role="group" aria-label="Simulated threat radar. Select a marker to investigate its evidence.">
        <svg viewBox="0 0 400 400" fill="none" aria-hidden="true">
          <circle cx="200" cy="200" r="166" stroke="#a3d7d440"/><circle cx="200" cy="200" r="112" stroke="#a3d7d42d"/><circle cx="200" cy="200" r="58" stroke="#a3d7d425"/>
          <path d="M200 20v360M20 200h360" stroke="#a3d7d42b"/><path d="m82 82 236 236m0-236L82 318" stroke="#a3d7d41c"/>
          <path d="M34 194v12m332-12v12M194 34h12m-12 332h12" stroke="#a3d7d4" strokeWidth="1.5"/>
          <g className="active-radar-beam"><path d="M200 200 122.1 53.4A166 166 0 0 1 200 34Z" fill="#a3d7d4" fillOpacity=".09"/><path d="M200 200V34" stroke="#b2dfcf" strokeWidth="1.8"/><circle cx="200" cy="34" r="3" fill="#c5e7d9"/></g>
          {active && related.map(marker => <motion.path key={`${selected}-${marker.finding.id}-${cycle}`} d={`M${active.x} ${active.y}L${marker.x} ${marker.y}`} stroke="#b6aa84" strokeWidth="1.3" strokeDasharray="4 5" initial={reduced ? false : { pathLength: 0, opacity: 0 }} animate={reduced ? { pathLength: 1, opacity: .3 } : { pathLength: [0,1,1], opacity: [0,.7,0] }} transition={{ duration: reduced ? 0 : 3.2, times: [0,.35,1] }}/>) }
          <circle cx="200" cy="200" r="3" fill="#a3d7d4"/>
          <text x="200" y="18" textAnchor="middle" className="radar-bearing">N / 000°</text><text x="382" y="204" textAnchor="middle" className="radar-bearing">090°</text>
        </svg>
        {findings.map(marker => <button key={marker.finding.id} className={`radar-marker ${marker.finding.severity} ${selected === marker.finding.id ? 'radar-selected' : ''}`} style={{ left: `${marker.x / 4}%`, top: `${marker.y / 4}%` }} aria-pressed={selected === marker.finding.id} aria-controls="radar-investigation" aria-label={`${marker.finding.title}, ${marker.finding.severity} severity, ${marker.finding.confidence}% finding confidence. Open evidence.`} onClick={() => onSelect(marker.finding.id)}>
          <span>{String(marker.index + 1).padStart(2,'0')}</span>
          <span className="radar-beam-contact" style={{ animationDelay: `${marker.pulseDelay}s` }} aria-hidden="true"/>
          <span className="radar-contact-core" style={{ animationDelay: `${marker.pulseDelay}s` }} aria-hidden="true"/>
          {selected === marker.finding.id && <motion.i key={selected} initial={reduced ? false : { scale: .8, opacity: .8 }} animate={{ scale: 1.2, opacity: .45 }} transition={{ duration: reduced ? 0 : .7 }} aria-hidden="true"/>}
        </button>)}
        <span className="radar-axis">INNER = HIGHER FINDING CONFIDENCE</span>
      </div>
      <div className="radar-controls"><button className="secondary-button" onClick={scanAgain}><RotateCcw size={14}/>Scan Again</button><button className="secondary-button" disabled={!!reduced} aria-pressed={!paused && !reduced} onClick={() => setPaused(!paused)}>{paused ? <Play size={14}/> : <Pause size={14}/>} {reduced ? 'Motion reduced' : paused ? 'Resume sweep' : 'Pause sweep'}</button></div>
      <p className="radar-scan-status" role="status">{cycle > 0 ? `Scan cycle ${cycle + 1} restarted. ` : ''}{reduced ? 'Static radar · reduced motion. ' : paused ? 'Sweep paused. ' : 'Review sweep active. '}{findings.length} existing simulated findings. No new findings generated.</p>
      <div className="radar-severity-key"><span className="critical">Red / critical</span><span className="high">Amber / high</span><span className="medium">Cyan / medium</span></div>
    </div>
    <div id="radar-investigation" className="radar-legend radar-investigation" aria-live="polite" aria-atomic="true">
      <span className="eyebrow">INVESTIGATION / SIMULATED EVIDENCE</span>
      {finding ? <><h3>{finding.title}</h3><div className="radar-investigation-meta"><span className={`severity ${finding.severity}`}>{finding.severity}</span><span>{deviceName(finding.deviceId)}</span><time dateTime={finding.timestamp}>{timeLabel(finding.timestamp)} IST</time></div><div className="radar-confidence"><strong>{finding.confidence}%</strong><span>Finding confidence<br/><small>Not attack certainty</small></span></div><p>{finding.assessment}</p><h4>Supporting evidence</h4><ul>{finding.evidence.map(evidence => <li key={evidence}>{evidence}</li>)}</ul><p className="radar-uncertainty">{finding.uncertainty}</p>{correlation && related.length > 0 && <div className="radar-correlation-note"><span>TIME-WINDOW ASSOCIATION</span><p>{correlation.description} {correlation.uncertainty}</p><small>Source: captured incident at {timeLabel(snapshot.events.find(event => event.id === correlation.supportingEventIds[0])!.timestamp)} IST</small></div>}<div className="finding-actions"><button className="text-button" onClick={() => onInspect(finding.deviceId)}>Inspect network<ArrowUpRight size={13}/></button><button className="text-button" onClick={() => onEvent(finding.eventIds[0])}>View related events<ArrowUpRight size={13}/></button></div></> : <><h3>Select a signal.</h3><p>Choose a radar marker or an existing finding below to inspect the captured evidence.</p></>}
      <ol className="radar-finding-shortcuts">{findings.map(marker => <li key={marker.finding.id}><button onClick={() => onSelect(marker.finding.id)} aria-pressed={selected === marker.finding.id}><span className={`severity ${marker.finding.severity}`}>{String(marker.index + 1).padStart(2,'0')}</span><span>{deviceName(marker.finding.deviceId)}</span></button></li>)}</ol>
    </div>
  </div>
}
