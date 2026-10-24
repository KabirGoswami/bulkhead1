import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Pause, Play, SkipBack, SkipForward, RotateCcw, ArrowUpRight } from 'lucide-react'
import { ReplayTrack } from './ReplayTrack'
import { devices } from '../../data/devices'
import { snapshot, timeLabel, deviceName, type IncidentEvent, type DeviceId } from '../../data/security'
interface Props { eventId: string; onSelect: (event: IncidentEvent) => void; onInspect: (id: DeviceId) => void }
export function IncidentTimeline({ eventId, onSelect, onInspect }: Props) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const reduced = useReducedMotion()
  const index = Math.max(0, snapshot.events.findIndex(e => e.id === eventId))
  const event = snapshot.events[index]
  useEffect(() => {
    if (!playing) return
    if (index === snapshot.events.length - 1) return
    const timer = window.setTimeout(() => {
      onSelect(snapshot.events[index + 1])
      if (index + 1 === snapshot.events.length - 1) setPlaying(false)
    }, 2400 / speed)
    return () => window.clearTimeout(timer)
  }, [playing, index, speed, onSelect])
  function select(next: number) { setPlaying(false); onSelect(snapshot.events[next]) }
  return <section className="workspace-section" id="incident-timeline" aria-labelledby="timeline-heading"><div className="workspace-heading"><div><span className="eyebrow">04 / INCIDENT TIMELINE</span><h2 id="timeline-heading">Reconstruct the sequence.</h2><p>A captured five-minute sequence. Playback highlights the related device in the network monitor.</p></div><span className="capture-label">24 OCT 2026 / IST</span></div>
    <div className="replay-visual" aria-label="Device states at the selected event"><div className="replay-clock"><span>REPLAY POSITION / IST</span><strong>{timeLabel(event.timestamp)}</strong><small>{playing ? 'RECONSTRUCTING SEQUENCE' : 'CAPTURED EVENT'}</small></div><div className="replay-device-strip">{devices.filter(d => d.kind !== 'router').map(d => { const reached = snapshot.events.slice(0, index + 1).filter(e => e.deviceId === d.id); const latest = reached[reached.length - 1]; const affected = latest && latest.category !== 'baseline' && latest.category !== 'access'; return <div key={d.id} className={`replay-device ${event.deviceId === d.id ? 'replay-device-active' : ''}`}><span>{d.name}</span><motion.i aria-hidden="true" initial={false} animate={{ backgroundColor: affected ? '#d99078' : '#8ca78c', scaleY: event.deviceId === d.id ? 1 : .65 }} transition={{ duration: reduced ? 0 : .35 }}/><strong>{affected ? 'Discrepancy observed' : 'No discrepancy yet'}</strong><small>{latest ? timeLabel(latest.timestamp) : 'Awaiting first event'}</small></div> })}</div></div>
    <div className="timeline-player"><div className="playback-controls"><button aria-label="Restart timeline" onClick={() => select(0)}><RotateCcw size={16}/></button><button aria-label="Previous event" disabled={index === 0} onClick={() => select(index - 1)}><SkipBack size={16}/></button><button className="play-button" aria-label={playing ? 'Pause timeline' : 'Play timeline'} onClick={() => { if (!playing && index === snapshot.events.length - 1) onSelect(snapshot.events[0]); setPlaying(!playing) }}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button><button aria-label="Next event" disabled={index === snapshot.events.length - 1} onClick={() => select(index + 1)}><SkipForward size={16}/></button><label className="speed-label">Speed<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label><span className="playback-count">{String(index + 1).padStart(2, '0')} / {String(snapshot.events.length).padStart(2, '0')}<span>{playing ? 'PLAYING' : 'PAUSED'}</span></span></div>
    <ReplayTrack index={index} onSelect={select}/>
    <div className="replay-progress" aria-hidden="true"><motion.div initial={false} animate={{ scaleX: index / (snapshot.events.length - 1) }} transition={{ duration: reduced ? 0 : .4 }}/></div>
    <label className="sr-only" htmlFor="timeline-position">Select incident event</label><input id="timeline-position" className="timeline-scrubber" type="range" min={0} max={snapshot.events.length - 1} value={index} onChange={e => select(Number(e.target.value))} aria-valuetext={`${timeLabel(event.timestamp)} ${event.title}`}/>
    <div className="timeline-layout"><ol className="timeline-events">{snapshot.events.map((e, i) => <li key={e.id}><button aria-current={e.id === event.id ? 'step' : undefined} className={`${i <= index ? 'event-reached' : ''} ${e.id === event.id ? 'event-selected' : ''}`} onClick={() => select(i)}><time dateTime={e.timestamp}>{timeLabel(e.timestamp)}</time><span className="timeline-marker"/><span><strong>{e.title}</strong><small>{deviceName(e.deviceId)}</small></span></button></li>)}</ol><div className="event-inspector" aria-live={playing ? 'off' : 'polite'}><motion.div key={event.id} initial={reduced ? false : { opacity: .4 }} animate={{ opacity: 1 }} transition={{ duration: .2 }}><span className="eyebrow">{event.category.toUpperCase()} / {timeLabel(event.timestamp)} IST</span><h3>{event.title}</h3><span className="event-device">{deviceName(event.deviceId)}</span><div className="event-state-transition"><div><span>BEFORE</span><strong>{index === 0 ? 'Saved baseline' : [...snapshot.events.slice(0, index)].reverse().find(e => e.deviceId === event.deviceId)?.title ?? 'No earlier captured event'}</strong></div><ArrowUpRight size={20}/><div><span>AT THIS EVENT</span><strong>{event.title}</strong></div></div><p>{event.detail}</p><button className="text-button" onClick={() => onInspect(event.deviceId)}>Inspect this device <ArrowUpRight size={14}/></button>{event.findingId && <a className="text-button" href="#threat-intelligence">Review supporting findings <ArrowUpRight size={14}/></a>}<p className="workspace-note">Historical playback does not change current containment. Events in the same window are not proof of a coordinated attack.</p></motion.div></div></div></div>
  </section>
}
