import React, { useState, useEffect } from 'react';
import {
  Network, Cpu, Shield, ShieldAlert, ShieldCheck, X,
  Radio, Lock, Unlock, AlertTriangle, ExternalLink,
  Info, Search, Filter, Layers, Zap, Wifi
} from 'lucide-react';
import { useBulkhead } from '../lib/session';
import { api, errorText } from '../lib/api';
import HomeMap from './HomeMap';

export default function SmartHomePage() {
  const { state, path, canWrite, refresh } = useBulkhead();
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'map'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [hoveredDevId, setHoveredDevId] = useState<string | null>(null);

  // Device detail state
  const [blastRadius, setBlastRadius] = useState<string[]>([]);
  const [blastLoading, setBlastLoading] = useState(false);
  const [advisories, setAdvisories] = useState<any | null>(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);

  const devices = state?.devices || [];
  const accounts = state?.accounts || [];
  const incidents = state?.incidents || [];

  // Filter devices
  const filteredDevices = devices.filter((d: any) => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = zoneFilter === 'all' || d.zone === zoneFilter;
    return matchesSearch && matchesZone;
  });

  // Load device specifics on selection
  useEffect(() => {
    if (!selectedDevice) {
      setBlastRadius([]);
      setAdvisories(null);
      return;
    }

    // Load blast radius
    setBlastLoading(true);
    api(path(`/blast/${selectedDevice.id}`))
      .then(res => setBlastRadius(res.reachable || []))
      .catch(() => setBlastRadius([]))
      .finally(() => setBlastLoading(false));

    // Load advisories
    setAdvisoryLoading(true);
    api(path(`/integrations/advisories/${selectedDevice.id}`))
      .then(res => setAdvisories(res))
      .catch(() => setAdvisories(null))
      .finally(() => setAdvisoryLoading(false));
  }, [selectedDevice?.id, path]);

  return (
    <div className="phantom-smarthome">
      <header className="phantom-page-header">
        <div className="phantom-page-eyebrow">
          <Network size={13} />
          <span>HOUSEHOLD ASSET INVENTORY & TOPOLOGY</span>
        </div>
        <h1 className="phantom-page-title">Smart Home Devices & Topology</h1>
        <p className="phantom-page-subtitle">
          Verified device assets registered to your household. Inspect zones, firmware CPE metadata,
          network blast radii, and CVE advisories.
        </p>
      </header>

      {/* View Switcher and Filters */}
      <section className="phantom-card" style={{ padding: '16px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Search & Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px 12px',
              flex: 1
            }}>
              <Search size={15} color="var(--muted)" />
              <input
                type="text"
                placeholder="Search by device, vendor, or type..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: '12.5px',
                  width: '100%',
                  outline: 'none'
                }}
              />
            </div>

            <select
              value={zoneFilter}
              onChange={e => setZoneFilter(e.target.value)}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Zones ({devices.length})</option>
              <option value="iot">IoT Zone</option>
              <option value="main">Main Zone</option>
              <option value="work">Work Zone</option>
              <option value="guest">Guest Zone</option>
            </select>
          </div>

          {/* Toggle Grid vs Map */}
          <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setActiveTab('grid')}
              style={{
                padding: '7px 14px',
                background: activeTab === 'grid' ? 'var(--accent)' : 'var(--surface-raised)',
                color: activeTab === 'grid' ? 'var(--accent-ink)' : 'var(--muted)',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Inventory Cards ({devices.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              style={{
                padding: '7px 14px',
                background: activeTab === 'map' ? 'var(--accent)' : 'var(--surface-raised)',
                color: activeTab === 'map' ? 'var(--accent-ink)' : 'var(--muted)',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Interactive Topology Map
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      {activeTab === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredDevices.map((device: any) => {
            const isIsolated = device.isolated;
            const hasIncident = incidents.some((i: any) => i.alert?.node_id === device.id && i.status !== 'resolved');
            const isHovered = hoveredDevId === device.id;
            const isOtherHovered = hoveredDevId !== null && !isHovered;

            return (
              <article
                key={device.id}
                onClick={() => setSelectedDevice(device)}
                onMouseEnter={() => setHoveredDevId(device.id)}
                onMouseLeave={() => setHoveredDevId(null)}
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setSelectedDevice(device); }}
                className="phantom-card interactive-hover-card"
                style={{
                  marginBottom: 0,
                  cursor: 'pointer',
                  borderColor: isHovered ? 'var(--accent)' : hasIncident ? 'var(--danger)' : isIsolated ? 'var(--warning)' : 'var(--border)',
                  borderLeft: isHovered ? '3px solid var(--accent)' : undefined,
                  opacity: isOtherHovered ? 0.4 : 1,
                  transform: isHovered ? 'translateY(-3px)' : 'none',
                  transition: 'all 160ms ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'var(--surface-raised)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: hasIncident ? 'var(--danger)' : isHovered ? 'var(--accent)' : 'var(--text)'
                  }}>
                    <Cpu size={18} />
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {hasIncident && (
                      <span className="phantom-badge phantom-badge--red">Incident</span>
                    )}
                    <span className={`phantom-badge ${isIsolated ? 'phantom-badge--amber' : 'phantom-badge--green'}`}>
                      {isIsolated ? 'Contained' : `${device.zone} zone`}
                    </span>
                  </div>
                </div>

                <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>{device.name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
                  {device.vendor} · {device.type}
                </span>

                <div style={{
                  margin: '14px 0 0',
                  padding: '10px',
                  background: 'var(--surface-raised)',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-jb)'
                }}>
                  <span style={{ color: 'var(--muted)' }}>CPE:</span>
                  <span>
                    {device.product_cpe ? device.product_cpe.split(':')[4] : 'Not mapped'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-jb)' }}>
                  <span>{isHovered ? 'Click to inspect blast radius' : 'Inspect Blast & Advisories'}</span>
                  <ExternalLink size={12} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="network-panel" style={{ height: '700px' }}>
          <div className="panel-heading">
            <div>
              <span className="section-eyebrow">Topology Graph</span>
              <h2><Network size={18} /> Connected Household Map</h2>
            </div>
            <span className="panel-tag">Interactive Pan & Zoom</span>
          </div>
          <div className="network-panel__canvas">
            <HomeMap />
          </div>
        </section>
      )}

      {/* Device Details Flyout Drawer */}
      {selectedDevice && (
        <div className="phantom-drawer-overlay" onClick={() => setSelectedDevice(null)}>
          <aside
            className="phantom-drawer"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Device details drawer"
          >
            <div className="phantom-drawer__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={20} color="var(--accent)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{selectedDevice.name}</h3>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {selectedDevice.vendor} · {selectedDevice.type}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="phantom-icon-btn"
                onClick={() => setSelectedDevice(null)}
                aria-label="Close drawer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="phantom-drawer__content">
              {/* Status Banner */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: selectedDevice.isolated ? 'color-mix(in srgb, var(--warning) 12%, var(--surface))' : 'var(--surface-raised)',
                border: '1px solid var(--border)',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Security Status</span>
                <span className={`phantom-badge ${selectedDevice.isolated ? 'phantom-badge--amber' : 'phantom-badge--green'}`}>
                  {selectedDevice.isolated ? 'Network Contained' : 'Nominal / Uncontained'}
                </span>
              </div>

              {/* Technical Metadata */}
              <section style={{ marginBottom: '20px' }}>
                <span className="section-eyebrow">Hardware & Network Metadata</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Device ID:</span>
                    <code style={{ fontSize: '11px' }}>{selectedDevice.id}</code>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Network Zone:</span>
                    <strong style={{ textTransform: 'uppercase' }}>{selectedDevice.zone}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Firmware Version:</span>
                    <span>{selectedDevice.firmware_version || '1.0.0'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Trusted IP:</span>
                    <code style={{ fontSize: '11px' }}>{selectedDevice.trusted_ipv4 || 'Unpinned'}</code>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ color: 'var(--muted)' }}>Trusted MAC:</span>
                    <code style={{ fontSize: '11px' }}>{selectedDevice.trusted_mac || 'Unpinned'}</code>
                  </div>
                </div>
              </section>

              {/* Reachable Blast Radius */}
              <section style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="section-eyebrow">Compromise Blast Radius</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                    {blastLoading ? 'Calculating...' : `${blastRadius.length} reachable nodes`}
                  </span>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--surface-raised)', border: '1px solid var(--border)', marginTop: '8px' }}>
                  {blastRadius.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {blastRadius.map((nodeId, i) => {
                        const targetName = devices.find((d: any) => d.id === nodeId)?.name ||
                                          accounts.find((a: any) => a.id === nodeId)?.name ||
                                          nodeId;
                        return (
                          <span key={i} className="phantom-badge phantom-badge--amber" style={{ fontSize: '10.5px' }}>
                            {targetName}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      Isolated. No other internal nodes reachable from this device.
                    </span>
                  )}
                </div>
              </section>

              {/* NVD CVE Advisories */}
              <section style={{ marginBottom: '20px' }}>
                <span className="section-eyebrow">NIST NVD Vulnerability Advisories</span>
                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--surface-raised)', border: '1px solid var(--border)', marginTop: '8px' }}>
                  {advisoryLoading ? (
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Querying NIST NVD API...</span>
                  ) : advisories?.advisories?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {advisories.advisories.slice(0, 3).map((adv: any) => (
                        <div key={adv.id} style={{ fontSize: '11px' }}>
                          <a href={adv.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            {adv.id} <ExternalLink size={10} />
                          </a>
                          <p style={{ margin: '2px 0 0', color: 'var(--muted)', lineHeight: 1.3 }}>
                            {adv.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      {advisories?.reason || 'No CVE advisories matched for this exact product CPE and firmware version.'}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
