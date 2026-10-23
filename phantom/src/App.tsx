import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, ArrowDown, Fingerprint, ShieldCheck, Layers3, Radio } from 'lucide-react'
import { RealityReveal } from './components/RealityReveal'
import { CommandCenter } from './components/CommandCenter'
import './App.css'
import './components/workspace/polish.css'
import './components/workspace/signature-motion.css'
function App() {
  const reduced = useReducedMotion()
  return <><header className="navigation"><a href="#" className="wordmark" aria-label="PHANTOM home"><Fingerprint size={28} strokeWidth={1.2}/>PHANTOM<span>®</span></a><nav aria-label="Main navigation"><a href="#reality">The reality gap</a><a href="#approach">Our approach</a><a href="#command-center" className="nav-command">Command Center <ArrowUpRight size={14}/></a></nav><span className="nav-status"><i className="status-dot"/> SYSTEM AWARE</span></header>
    <main><section className="hero-section" id="reality"><div className="hero-copy"><motion.div initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}><div className="eyebrow"><span className="tiny-cross">+</span> TRUST NOTHING. VERIFY EVERYTHING.</div><h1>Everything<br/>looks secure.<br/><span>But is it?</span></h1><p className="hero-description">Your devices tell a story.<br/>PHANTOM checks if it’s true.</p><p className="hero-support">See beyond the green lights. Uncover hidden threats<br className="desktop-break"/> across your smart home, before they become real.</p><a className="primary-button" href="#command-center">Enter Command Center <ArrowUpRight size={18}/></a><div className="hero-footnote"><ShieldCheck size={13}/> Built for your home. Designed for your peace of mind.</div></motion.div><div className="hero-index"><span>01 — THE REALITY GAP</span><a href="#approach" aria-label="Explore our approach"><ArrowDown size={17}/></a></div></div><RealityReveal/></section>
    <section className="approach" id="approach"><div className="approach-intro"><span className="eyebrow">SEE THE TRUTH. STOP THE THREAT.</span><h2>Security shouldn’t<br/>take things at face value.</h2></div><div className="principle"><Layers3 size={20}/><h3>Beyond device status</h3><p>Cross-check what your devices report against what’s actually happening.</p></div><div className="principle"><Radio size={20}/><h3>Signals, connected</h3><p>Connect the dots between locks, cameras, and sensors to expose inconsistencies.</p></div><div className="principle"><ShieldCheck size={20}/><h3>Clarity before action</h3><p>Understand the evidence. Know what needs your attention and why.</p></div></section>
    <CommandCenter/></main><footer><a className="wordmark" href="#"><Fingerprint size={22}/>PHANTOM</a><span>See the truth. Stop the threat.</span><span>HACKATHON EDITION / 2026</span></footer></>
}
export default App
