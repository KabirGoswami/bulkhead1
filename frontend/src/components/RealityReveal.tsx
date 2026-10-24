import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { motion, useReducedMotion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
import { ScanLine, MoveUpRight } from 'lucide-react'
import { HomeScene } from './HomeScene'

export function RealityReveal() {
  const reduced = useReducedMotion()
  const region = useRef<HTMLDivElement>(null)
  const [reveal, setReveal] = useState(false)
  const [tracking, setTracking] = useState(false)
  const x = useMotionValue(0), y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 180, damping: 30 })
  const sy = useSpring(y, { stiffness: 180, damping: 30 })
  const cursorX = reduced ? x : sx, cursorY = reduced ? y : sy
  // The mask and its scanning edge share the same panel-local motion values.
  // Keep most of the 280px radius opaque so the evidence is legible.
  const mask = useMotionTemplate`radial-gradient(circle 280px at ${cursorX}px ${cursorY}px, #000 0%, #000 82%, transparent 100%)`
  const edge = useMotionTemplate`radial-gradient(circle 280px at ${cursorX}px ${cursorY}px, transparent 0%, transparent 90%, rgba(163, 215, 212, 0.12) 94%, rgba(163, 215, 212, 0.65) 96%, transparent 97%, transparent 100%)`

  useEffect(() => {
    const panel = region.current
    if (!panel) return
    const observer = new ResizeObserver(() => {
      x.jump(panel.clientWidth * .5)
      y.jump(panel.clientHeight * .5)
      sx.jump(x.get())
      sy.jump(y.get())
    })
    observer.observe(panel)
    return () => observer.disconnect()
  }, [x, y, sx, sy])

  function moveSpotlight(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return
    const panel = event.currentTarget
    const bounds = panel.getBoundingClientRect()
    const nextX = event.clientX - bounds.left - panel.clientLeft
    const nextY = event.clientY - bounds.top - panel.clientTop
    if (!tracking) {
      x.jump(nextX); y.jump(nextY)
      sx.jump(nextX); sy.jump(nextY)
      setTracking(true)
    } else {
      x.set(nextX); y.set(nextY)
    }
  }

  return <div className="reality" ref={region} onPointerEnter={moveSpotlight} onPointerMove={moveSpotlight} onPointerLeave={() => setTracking(false)} aria-label="Interactive smart home comparison. Use Reveal the truth to show all compromised devices.">
    <div className="scene-meta"><span><i className="status-dot"/> RESIDENCE 01 / DIGITAL TWIN</span><span>ISOMETRIC VIEW <MoveUpRight size={12}/></span></div>
    <div className="reported-layer"><HomeScene/></div>
    <motion.div id="compromised-scene" className={`reveal-layer ${reveal ? 'reveal-all' : ''}`} style={{ opacity: reveal || tracking ? 1 : 0, maskImage: reveal ? 'none' : mask, WebkitMaskImage: reveal ? 'none' : mask }} aria-hidden="true"><HomeScene revealed/>{tracking && !reveal && <motion.div className="spotlight-verdict" style={{ left: cursorX, top: cursorY }}>REALITY: COMPROMISED</motion.div>}</motion.div>
    <motion.div className="scanning-edge" style={{ backgroundImage: edge, opacity: tracking && !reveal ? 1 : 0 }} aria-hidden="true"/>
    <div className="reveal-instruction"><ScanLine size={17}/><span>Move to reveal what your devices don’t tell you</span></div>
    <button className={`reveal-toggle ${reveal ? 'active' : ''}`} aria-pressed={reveal} aria-controls="compromised-scene" onClick={() => setReveal(!reveal)}><span className="toggle-track"><i/></span>{reveal ? 'Truth revealed' : 'Reveal the truth'}</button>
    <span className="sr-only" role="status">{reveal ? 'Reality: compromised. Front door open, camera feed frozen, alarm disabled, suspicious outbound connection.' : 'Reported: secure. Move over the house or use the toggle to inspect the reality.'}</span>
    <div className="coordinates">28°36′ N &nbsp; 77°12′ E<span>SIMULATED ENVIRONMENT</span></div>
  </div>
}
