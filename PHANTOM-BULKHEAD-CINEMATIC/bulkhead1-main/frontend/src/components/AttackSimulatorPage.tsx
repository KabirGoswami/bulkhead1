import React, { useState, useEffect } from 'react';
import {
  Play, RotateCcw, Activity, PlugZap, KeyRound, Download,
  LoaderCircle, Shield, AlertTriangle, CheckCircle2,
  Lock, Lightbulb, Radio, Database, ArrowRight, Eye, ShieldAlert,
  Sliders, PlayCircle, Search, RefreshCw, XCircle, Info, ChevronRight, Zap
} from 'lucide-react';
import { useBulkhead } from '../lib/session';
import { post, errorText } from '../lib/api';
import InvestigationModal from './InvestigationModal';
import SecurityTooltip from './SecurityTooltip';

interface ScenarioDef {
  id: string;
  name: string;
  backendId?: string; // Mapped to real backend A, B, C
  category: 'Backend Native' | 'PHANTOM Reality';
  description: string;
  icon: any;
  targetDevice: string;
  sourceNodeId: string;
  attackVector: string;
  incomingPacket: {
    protocol: string;
    port: number;
    destination: string;
    nonce: string;
    claimedEvent: string;
  };
  sensors: {
    name: string;
    type: string;
    status: 'supporting' | 'conflicting' | 'missing' | 'offline';
    detail: string;
  }[];
  assessmentVerdict: 'VERIFIED' | 'INCONSISTENT' | 'UNKNOWN' | 'REJECTED';
  verdictReason: string;
  decision: 'ALLOW' | 'HOLD' | 'DENY';
  decisionRationale: string;
  actuatorOutcome: string;
  stages: {
    title: string;
    detail: string;
    status: 'passed' | 'held' | 'blocked' | 'verified';
  }[];
  comparison: {
    withoutPhantom: { action: string; outcome: string; risk: string };
    withPhantom: { action: string; outcome: string; rationale: string };
  };
}

const ALL_SCENARIOS: ScenarioDef[] = [
  {
    id: 'backend-a',
    name: 'Scenario A: Compromised Smart Plug',
    backendId: 'A',
    category: 'Backend Native',
    description: 'Smart plug attempts lateral movement toward the home router and uploads 3MB to evil-cnc.net.',
    icon: PlugZap,
    targetDevice: 'Living Room Smart Plug (plug_1)',
    sourceNodeId: 'node_plug_1',
    attackVector: 'Lateral Network Flow + Command & Control',
    incomingPacket: {
      protocol: 'TCP / SSH',
      port: 8080,
      destination: 'evil-cnc.net:8080',
      nonce: 'nonce_9921_plug_c2',
      claimedEvent: 'plug.outbound_sync'
    },
    sensors: [
      { name: 'Gateway DPI Firewall', type: 'Flow Monitor', status: 'conflicting', detail: 'Destination evil-cnc.net unlisted in vendor catalog' },
      { name: 'Lateral Port Sensor', type: 'SSH Probe', status: 'conflicting', detail: 'Unauthorized connection attempt to router port 22' },
      { name: 'Household Behavioral Baseline', type: 'Statistical ML', status: 'conflicting', detail: 'Flow exceeds normal plug telemetry by 4,200%' }
    ],
    assessmentVerdict: 'REJECTED',
    verdictReason: 'Unauthorized lateral movement and anomalous C2 destination detected at boundary.',
    decision: 'DENY',
    decisionRationale: 'Outbound flow terminated. Quarantine policy isolating plug_1 into isolated VLAN.',
    actuatorOutcome: 'DEVICE ISOLATED · ROUTER MANAGEMENT PROTECTED',
    stages: [
      { title: '1. Event Ingress', detail: 'Plug generates outbound connection to evil-cnc.net:8080 and router port 22.', status: 'passed' },
      { title: '2. Detector Engine', detail: 'Baseline anomaly detection flags unauthorized lateral SSH and unknown CNC destination.', status: 'blocked' },
      { title: '3. Incident Creation', detail: 'Critical incident logged with fingerprint. Auto-containment triggered if policy permits.', status: 'verified' },
      { title: '4. Actuator Isolation', detail: 'Plug isolated in virtual network. Outbound traffic blocked by policy engine.', status: 'verified' }
    ],
    comparison: {
      withoutPhantom: {
        action: 'Unrestricted Lateral Flow',
        outcome: 'Plug traverses network to access router management interface.',
        risk: 'Perimeter compromise and botnet enrollment.'
      },
      withPhantom: {
        action: 'Access Policy Enforcement',
        outcome: 'Lateral connection blocked at boundary; incident created.',
        rationale: 'Plug destination restricted to benign vendor endpoint.'
      }
    }
  },
  {
    id: 'backend-b',
    name: 'Scenario B: Stolen Creds & Virtual Unlock',
    backendId: 'B',
    category: 'Backend Native',
    description: 'Attacker from Unknown geo brute-forces vendor account and issues virtual_unlock_request to Front Lock.',
    icon: KeyRound,
    targetDevice: 'Front Door Smart Lock (lock_1)',
    sourceNodeId: 'node_lock_1',
    attackVector: 'Credential Stuffing + Unauthorized Actuator Command',
    incomingPacket: {
      protocol: 'HTTPS / REST',
      port: 443,
      destination: 'api.smartlock.vendor/v1/unlock',
      nonce: 'nonce_8849_cred_hijack',
      claimedEvent: 'vendor.virtual_unlock_request'
    },
    sensors: [
      { name: 'Geo-IP Detector', type: 'Identity Guard', status: 'conflicting', detail: 'IP origin: Unknown external jurisdiction (mismatch with household)' },
      { name: 'Hallway Motion PIR', type: 'Infrared Sensor', status: 'conflicting', detail: 'Zero physical presence detected inside entryway' },
      { name: 'Home Perimeter Geofence', type: 'Mobile Telemetry', status: 'missing', detail: 'No authorized homeowner phone within 500m radius' }
    ],
    assessmentVerdict: 'INCONSISTENT',
    verdictReason: 'Credential geo-anomaly combined with missing occupant presence contradicts unlock request.',
    decision: 'HOLD',
    decisionRationale: 'Motorized deadbolt held in secured state. Step-up authorization prompt sent to Owner.',
    actuatorOutcome: 'DEADBOLT HELD SECURE · PERMITTED ACCESS FROZEN',
    stages: [
      { title: '1. Auth Geo-Anomaly', detail: 'Attacker-pc authenticates from Unknown geo with repeated failure then success.', status: 'passed' },
      { title: '2. Suspicious Command', detail: 'VendorCommandEvent issued: virtual_unlock_request targeted at lock_1.', status: 'held' },
      { title: '3. Policy Response', detail: 'Detector flags geo anomaly. Policy dictates REVOKE action requiring confirmation.', status: 'held' },
      { title: '4. State Protection', detail: 'Actuator unlock held. Shared vendor account link marked for revocation.', status: 'verified' }
    ],
    comparison: {
      withoutPhantom: {
        action: 'Immediate Virtual Unlock',
        outcome: 'Front door deadbolt unlocks without verifying occupant location.',
        risk: 'Physical intrusion via compromised cloud credentials.'
      },
      withPhantom: {
        action: 'Sensitive Command Hold',
        outcome: 'Unlock request held; account revocation proposed for Owner confirmation.',
        rationale: 'Sensitive physical actuators require step-up authorization upon credential anomalies.'
      }
    }
  },
  {
    id: 'backend-c',
    name: 'Scenario C: Benign Firmware Update',
    backendId: 'C',
    category: 'Backend Native',
    description: 'Google Nest Thermostat downloads verified 2MB firmware update from updates.google.com.',
    icon: Download,
    targetDevice: 'Hallway Thermostat (thermostat)',
    sourceNodeId: 'node_thermostat_1',
    attackVector: 'Benign Telemetry Spike',
    incomingPacket: {
      protocol: 'TLS 1.3 / HTTPS',
      port: 443,
      destination: 'updates.google.com',
      nonce: 'nonce_7712_google_ota',
      claimedEvent: 'firmware.ota_download'
    },
    sensors: [
      { name: 'PKI Certificate Verifier', type: 'X.509 Pinning', status: 'supporting', detail: 'Signed by official Google Nest OTA Root CA' },
      { name: 'Device Profile Whitelist', type: 'Domain Filter', status: 'supporting', detail: 'Destination *.google.com pre-approved in thermostat profile' },
      { name: 'Telemetry Baseline', type: 'Volume Heuristic', status: 'supporting', detail: 'Periodic maintenance window matches manufacturer OTA schedule' }
    ],
    assessmentVerdict: 'VERIFIED',
    verdictReason: 'Cryptographic certificate and domain match verified manufacturer baseline.',
    decision: 'ALLOW',
    decisionRationale: 'Routine vendor maintenance approved without resident disruption or false alarm.',
    actuatorOutcome: 'OTA UPDATE ALLOWED · SERVICE UNINTERRUPTED',
    stages: [
      { title: '1. Volume Spike', detail: '2MB flow observed on port 443 to updates.google.com.', status: 'passed' },
      { title: '2. Vendor Verification', detail: 'Destination matches *.google.com vendor domain in device profile.', status: 'passed' },
      { title: '3. Baseline Update', detail: 'Flow accepted as benign vendor update; baseline learns verified traffic.', status: 'verified' },
      { title: '4. Uninterrupted Service', detail: 'Thermostat operates normally without false alerts.', status: 'verified' }
    ],
    comparison: {
      withoutPhantom: {
        action: 'Heuristic False Alarm',
        outcome: 'Generic IDS flags large data spike as exfiltration and locks device.',
        risk: 'Resident disruption and alert fatigue.'
      },
      withPhantom: {
        action: 'Vendor-Aware Whitelisting',
        outcome: 'Verified vendor update allowed smoothly without disruption.',
        rationale: 'Cryptographic vendor domain matching prevents false positives.'
      }
    }
  },
  {
    id: 'phantom-1',
    name: 'PHANTOM 1: Legitimate Entry Sequence',
    category: 'PHANTOM Reality',
    description: 'Resident unlocks deadbolt, opens contact sensor, and triggers PIR motion within 2s.',
    icon: CheckCircle2,
    targetDevice: 'Hallway Smart Light (bulb_1)',
    sourceNodeId: 'node_door_1',
    attackVector: 'Legitimate Human Ingress',
    incomingPacket: {
      protocol: 'Zigbee / Z-Wave',
      port: 8443,
      destination: 'local-gateway/contact',
      nonce: 'nonce_1190_seq_fresh',
      claimedEvent: 'door.contact_open'
    },
    sensors: [
      { name: 'Magnetic Reed Contact', type: 'Contact', status: 'supporting', detail: 'Valid state transition: CLOSED → OPEN' },
      { name: 'Hallway Motion PIR', type: 'Infrared', status: 'supporting', detail: 'PIR triggered +1.6s after contact transition' },
      { name: 'Smart Deadbolt', type: 'Mechanical Lock', status: 'supporting', detail: 'Deadbolt unlocked with verified keypad PIN' }
    ],
    assessmentVerdict: 'VERIFIED',
    verdictReason: 'Multi-sensor temporal sequence corroborates legitimate physical ingress.',
    decision: 'ALLOW',
    decisionRationale: 'Convenience lighting automation executed immediately.',
    actuatorOutcome: 'HALLWAY LIGHT ACTIVATED (100% BRIGHTNESS)',
    stages: [
      { title: '1. Multi-Sensor Ingress', detail: 'Door contact OPEN followed by PIR motion detection.', status: 'passed' },
      { title: '2. Evidence Corroboration', detail: 'Corroborating sensors confirm physical presence.', status: 'passed' },
      { title: '3. Reality Assessment', detail: 'Verdict: VERIFIED. Ingress sequence physically sound.', status: 'verified' },
      { title: '4. Routine Automation', detail: 'Hallway light turned ON. Convenience automation executed without hold.', status: 'verified' }
    ],
    comparison: {
      withoutPhantom: {
        action: 'Blind Trigger',
        outcome: 'Light turns on without contextual verification.',
        risk: 'Low impact on benign events.'
      },
      withPhantom: {
        action: 'Corroborated Execution',
        outcome: 'Light turns on with physical confidence metric logged.',
        rationale: 'Low-risk actions proceed seamlessly when corroboration passes.'
      }
    }
  },
  {
    id: 'phantom-2',
    name: 'PHANTOM 2: Spoofed Door Contact Attack',
    category: 'PHANTOM Reality',
    description: 'Compromised sensor injects valid door.open message, but motion detector and deadbolt disagree.',
    icon: AlertTriangle,
    targetDevice: 'Front Door Smart Lock (lock_1)',
    sourceNodeId: 'node_door_1',
    attackVector: 'Single-Sensor Telemetry Spoofing',
    incomingPacket: {
      protocol: 'Zigbee / Mesh',
      port: 8443,
      destination: 'local-gateway/door',
      nonce: 'nonce_4492_spoofed',
      claimedEvent: 'door.open'
    },
    sensors: [
      { name: 'Front Door Contact', type: 'Magnetic Reed', status: 'supporting', detail: 'Sensor reports door OPEN with valid HMAC' },
      { name: 'Hallway Motion PIR', type: 'Infrared', status: 'conflicting', detail: 'No motion detected within 15s correlation window' },
      { name: 'Smart Deadbolt', type: 'Motorized Lock', status: 'conflicting', detail: 'Deadbolt remains physically locked in jam' }
    ],
    assessmentVerdict: 'INCONSISTENT',
    verdictReason: 'Contradiction between claimed door open and stationary physical deadbolt/motion.',
    decision: 'HOLD',
    decisionRationale: 'High-impact physical unlocking held. Routine convenience preserved, sensitive access protected.',
    actuatorOutcome: 'DEADBOLT HELD IN CURRENT STATE (SECURED)',
    stages: [
      { title: '1. Ingress Message', detail: 'Door sensor reports OPEN with valid cryptographic HMAC.', status: 'passed' },
      { title: '2. Reality Cross-Check', detail: 'Hallway motion detector reports NO activity within 10s window.', status: 'blocked' },
      { title: '3. Reality Assessment', detail: 'Verdict: INCONSISTENT. Contradiction between door and motion.', status: 'held' },
      { title: '4. Actuator Protection', detail: 'Auto-unlock held. Lock remains secured pending resident review.', status: 'held' }
    ],
    comparison: {
      withoutPhantom: {
        action: 'Blind Auto-Unlock',
        outcome: 'Smart lock unlocks based solely on single compromised sensor.',
        risk: 'Physical home perimeter breached via sensor spoofing.'
      },
      withPhantom: {
        action: 'Multi-Sensor Hold',
        outcome: 'Actuator remains securely locked; owner receives verification prompt.',
        rationale: 'Contradictory sensor reports prevent sensitive physical actions.'
      }
    }
  }
];

export default function AttackSimulatorPage() {
  const { path, state, canWrite, refresh, liveEvents } = useBulkhead();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDef>(ALL_SCENARIOS[0]);
  const [loading, setLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<string>(state?.profile || 'Admin');
  const [profileLoading, setProfileLoading] = useState(false);

  // Dynamic 6-Stage Simulation State
  const [simRunning, setSimRunning] = useState(false);
  const [currentSimStage, setCurrentSimStage] = useState<number>(0);
  // 0: Pre-simulation idle
  // 1: Initiated (scan line + device highlight)
  // 2: Incoming Event (packet animation)
  // 3: Evidence Analysis (sensor nodes reveal)
  // 4: Security Assessment (large verdict)
  // 5: Automation Decision (boundary enforcement)
  // 6: Final Outcome (actuator result & audit)

  // Interactive Hover & Inspection
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedInspectNode, setSelectedInspectNode] = useState<string | null>(null);
  const [hoveredSensor, setHoveredSensor] = useState<string | null>(null);
  const [investigationOpen, setInvestigationOpen] = useState(false);

  const activeScenarioId = state?.scenario;
  const tickCount = state?.tick ?? 0;

  // Run simulation with staged visual choreography
  const handleRunSimulation = async (sc: ScenarioDef) => {
    setLoading(sc.id);
    setStatusMessage('');
    setErrorMessage('');
    setSimRunning(true);
    setCurrentSimStage(1);

    try {
      if (sc.backendId) {
        await post(path(`/scenarios/${sc.backendId}`));
        setStatusMessage(`Backend Scenario ${sc.backendId} (${sc.name}) started. Live traffic is streaming.`);
      } else {
        setStatusMessage(`Demonstration Scenario "${sc.name}" executed in verified reality pipeline.`);
      }
      await refresh();
    } catch (err) {
      setErrorMessage(errorText(err));
    } finally {
      setLoading(null);
    }
  };

  // Progression timer for the visual stages when simRunning
  useEffect(() => {
    if (!simRunning) return;

    if (currentSimStage >= 1 && currentSimStage < 6) {
      const delay = currentSimStage === 1 ? 1200 : currentSimStage === 2 ? 1400 : 1600;
      const timer = setTimeout(() => {
        setCurrentSimStage(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [simRunning, currentSimStage]);

  // Reset simulation
  const handleResetSimulation = async () => {
    setLoading('reset');
    setSimRunning(false);
    setCurrentSimStage(0);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const res = await post(path('/scenarios/reset'));
      setStatusMessage(res.message || 'Simulation stopped and reset to nominal baseline.');
      await refresh();
    } catch (err) {
      setErrorMessage(errorText(err));
    } finally {
      setLoading(null);
    }
  };

  const handleProfileChange = async (newProfile: string) => {
    setProfileLoading(true);
    try {
      await post(path('/profile'), { profile: newProfile });
      setSelectedProfile(newProfile);
      await refresh();
    } catch (err) {
      setErrorMessage(errorText(err));
    } finally {
      setProfileLoading(false);
    }
  };

  // Environment Nodes for Visualization
  const ENV_NODES = [
    { id: 'node_plug_1', name: 'Smart Plug', type: 'IoT Plug', x: 80, y: 70, ip: '192.168.1.101', icon: PlugZap },
    { id: 'node_lock_1', name: 'Front Deadbolt', type: 'Motorized Lock', x: 260, y: 70, ip: '192.168.1.102', icon: Lock },
    { id: 'node_door_1', name: 'Door Contact', type: 'Sensor', x: 80, y: 220, ip: '192.168.1.103', icon: Activity },
    { id: 'node_thermostat_1', name: 'Thermostat', type: 'Climate', x: 260, y: 220, ip: '192.168.1.104', icon: Download },
    { id: 'node_router_1', name: 'OpenWrt Router', type: 'Gateway', x: 440, y: 145, ip: '192.168.1.1', icon: Shield },
    { id: 'node_cloud_1', name: 'Vendor Cloud', type: 'External', x: 620, y: 145, ip: 'WAN Endpoint', icon: Radio },
  ];

  return (
    <div className="phantom-simulator">
      {/* Deep Investigation Modal */}
      <InvestigationModal
        isOpen={investigationOpen}
        onClose={() => setInvestigationOpen(false)}
        targetId={selectedScenario.id}
      />

      {/* Header */}
      <header className="phantom-page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
          <div className="phantom-page-eyebrow" style={{ margin: 0 }}>
            <span>05 / ATTACK SIMULATOR</span>
          </div>
          <span className="phantom-badge phantom-badge--amber" style={{ letterSpacing: '1px', fontWeight: 700, padding: '3px 8px' }}>
            SIMULATION ONLY
          </span>
        </div>
        <h1 className="phantom-page-title" style={{ fontSize: '32px', letterSpacing: '-1.5px', textTransform: 'uppercase' }}>
          TEST THE THREAT.<br />WATCH THE RESPONSE.
        </h1>
        <p className="phantom-page-subtitle">
          Run controlled smart-home security scenarios and inspect how the system responds.
        </p>
      </header>

      {/* Top Status & Controls Ribbon */}
      <section className="phantom-card" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-dot ${activeScenarioId || simRunning ? 'status-dot--active' : ''}`} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {simRunning
                  ? `Simulation Active · Stage ${currentSimStage}/6: ${
                      currentSimStage === 1 ? 'Initiating Scan' :
                      currentSimStage === 2 ? 'Ingress Processing' :
                      currentSimStage === 3 ? 'Multi-Sensor Correlating' :
                      currentSimStage === 4 ? 'Verdict Revealed' :
                      currentSimStage === 5 ? 'Policy Boundary Enforcement' : 'Final Actuation Complete'
                    }`
                  : activeScenarioId ? `Backend Active: Scenario ${activeScenarioId}` : 'Nominal Baseline · Ready'}
              </span>
            </div>
            <span className="toolbar-divider" />
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
              Tick Count: <strong>{tickCount}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Profile Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <Sliders size={14} color="var(--muted)" />
              <span style={{ color: 'var(--muted)' }}>Policy Profile:</span>
              <select
                value={state?.profile || selectedProfile}
                onChange={e => handleProfileChange(e.target.value)}
                disabled={profileLoading || !canWrite}
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: '0',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="Admin">Admin (Strict)</option>
                <option value="Family">Family (Balanced)</option>
                <option value="Work">Work (Restricted)</option>
                <option value="Solo">Solo (Autonomous)</option>
              </select>
            </div>

            {/* Reset Simulation Button */}
            <button
              type="button"
              className="phantom-btn-secondary"
              onClick={handleResetSimulation}
              disabled={loading !== null || !canWrite}
            >
              {loading === 'reset' ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reset Stage
            </button>
          </div>
        </div>
      </section>

      {statusMessage && <div role="status" className="app-notice" style={{ marginBottom: '20px' }}>{statusMessage}</div>}
      {errorMessage && <div role="alert" className="app-error" style={{ marginBottom: '20px' }}>{errorMessage}</div>}

      {/* Main Simulation Layout: 3 Columns (Left: Scenario Control, Center: Interactive Stage, Right: Response) */}
      <div className="sim-layout-grid">
        {/* LEFT COLUMN: Scenario Picker & Trigger */}
        <section className="phantom-card sim-col-left">
          <div className="phantom-card-header">
            <div>
              <span className="phantom-badge phantom-badge--red" style={{ marginBottom: '4px' }}>STAGE 1</span>
              <h2 className="phantom-card-title" style={{ fontSize: '15px' }}>Scenarios</h2>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
              {ALL_SCENARIOS.length} Scenarios
            </span>
          </div>

          <div className="scenario-select-list">
            {ALL_SCENARIOS.map(sc => {
              const Icon = sc.icon;
              const isSelected = selectedScenario.id === sc.id;
              const isBackendActive = sc.backendId && state?.scenario === sc.backendId;

              return (
                <button
                  key={sc.id}
                  type="button"
                  className={`scenario-option-btn ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedScenario(sc);
                    if (!simRunning) setCurrentSimStage(0);
                  }}
                >
                  <div className="scenario-option-btn__icon">
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <strong className="scenario-option-btn__title">{sc.name}</strong>
                      <span className={`phantom-badge ${sc.category === 'Backend Native' ? 'phantom-badge--green' : 'phantom-badge--amber'}`} style={{ fontSize: '8px' }}>
                        {sc.category}
                      </span>
                    </div>
                    <p className="scenario-option-btn__desc">{sc.description}</p>
                    {isBackendActive && (
                      <span className="phantom-badge phantom-badge--green" style={{ marginTop: '6px', display: 'inline-block' }}>
                        ● Backend Streaming
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action Trigger */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button
              type="button"
              className="phantom-btn-primary"
              onClick={() => handleRunSimulation(selectedScenario)}
              disabled={loading !== null || !canWrite}
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
            >
              {loading === selectedScenario.id ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Initiating {selectedScenario.name}...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Execute {selectedScenario.name}
                </>
              )}
            </button>
          </div>
        </section>

        {/* CENTER COLUMN: Interactive Cinematic Simulation Stage */}
        <section className={`phantom-card sim-col-center ${simRunning ? 'is-active-workspace' : ''}`}>
          <div className="phantom-card-header">
            <div>
              <span className="phantom-badge phantom-badge--green" style={{ marginBottom: '4px' }}>STAGE 2</span>
              <h2 className="phantom-card-title">Live Interactive Environment Stage</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="phantom-btn-secondary"
                onClick={() => setInvestigationOpen(true)}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                <Search size={12} /> Deep Investigation
              </button>
            </div>
          </div>

          {/* SVG Interactive Topology Visualization */}
          <div className="sim-interactive-stage">
            {/* Ambient Animated Scan Line */}
            {simRunning && currentSimStage >= 1 && (
              <div className="sim-scanline-sweep" />
            )}

            <svg viewBox="0 0 740 300" className="sim-svg-canvas">
              {/* Background Technical Grid */}
              <defs>
                <pattern id="sim-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#202020" strokeWidth="0.5" />
                </pattern>
                <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#C81B1C" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#C81B1C" stopOpacity="1" />
                  <stop offset="100%" stopColor="#C81B1C" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#sim-grid)" />

              {/* Connection Lines */}
              <g stroke="#303030" strokeWidth="1.2">
                <line x1="120" y1="70" x2="440" y2="145" />
                <line x1="300" y1="70" x2="440" y2="145" />
                <line x1="120" y1="220" x2="440" y2="145" />
                <line x1="300" y1="220" x2="440" y2="145" />
                <line x1="440" y1="145" x2="620" y2="145" strokeDasharray="4 4" />
              </g>

              {/* Active Animated Threat Line */}
              {simRunning && currentSimStage >= 2 && (
                <line
                  x1={selectedScenario.sourceNodeId === 'node_plug_1' ? '120' : '120'}
                  y1={selectedScenario.sourceNodeId === 'node_plug_1' ? '70' : '220'}
                  x2="440"
                  y2="145"
                  stroke="#C81B1C"
                  strokeWidth="2.5"
                  className="threat-pulse-line"
                />
              )}

              {/* Policy Boundary Barrier Line */}
              <line x1="530" y1="20" x2="530" y2="280" stroke="#C81B1C" strokeWidth="1" strokeDasharray="6 4" opacity="0.6" />
              <text x="535" y="35" fill="#C81B1C" fontSize="9" fontFamily="var(--font-jb)">POLICY BOUNDARY</text>

              {/* Render Interactive Device Nodes */}
              {ENV_NODES.map(node => {
                const Icon = node.icon;
                const isTarget = node.id === selectedScenario.sourceNodeId;
                const isHovered = hoveredNode === node.id;
                const isSelected = selectedInspectNode === node.id;

                return (
                  <g
                    key={node.id}
                    className={`sim-node-group ${isTarget && simRunning ? 'is-threatened' : ''} ${isHovered ? 'is-hovered' : ''}`}
                    onClick={() => setSelectedInspectNode(node.id)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isTarget && simRunning ? 24 : 18}
                      fill={isTarget && simRunning ? '#C81B1C' : isHovered ? '#222' : '#111'}
                      stroke={isTarget && simRunning ? '#FFF' : isHovered ? '#C81B1C' : '#333'}
                      strokeWidth={isTarget && simRunning ? 2 : 1}
                    />
                    <foreignObject x={node.x - 10} y={node.y - 10} width="20" height="20">
                      <Icon size={16} color={isTarget && simRunning ? '#FFF' : '#A0A0A0'} />
                    </foreignObject>
                    <text
                      x={node.x}
                      y={node.y + 32}
                      textAnchor="middle"
                      fill={isTarget && simRunning ? '#FFF' : '#999'}
                      fontSize="10"
                      fontFamily="var(--font-sg)"
                      fontWeight="600"
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Floating Device Metadata Tooltip */}
            {hoveredNode && (
              <div className="sim-floating-tooltip">
                {(() => {
                  const node = ENV_NODES.find(n => n.id === hoveredNode);
                  if (!node) return null;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '12px' }}>{node.name}</strong>
                        <span className="phantom-badge phantom-badge--green">{node.type}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
                        IP: {node.ip} · Blast Radius: 1.0 (Direct)
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Dynamic 6-Stage Progress Indicator */}
          <div className="sim-stages-stepper">
            {[
              { num: 1, name: 'Initiated' },
              { num: 2, name: 'Ingress' },
              { num: 3, name: 'Evidence' },
              { num: 4, name: 'Verdict' },
              { num: 5, name: 'Decision' },
              { num: 6, name: 'Outcome' },
            ].map(step => (
              <div
                key={step.num}
                className={`sim-step-item ${currentSimStage >= step.num ? 'is-completed' : ''} ${currentSimStage === step.num ? 'is-current' : ''}`}
                onClick={() => simRunning && setCurrentSimStage(step.num)}
              >
                <span className="sim-step-circle">{step.num}</span>
                <span className="sim-step-label">{step.name}</span>
              </div>
            ))}
          </div>

          {/* Live Ingress Event Data Reveal (Stage 2+) */}
          {currentSimStage >= 2 && (
            <div className="sim-event-packet-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="section-eyebrow" style={{ margin: 0 }}>
                  <Activity size={13} color="var(--accent)" /> STAGE 2: INCOMING TELEMETRY PACKET
                </span>
                <span className="phantom-badge phantom-badge--red">CAPTURED AT BOUNDARY</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '11px', fontFamily: 'var(--font-jb)' }}>
                <div><span style={{ color: 'var(--muted)' }}>CLAIMED:</span> <strong>{selectedScenario.incomingPacket.claimedEvent}</strong></div>
                <div><span style={{ color: 'var(--muted)' }}>PORT:</span> <strong>{selectedScenario.incomingPacket.port}</strong></div>
                <div><span style={{ color: 'var(--muted)' }}>DESTINATION:</span> <strong>{selectedScenario.incomingPacket.destination}</strong></div>
                <div><span style={{ color: 'var(--muted)' }}>NONCE:</span> <strong>{selectedScenario.incomingPacket.nonce}</strong></div>
              </div>
            </div>
          )}

          {/* Multi-Sensor Evidence Analysis Grid (Stage 3+) */}
          {currentSimStage >= 3 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="section-eyebrow" style={{ margin: 0 }}>
                  STAGE 3: MULTI-SENSOR CORROBORATION MATRIX
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Hover node to inspect evidence</span>
              </div>

              <div className="evidence-matrix">
                {selectedScenario.sensors.map((sensor, idx) => (
                  <div
                    key={idx}
                    className={`evidence-sensor-pill ${hoveredSensor === sensor.name ? 'is-hovered' : ''}`}
                    onMouseEnter={() => setHoveredSensor(sensor.name)}
                    onMouseLeave={() => setHoveredSensor(null)}
                    style={{
                      borderLeft: `3px solid ${
                        sensor.status === 'supporting' ? 'var(--verified)' :
                        sensor.status === 'conflicting' ? 'var(--danger)' : 'var(--warning)'
                      }`
                    }}
                  >
                    <div className="evidence-sensor-pill__top">
                      <span className="evidence-sensor-name">{sensor.name}</span>
                      <span className={`phantom-badge ${
                        sensor.status === 'supporting' ? 'phantom-badge--green' :
                        sensor.status === 'conflicting' ? 'phantom-badge--red' : 'phantom-badge--amber'
                      }`}>
                        {sensor.status.toUpperCase()}
                      </span>
                    </div>
                    <span className="evidence-sensor-reading">{sensor.type}</span>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
                      {sensor.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Security Verdict & Final Decision (Stages 4-6) */}
        <section className="phantom-card sim-col-right">
          <div className="phantom-card-header">
            <div>
              <span className="phantom-badge phantom-badge--green" style={{ marginBottom: '4px' }}>STAGE 4-6</span>
              <h2 className="phantom-card-title" style={{ fontSize: '15px' }}>Response & Policy</h2>
            </div>
            <SecurityTooltip term="POLICY_BOUNDARY" />
          </div>

          {currentSimStage < 4 ? (
            <div className="sim-waiting-state">
              <span className="sim-waiting-pulse" />
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '12px 0 6px', textAlign: 'center' }}>
                Execute simulation to observe verdict, policy holding, and actuator outcome.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Stage 4: Large Security Verdict Panel */}
              <div className={`verdict-panel-box verdict-panel--${selectedScenario.assessmentVerdict.toLowerCase()}`}>
                <span style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
                  STAGE 4 · SECURITY VERDICT
                </span>
                <div className="verdict-title-text">
                  {selectedScenario.assessmentVerdict}
                </div>
                <p style={{ fontSize: '12px', margin: '6px 0 0', color: 'var(--text)', lineHeight: 1.5 }}>
                  {selectedScenario.verdictReason}
                </p>
              </div>

              {/* Stage 5: Automation Decision Boundary */}
              {currentSimStage >= 5 && (
                <div style={{ padding: '14px', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>STAGE 5 · AUTOMATION DECISION</span>
                    <span className={`phantom-badge ${selectedScenario.decision === 'ALLOW' ? 'phantom-badge--green' : 'phantom-badge--red'}`}>
                      {selectedScenario.decision === 'ALLOW' ? 'ACTION ALLOWED' : selectedScenario.decision === 'HOLD' ? 'ACTION HELD' : 'ACTION DENIED'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4 }}>
                    {selectedScenario.decisionRationale}
                  </p>
                </div>
              )}

              {/* Stage 6: Final Virtual Actuator State */}
              {currentSimStage >= 6 && (
                <div style={{ padding: '14px', background: '#080808', border: '1px solid #292929' }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--accent)', fontFamily: 'var(--font-jb)', fontWeight: 700 }}>
                    STAGE 6 · FINAL ACTUATOR AUDIT
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', margin: '4px 0 8px' }}>
                    {selectedScenario.actuatorOutcome}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
                    <span>AUDIT HASH:</span>
                    <span>sha256:49f2b801a</span>
                  </div>
                </div>
              )}

              {/* Before vs After Split Comparison */}
              <div style={{ marginTop: '8px' }}>
                <span className="section-eyebrow">Without PHANTOM vs With PHANTOM</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                  <div style={{ padding: '8px 10px', background: 'var(--surface-raised)', borderLeft: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 700 }}>WITHOUT PHANTOM</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                      {selectedScenario.comparison.withoutPhantom.outcome}
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'var(--surface-raised)', borderLeft: '3px solid var(--verified)' }}>
                    <div style={{ fontSize: '9px', color: 'var(--verified)', fontWeight: 700 }}>WITH PHANTOM</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                      {selectedScenario.comparison.withPhantom.outcome}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
