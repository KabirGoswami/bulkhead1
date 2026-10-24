import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface SecurityTooltipProps {
  term: 'REPLAY' | 'INCONSISTENT' | 'HOLD' | 'VERIFIED' | 'HMAC' | 'ACTUATOR' | 'BLAST_RADIUS' | 'QUARANTINE' | 'POLICY_BOUNDARY' | 'SIMULATION';
  children?: React.ReactNode;
}

const TOOLTIP_DEFINITIONS: Record<string, { title: string; explanation: string }> = {
  POLICY_BOUNDARY: {
    title: 'Policy Decision Boundary',
    explanation: 'The logical perimeter where ingress commands are assessed against household policies before actuator dispatch.'
  },
  SIMULATION: {
    title: 'Deterministic Sandbox',
    explanation: 'Controlled security testing environment running against virtual devices without physical risk.'
  },
  REPLAY: {
    title: 'Replay Attack Protection',
    explanation: 'Detects captured and retransmitted legitimate packets using monotonic sequence counters and nonce caches.'
  },
  INCONSISTENT: {
    title: 'Contextual Inconsistency',
    explanation: 'A telemetry packet arrived with valid credentials, but contradicting physical sensors (e.g. door open with zero motion).'
  },
  HOLD: {
    title: 'Policy Hold State',
    explanation: 'Sensitive physical actuation (like unlocking a deadbolt) is suspended until household owner verification is provided.'
  },
  VERIFIED: {
    title: 'Verified Reality',
    explanation: 'All corroborating sensors agree with the physical event within the expected time window and spatial bounds.'
  },
  HMAC: {
    title: 'Cryptographic Message Authentication',
    explanation: 'Proves the message was created by a device with the shared key and has not been altered in transit.'
  },
  ACTUATOR: {
    title: 'Virtual Actuator',
    explanation: 'Physical smart-home mechanisms (deadbolts, switches, thermostats) that execute physical changes in the house.'
  },
  BLAST_RADIUS: {
    title: 'Compromise Blast Radius',
    explanation: 'The maximum potential network and physical impact a compromised IoT device can achieve before reaching policy boundaries.'
  },
  QUARANTINE: {
    title: 'OpenWrt Network Quarantine',
    explanation: 'Isolates the compromised device into a sandboxed VLAN, dropping lateral flows while preserving forensic capture.'
  }
};

export default function SecurityTooltip({ term, children }: SecurityTooltipProps) {
  const [show, setShow] = useState(false);
  const def = TOOLTIP_DEFINITIONS[term] || { title: term, explanation: '' };

  return (
    <span
      className="sec-tooltip-wrapper"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      role="tooltip"
    >
      {children || (
        <span className="sec-tooltip-trigger">
          <span>{term}</span>
          <HelpCircle size={11} className="sec-tooltip-icon" />
        </span>
      )}

      {show && (
        <div className="sec-tooltip-popover">
          <div className="sec-tooltip-title">{def.title}</div>
          <div className="sec-tooltip-desc">{def.explanation}</div>
        </div>
      )}
    </span>
  );
}
