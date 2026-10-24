import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps, type Edge } from '@xyflow/react'
import { motion, useReducedMotion } from 'motion/react'
export interface LivingEdgeData extends Record<string, unknown> { blocked: boolean; suspicious: boolean; focused: boolean; paused: boolean; scanKey: string; bidirectional: boolean }
export type LivingNetworkEdge = Edge<LivingEdgeData>
export const LivingEdge = memo(function LivingEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, label, data }: EdgeProps<LivingNetworkEdge>) {
  const reduced = useReducedMotion()
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14 })
  const blocked = data?.blocked ?? false
  const suspicious = data?.suspicious ?? false
  const color = blocked ? '#758071' : suspicious ? '#eba279' : '#a3d7cf'
  const animate = !reduced && !blocked && !data?.paused
  const packetCount = suspicious ? 7 : 2
  const duration = suspicious ? 2.4 : 4.2
  return <>
    <BaseEdge id={id} path={path} markerEnd={blocked ? undefined : markerEnd} style={{ stroke: color, strokeWidth: data?.focused ? 2 : 1.3, strokeOpacity: blocked ? 0 : data?.focused ? .95 : .55 }}/>
    {blocked && <g pointerEvents="none" aria-hidden="true"><path d={path} pathLength="1" fill="none" stroke={color} strokeWidth="1.3" strokeDasharray=".44 .12"/><path d={`M${labelX-4} ${labelY-4}l8 8m-8 0 8-8`} fill="none" stroke="#d2a17d" strokeWidth="1.5"/></g>}
    {animate && Array.from({length:packetCount},(_,packet) => {
      const reverse = !!data?.bidirectional && !suspicious && packet % 2 === 1
      return <g key={packet} pointerEvents="none" aria-hidden="true"><circle r={suspicious ? 7 : 6} fill={color} opacity=".13"/><circle r={suspicious ? 3.6 : 3} fill={color}/><circle r="1.1" fill="#f0f2da" opacity=".85"/><animateMotion dur={`${duration}s`} begin={`${-packet*duration/packetCount}s`} repeatCount="indefinite" path={path} keyPoints={reverse?'1;0':'0;1'} keyTimes="0;1" calcMode="linear"/></g>
    })}
    {animate && data?.focused && <motion.path key={data.scanKey} d={path} fill="none" stroke="#d9efe5" strokeWidth="4" pathLength="1" strokeDasharray=".13 .87" initial={{ strokeDashoffset: 1, opacity: .95 }} animate={{ strokeDashoffset: 0, opacity: 0 }} transition={{ duration: 1.4, ease: 'easeOut' }} pointerEvents="none"/>}
    {label && <EdgeLabelRenderer><span className={`living-edge-label ${data?.focused ? 'route-focused' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY+(blocked?18:0)}px)` }}>{suspicious && !blocked && <i className="traffic-alert-indicator" aria-label="Unusual simulated traffic">!</i>}{label}{suspicious && !blocked && <small className="traffic-simulation-tag">SIMULATED</small>}</span></EdgeLabelRenderer>}
  </>
})
