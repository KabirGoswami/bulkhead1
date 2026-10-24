import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Shield, ShieldCheck,
  Radio, Cpu, KeyRound, Terminal, Zap, Lock,
  Fingerprint, Network, ChevronDown
} from 'lucide-react';
import { useSession } from '../lib/session';
import { post, api } from '../lib/api';

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_132544_b6ef0174-ed95-45ad-9a2f-ccb8acfbdce8.mp4';

export default function LandingIntro() {
  const session = useSession();
  const [devEnabled, setDevEnabled] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    api('/auth/options')
      .then(res => setDevEnabled(Boolean(res.dev_enabled)))
      .catch(() => {});
  }, []);

  // Video sync
  useEffect(() => {
    const v1 = videoRef1.current;
    const v2 = videoRef2.current;
    if (!v1 || !v2) return;

    const onTimeUpdate = () => {
      if (Math.abs(v1.currentTime - v2.currentTime) > 0.12) {
        v2.currentTime = v1.currentTime;
      }
    };
    v1.addEventListener('timeupdate', onTimeUpdate);
    return () => v1.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  const handleEnterCommandCenter = async () => {
    if (session.user && session.home) {
      window.location.hash = '#/overview';
      return;
    }

    if (devEnabled) {
      setLoggingIn(true);
      try {
        await post('/auth/dev-login', {
          email: 'dev@bulkhead.local',
          role: 'Owner',
          household_name: 'Dev Household'
        });
        await session.refresh();
        window.location.hash = '#/overview';
      } catch {
        window.location.hash = '#/login';
      } finally {
        setLoggingIn(false);
      }
    } else {
      window.location.hash = '#/login';
    }
  };

  const scrollToFeatures = () => {
    const target = document.getElementById('phantom-features-anchor');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="phantom-cinematic-landing">
      {/* Cinematic Hero Stage */}
      <section className="phantom-hero-stage">
        {/* Graded Dual Video Atmospheric Backgrounds */}
        <div className="phantom-hero-video-bg">
          <video
            ref={videoRef1}
            src={VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onLoadedData={() => setVideoLoaded(true)}
            style={{ filter: 'url(#grade)' }}
          />
          <video
            ref={videoRef2}
            src={VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="phantom-hero-video-pass2"
            style={{ filter: 'url(#grade2)' }}
          />
          <div className="phantom-hero-scrim" />
        </div>

        {/* Foreground Hero Content */}
        <div className="phantom-hero-inner">
          <div className="phantom-hero-left">
            {/* Technical Eyebrow */}
            <div className="phantom-hero-eyebrow">
              <span className="hero-status-ping" />
              <span>PHANTOM / REALITY-AWARE SECURITY</span>
            </div>

            {/* Headline */}
            <h1 className="phantom-hero-headline">
              <span className="hero-line">YOUR HOME.</span>
              <span className="hero-line">YOUR REALITY.</span>
              <span className="hero-line hero-line--highlight">YOUR CONTROL.</span>
            </h1>

            {/* Supporting Description */}
            <p className="phantom-hero-desc">
              Smart homes can be deceived. PHANTOM checks physical multi-sensor evidence before trusting what your connected devices report.
            </p>

            {/* CTAs */}
            <div className="phantom-hero-actions">
              <button
                type="button"
                className="phantom-hero-btn-primary"
                onClick={handleEnterCommandCenter}
                disabled={loggingIn}
              >
                <span>{loggingIn ? 'ACCESSING CENTER...' : 'ENTER COMMAND CENTER'}</span>
                <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                  <path d="M0 9H20.1" stroke="#FFF" strokeWidth="2" />
                  <path d="M12.1 1L20.1 9L12.1 17" stroke="#FFF" strokeWidth="2" />
                </svg>
              </button>

              <button
                type="button"
                className="phantom-hero-btn-secondary"
                onClick={scrollToFeatures}
              >
                <span>EXPLORE PHANTOM</span>
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Technical Footnote */}
            <div className="phantom-hero-tech-note">
              <Terminal size={14} color="var(--accent)" />
              <span>CRYPTOGRAPHIC IDENTITY · SENSOR CORRELATION · ACTUATOR SAFEGUARDS</span>
            </div>
          </div>

          {/* Right Floating Reality Verification Radar */}
          <div className="phantom-hero-right">
            <div className="phantom-telemetry-badge">
              <div className="telemetry-badge-header">
                <span className="telemetry-radar-dot" />
                <strong>TELEMETRY VERIFICATION ENGINE</strong>
              </div>
              <div className="telemetry-stats-rows">
                <div className="telemetry-row">
                  <span className="t-key">SIGNAL INGRESS</span>
                  <span className="t-val" style={{ color: 'var(--text)' }}>MONITORED</span>
                </div>
                <div className="telemetry-row">
                  <span className="t-key">EVIDENCE ENGINE</span>
                  <span className="t-val" style={{ color: 'var(--verified)' }}>CORROBORATING</span>
                </div>
                <div className="telemetry-row">
                  <span className="t-key">VIRTUAL ACTUATORS</span>
                  <span className="t-val" style={{ color: 'var(--accent)' }}>PROTECTED</span>
                </div>
                <div className="telemetry-row">
                  <span className="t-key">LATERAL MOVEMENT</span>
                  <span className="t-val" style={{ color: 'var(--verified)' }}>CONTAINED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Architecture Cards */}
      <section id="phantom-features-anchor" className="phantom-features-section">
        <div className="phantom-features-header">
          <span className="phantom-nav-section-label">01 / ARCHITECTURE</span>
          <h2 style={{ fontSize: '28px', letterSpacing: '-1px', margin: '6px 0 10px', textTransform: 'uppercase' }}>
            SECURITY BUILT INTO EVERY SYSTEM LAYER
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '640px' }}>
            From single-sensor contact events to critical motorized locks, Bulkhead insulates your home against spoofed telemetry and compromised credentials.
          </p>
        </div>

        <div className="phantom-features-grid">
          <div className="phantom-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className="phantom-badge phantom-badge--red" style={{ marginBottom: '12px', display: 'inline-block' }}>
                01 / INGRESS
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Identity & Freshness</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
                Every device telemetry message is cryptographically validated. Nonces prevent replay attacks and detect spoofed firmware.
              </p>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', fontFamily: 'var(--font-jb)', color: 'var(--accent)' }}>
              HMAC AUTHENTICATED · MONOTONIC
            </div>
          </div>

          <div className="phantom-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className="phantom-badge phantom-badge--red" style={{ marginBottom: '12px', display: 'inline-block' }}>
                02 / CORRELATION
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Multi-Sensor Reality</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
                A compromised door sensor claiming "door open" is cross-checked against PIR motion, deadbolt state, and vibration sensors.
              </p>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', fontFamily: 'var(--font-jb)', color: 'var(--verified)' }}>
              CROSS-CORRELATED TRUTH
            </div>
          </div>

          <div className="phantom-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className="phantom-badge phantom-badge--red" style={{ marginBottom: '12px', display: 'inline-block' }}>
                03 / CONTAINMENT
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Actuator Protection</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
                Suspicious virtual unlock requests are held rather than blindly executed, requiring explicit household owner authorization.
              </p>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', fontFamily: 'var(--font-jb)', color: 'var(--accent)' }}>
              SAFEGUARDED ACTUATION
            </div>
          </div>
        </div>

        {/* Quick Launch Banner */}
        <div className="phantom-card" style={{ marginTop: '32px', padding: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', background: 'var(--surface-raised)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Zap size={16} color="var(--accent)" />
              <strong style={{ fontSize: '15px' }}>Ready to inspect the live command center?</strong>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
              Access the live threat monitor, smart home topology, and attack simulation stage.
            </p>
          </div>
          <button
            type="button"
            className="phantom-hero-btn-primary"
            onClick={handleEnterCommandCenter}
            disabled={loggingIn}
            style={{ padding: '14px 24px', fontSize: '14px' }}
          >
            <span>{loggingIn ? 'STARTING...' : 'ENTER COMMAND CENTER'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
