import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Shield, Unplug, Undo2, Check } from 'lucide-react'
import { devices } from '../../data/devices'
import { deviceName, timeLabel, type DeviceId, type ContainmentAction } from '../../data/security'
import { ContainmentMap, type ContainmentSequence } from './ContainmentMap'
interface Props { selected: DeviceId; onSelect: (id: DeviceId) => void; isolated: Set<DeviceId>; onAction: (id: DeviceId, action: 'isolate' | 'restore') => void; actions: ContainmentAction[] }
export function ContainmentPanel({ selected, onSelect, isolated, onAction, actions }: Props) {
  const reduced = useReducedMotion()
  const [sequence, setSequence] = useState<ContainmentSequence | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const actionRef = useRef(onAction)
  useEffect(() => { actionRef.current = onAction }, [onAction])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const target = sequence?.deviceId ?? selected
  const busy = sequence !== null
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState<DeviceId | null>(null)
  const [notice, setNotice] = useState('')
  const device = devices.find(d => d.id === target)!
  const isGateway = device.kind === 'router'
  const blocked = isolated.has(target)
  function requestIsolation() { setPending(selected); dialog.current?.showModal() }
  function close() { dialog.current?.close(); setPending(null); trigger.current?.focus() }
  function begin(id: DeviceId, action: 'isolate' | 'restore') {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (reduced) {
      actionRef.current(id, action)
      setNotice(action === 'isolate' ? 'DEVICE ISOLATED. Other device routes remain connected.' : 'DEVICE RESTORED. Existing findings still require review.')
      return
    }
    const key = Date.now()
    setSequence({ deviceId: id, action, key, phase: action === 'isolate' ? 'identified' : 'restoring' })
    setNotice(action === 'isolate' ? 'Threat identified. Preparing selective containment…' : 'Restoring the selected device route…')
    const schedule = (delay: number, callback: () => void) => timers.current.push(setTimeout(callback, delay))
    schedule(action === 'isolate' ? 500 : 1400, () => {
      actionRef.current(id, action)
      if (action === 'isolate') {
        setSequence({ deviceId: id, action, key, phase: 'severing' })
        setNotice('Severing selected device connections. Other routes remain active.')
      }
    })
    if (action === 'isolate') schedule(1400, () => {
      setSequence({ deviceId: id, action, key, phase: 'complete' })
      setNotice('Forming containment boundary…')
    })
    schedule(2000, () => {
      setSequence(null)
      setNotice(action === 'isolate' ? 'DEVICE ISOLATED. Other device routes remain connected.' : 'DEVICE RESTORED. Existing findings still require review.')
    })
  }
  function confirm() {
    if (!pending || busy) return
    const id = pending
    close()
    begin(id, 'isolate')
  }
  return <section className="workspace-section" id="phantom-mode" aria-labelledby="phantom-heading"><div className="workspace-heading"><div><span className="eyebrow">05 / PHANTOM MODE</span><h2 id="phantom-heading">Contain the device. Keep the home.</h2><p>Preview selective isolation, confirm it, and restore access when you’re ready.</p></div><span className="simulation-badge"><Shield size={13}/> SIMULATION ONLY</span></div>
    <div className={`containment-layout ${blocked ? 'containment-active' : ''}`}><div className="containment-controls"><label htmlFor="containment-device">TARGET DEVICE</label><select id="containment-device" disabled={busy} value={target} onChange={e => { onSelect(e.target.value as DeviceId); setNotice('') }}>{devices.map(d => <option key={d.id} value={d.id}>{d.name}{d.kind === 'router' ? ' · protected gateway' : ''}</option>)}</select><div className={`containment-state ${blocked ? 'is-contained' : ''}`}>{blocked ? <Unplug size={21}/> : <Shield size={21}/>}<h3>{sequence ? sequence.phase === 'identified' ? 'Threat identified' : sequence.phase === 'severing' ? 'Severing connections' : sequence.phase === 'restoring' ? 'Restoring device' : 'Securing boundary' : blocked ? 'Device isolated' : isGateway ? 'Gateway protected' : 'Device connected'}</h3></div><p>{isGateway ? 'Isolating the gateway would disconnect the whole home. Select an individual device for selective containment.' : blocked ? 'Simulated local and outbound routes are blocked for this device. Historical findings remain available.' : 'Isolation blocks this device’s simulated local and outbound routes. Other home devices retain their existing connections.'}</p><p className="containment-caution">{device.kind === 'lock' ? 'Isolation cannot close the door or guarantee a locked deadbolt. Verify the physical door.' : device.kind === 'alarm' ? 'Hub isolation may interrupt remote arming and alerts. Verify the alarm locally.' : device.kind === 'camera' ? 'Camera isolation interrupts remote video and cloud alerts in the simulation.' : 'Gateway isolation is unavailable in selective containment.'}</p><button ref={trigger} disabled={isGateway || busy} className={blocked ? 'secondary-button' : 'contain-button'} onClick={() => { if(blocked) { begin(target, 'restore') } else requestIsolation() }}>{blocked ? <Undo2 size={15}/> : <Unplug size={15}/>} {busy ? 'Sequence in progress…' : blocked ? 'Restore device connection' : 'Preview & confirm isolation'}</button><p role="status" className="containment-notice">{notice}</p></div><div className="containment-comparison"><div className="containment-stage-label"><span className={`containment-sequence ${blocked ? 'sequence-isolated' : ''}`} key={`${target}-${blocked}`} aria-hidden="true"><i/><i/><i/></span><span>SELECTIVE NETWORK BOUNDARY</span><strong>{sequence ? sequence.phase === 'identified' ? '01 / THREAT IDENTIFIED' : sequence.phase === 'severing' ? '02 / CONNECTIONS SEVERED' : sequence.phase === 'restoring' ? 'RESTORING CONNECTIONS' : '03 / CONTAINMENT COMPLETE' : blocked ? 'DEVICE ISOLATED' : 'CONTAINMENT PREVIEW'}</strong><span>{devices.length - isolated.size} OF {devices.length} DEVICES CONNECTED</span></div><ContainmentMap target={target} blocked={blocked} isolated={isolated} sequence={sequence} label="CURRENT NETWORK"/><ContainmentMap preview target={target} blocked={isGateway ? false : !blocked} isolated={isolated} label={isGateway ? 'SELECT A DEVICE TO PREVIEW' : blocked ? 'AFTER RESTORATION · PREVIEW' : 'AFTER ISOLATION · PREVIEW'}/></div></div>
    <div className="action-log"><h3>Containment activity <span>{actions.length} actions</span></h3>{actions.length === 0 ? <p>No containment actions yet. Your changes stay in this browser session.</p> : <ol>{[...actions].reverse().map(a => <li key={a.id}><Check size={13}/><time dateTime={a.timestamp}>{timeLabel(a.timestamp)} IST</time><strong>{deviceName(a.deviceId)}</strong><span>{a.action === 'isolate' ? 'Isolated' : 'Restored'} · simulation</span></li>)}</ol>}</div>
    <dialog ref={dialog} className="containment-dialog" onCancel={close} onClick={e => { if(e.target === e.currentTarget) close() }} onClose={() => { setPending(null); trigger.current?.focus() }} aria-labelledby="containment-dialog-title"><span className="eyebrow">PHANTOM MODE / CONFIRM CONTAINMENT</span><h2 id="containment-dialog-title">Isolate {pending ? deviceName(pending) : 'device'}?</h2><p>This simulation will block the selected device’s local and outbound traffic. Other device connections remain unchanged.</p><p>Remote control and alerts for this device may become unavailable. Isolation does not fix the underlying finding or change physical door and alarm states.</p><p className="workspace-note">Frontend demonstration. No real network enforcement is performed.</p><div className="dialog-actions"><button autoFocus className="secondary-button" onClick={close}>Cancel</button><button className="contain-button" onClick={confirm}><Unplug size={14}/> Confirm isolation</button></div></dialog>
  </section>
}
