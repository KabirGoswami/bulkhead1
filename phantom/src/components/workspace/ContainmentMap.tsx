import { motion, useReducedMotion } from 'motion/react'
import { devices, type DeviceId } from '../../data/devices'
import { deviceName } from '../../data/security'
export type ContainmentPhase = 'identified' | 'severing' | 'complete' | 'restoring'
export interface ContainmentSequence { deviceId: DeviceId; action: 'isolate' | 'restore'; phase: ContainmentPhase; key: number }
interface Props { target: DeviceId; blocked: boolean; isolated: Set<DeviceId>; label: string; sequence?: ContainmentSequence | null; preview?: boolean }

export function ContainmentMap({ target, blocked, isolated, label, sequence = null, preview = false }: Props) {
 const reduced=useReducedMotion()
 return <svg viewBox="0 0 460 235" className="cinematic-containment-map" role="img" aria-label={`${label}: ${deviceName(target)} ${sequence ? sequence.phase : blocked ? 'isolated' : 'connected'}. Other device states are preserved.`}>
  <text x="230" y="22" textAnchor="middle" className="map-caption">{label}</text>
  <rect x="166" y="42" width="128" height="38" rx="2" fill="#1d2b23" stroke="#8baa98"/><text x="230" y="66" textAnchor="middle">Home gateway</text>
  {devices.filter(d=>d.kind!=='router').map((d,i)=>{
   const x=80+i*150
   const active=sequence?.deviceId===d.id
   const phase=active?sequence.phase:null
   const off=d.id===target?blocked:isolated.has(d.id)
   const warning=phase==='identified'||phase==='severing'
   const connected=phase==='identified'||phase==='restoring'||!off
   const path=`M230 80V102H${x}V150`
   const reverse=`M${x} 150V102H230V80`
   const color=warning?'#ef725d':off?'#8d7665':'#a3c5b2'
   const quarantined=phase==='complete'||(off&&!warning&&phase!=='restoring')
   return <g key={d.id}>
    <path d={path} fill="none" stroke="#36463b" strokeWidth="1" strokeDasharray="3 5"/>
    <motion.path d={path} fill="none" strokeWidth={warning?3:1.8} initial={false} animate={{stroke:color,opacity:phase==='severing'||phase==='restoring'||quarantined?0:1}} transition={{duration:reduced?0:phase==='restoring'?.85:.15}}/>
    {phase==='severing'&&<g key={`cut-${sequence?.key}`}><motion.path d={path} fill="none" stroke="#f18367" strokeWidth="3" initial={{pathLength:.5}} animate={{pathLength:0}} transition={{duration:reduced?0:.9,ease:'easeInOut'}}/><motion.path d={reverse} fill="none" stroke="#f18367" strokeWidth="3" initial={{pathLength:.5}} animate={{pathLength:0}} transition={{duration:reduced?0:.9,ease:'easeInOut'}}/></g>}
    {phase==='restoring'&&<motion.path key={`join-${sequence?.key}`} d={path} fill="none" stroke="#bdded3" strokeWidth="3" initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:reduced?0:1,delay:reduced?0:.4,ease:'easeInOut'}}/>}
    {connected&&!reduced&&!preview&&phase!=='restoring'&&[0,1].map(packet=><circle key={packet} r="3" fill={warning?'#f3ac8b':'#acd6c9'}><animateMotion path={packet?reverse:path} dur="2.6s" begin={`${packet*-1.3}s`} repeatCount="indefinite"/></circle>)}
    {(phase==='severing'||quarantined)&&<g stroke="#ed9b79" strokeWidth="2"><path d={`M${x-5} 118l10 10m-10 0 10-10`}/><circle cx={x} cy="123" r="10" fill="none" strokeWidth="1"/></g>}
    <motion.rect x={x-72} y="140" width="144" height="54" rx="5" fill="none" stroke="#d7ac83" strokeWidth="2" initial={false} animate={{pathLength:quarantined?1:0,opacity:quarantined?1:0}} transition={{duration:reduced?0:.6,ease:'easeOut'}}/>
    {phase==='identified'&&<motion.ellipse key={`warning-${sequence?.key}`} cx={x} cy="167" rx="68" ry="27" fill="none" stroke="#f17e69" strokeWidth="2" initial={{scale:.6,opacity:1}} animate={{scale:1.3,opacity:0}} style={{transformOrigin:`${x}px 167px`}} transition={{duration:reduced?0:.5}}/>}
    <motion.rect x={x-62} y="150" width="124" height="34" rx="2" initial={false} animate={{fill:phase==='identified'?['#60271e','#bc4938','#60271e']:quarantined?'#3d2b20':'#1b281f',stroke:warning?'#ff9d86':quarantined?'#d7ac83':d.id===target?'#b5d4bf':'#526a55'}} transition={{duration:reduced?0:phase==='identified'?.5:.2}} strokeWidth={active?2:1}/>
    <text x={x} y="171" textAnchor="middle">{d.kind==='lock'?'Front door lock':d.kind==='camera'?'Camera':'Security hub'}</text>
    <text className={quarantined?'map-blocked':'map-connected'} x={x} y="211" textAnchor="middle">{phase==='identified'?'THREAT IDENTIFIED':phase==='severing'?'SEVERING ROUTE':phase==='restoring'?'RESTORING':quarantined?'DEVICE ISOLATED':'CONNECTED'}</text>
   </g>
  })}
 </svg>
}
