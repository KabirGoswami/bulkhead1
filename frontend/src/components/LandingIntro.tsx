import { useEffect, useId, useRef } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Camera, CircleDot, Fingerprint,
  LockKeyhole, Network, PlugZap, Radio, Shield, ShieldCheck,
  SlidersHorizontal, Thermometer,
} from 'lucide-react';
import '../styles/landing.css';

const features = [
  {
    number: '01',
    icon: Network,
    title: 'See the connections.',
    description: 'Explore devices, shared accounts, and the paths a compromise could take through your home.',
    label: 'Explore the home network',
    href: '#/network',
  },
  {
    number: '02',
    icon: ShieldCheck,
    title: 'Find the weak spots.',
    description: 'Review access health, understand each finding, and apply a fix to the simulated home.',
    label: 'Review access health',
    href: '#/health',
  },
  {
    number: '03',
    icon: Radio,
    title: 'Follow the response.',
    description: 'Watch simulated threats surface, inspect the explanation, and confirm a response when needed.',
    label: 'View security alerts',
    href: '#/alerts',
  },
];

export default function LandingIntro({ session }: { session: any }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const illustrationId = useId().replace(/:/g, '');


  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const revealElements = root.querySelectorAll<HTMLElement>('[data-landing-reveal]');
    let frame = 0;
    let observer: IntersectionObserver | undefined;

    const updateScroll = () => {
      frame = 0;
      const bounds = root.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -bounds.top / 700));
      root.style.setProperty('--landing-scroll', motionPreference.matches ? '0' : String(progress));
    };

    const scheduleScrollUpdate = () => {
      if (!frame && !motionPreference.matches) frame = window.requestAnimationFrame(updateScroll);
    };

    const configureMotion = () => {
      observer?.disconnect();
      root.dataset.motion = motionPreference.matches ? 'reduced' : 'enabled';

      if (motionPreference.matches || !('IntersectionObserver' in window)) {
        revealElements.forEach(element => element.classList.add('is-revealed'));
      } else {
        observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-revealed');
              observer?.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
        revealElements.forEach(element => observer?.observe(element));
      }
      updateScroll();
    };

    configureMotion();
    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
    motionPreference.addEventListener('change', configureMotion);

    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleScrollUpdate);
      window.removeEventListener('resize', scheduleScrollUpdate);
      motionPreference.removeEventListener('change', configureMotion);
    };
  }, []);

  return (
    <div className="landing-intro" ref={rootRef}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <div className="landing-eyebrow"><span /> Smart-home security / Simulation</div>
          <h1 id="landing-title" data-page-title tabIndex={-1}>One device.<br /><span>Not your<br className="landing-title-break" /> entire home.</span></h1>
          <p className="landing-hero__description">A single compromised device shouldn’t open every door. Explore how Bulkhead makes risk visible and contains a threat before it reaches the rest of the home.</p>
          <div className="landing-actions">
          {session.user ? (
            <a className="landing-button landing-button--primary" href="#/network">Access Dashboard <ArrowUpRight size={17} /></a>
          ) : (
            <a className="landing-button landing-button--primary" href="#/login">Log in <ArrowRight size={16} /></a>
          )}
          <a className="landing-button landing-button--secondary" href="#/simulation">Run a simulation <ArrowRight size={16} /></a>
        </div>
          <p className="landing-hero__note"><Shield size={13} /> A security sandbox. Virtual devices, simulated traffic.</p>
        </div>

        <figure className="landing-illustration">
          <div className="landing-scene" aria-hidden="true">
            <div className="landing-scene__glow" />
            <div className="landing-scene__label"><CircleDot size={11} /> The containment principle</div>
            <svg className="landing-network" viewBox="0 0 560 500" fill="none">
              <defs>
                <pattern id={`${illustrationId}-grid`} width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M28 0H0V28" stroke="var(--border)" strokeWidth="0.5" />
                </pattern>
                <radialGradient id={`${illustrationId}-fade`}>
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity=".09" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect x="8" y="18" width="544" height="464" fill={`url(#${illustrationId}-grid)`} opacity=".45" />
              <circle cx="285" cy="246" r="219" fill={`url(#${illustrationId}-fade)`} />
              <g className="landing-network__rings" stroke="var(--border)">
                <circle cx="285" cy="246" r="209" strokeDasharray="2 8" />
                <circle cx="285" cy="246" r="167" strokeWidth=".8" />
                <circle cx="285" cy="246" r="118" strokeDasharray="3 6" strokeWidth=".65" />
              </g>
              <path d="m202 234 83-68 83 68v101H202V234Z" stroke="var(--accent)" strokeOpacity=".12" strokeWidth="1.2" />
              <g stroke="var(--accent)" strokeOpacity=".4" strokeWidth="1.2">
                <path d="M285 246C345 246 329 113 424 113" />
                <path d="M285 246C358 246 350 323 448 323" />
                <path d="M285 246C224 246 242 370 130 370" />
                <path d="M285 246V435" />
              </g>
              <path d="M119 142C171 142 164 246 219 246" stroke="var(--warning)" strokeDasharray="4 6" strokeWidth="1.4" />
              <path d="M211 211a60 60 0 0 0 0 70" stroke="var(--warning)" strokeWidth="2" />
              <circle cx="359" cy="181" r="3" fill="var(--accent)" />
              <circle cx="368" cy="296" r="3" fill="var(--accent)" />
              <circle cx="225" cy="315" r="3" fill="var(--accent)" />
              <circle cx="285" cy="385" r="3" fill="var(--accent)" />
              <path d="M279 29h12M285 23v12M279 463h12M285 457v12M54 240h12M60 234v12M504 240h12M510 234v12" stroke="var(--muted)" strokeOpacity=".4" />
            </svg>
            <div className="landing-hub"><span><ShieldCheck size={28} strokeWidth={1.35} /></span><strong>Home boundary</strong><small>Limit the reach.</small></div>
            <div className="landing-device landing-device--plug"><span className="landing-device__icon"><PlugZap size={18} strokeWidth={1.5} /></span><div><strong>Smart plug</strong><small><i /> Compromised</small></div><span className="landing-device__index">01</span></div>
            <div className="landing-device landing-device--camera"><span className="landing-device__icon"><Camera size={18} strokeWidth={1.5} /></span><div><strong>Camera</strong><small>Connection intact</small></div><span className="landing-device__index">02</span></div>
            <div className="landing-device landing-device--lock"><span className="landing-device__icon"><LockKeyhole size={18} strokeWidth={1.5} /></span><div><strong>Smart lock</strong><small>Connection intact</small></div><span className="landing-device__index">03</span></div>
            <div className="landing-device landing-device--climate"><span className="landing-device__icon"><Thermometer size={18} strokeWidth={1.5} /></span><div><strong>Thermostat</strong><small>Connection intact</small></div><span className="landing-device__index">04</span></div>
            <div className="landing-device landing-device--account"><span className="landing-device__icon"><Fingerprint size={18} strokeWidth={1.5} /></span><div><strong>Home account</strong><small>Shared access</small></div></div>
            <div className="landing-containment"><Shield size={11} /> Contained at source</div>
          </div>
          <figcaption className="landing-illustration__caption"><span><i className="landing-legend-dot landing-legend-dot--warning" /> Compromised source</span><span><i className="landing-legend-dot" /> Unaffected connection</span><small>Illustrative network · Not live data</small></figcaption>
        </figure>
      </section>

      <div className="landing-divider"><span><ArrowDown size={12} /> Scroll to explore</span><span>Understand. Respond. Contain.</span></div>

      <section className="landing-features" aria-labelledby="landing-features-title">
        <div className="landing-features__heading" data-landing-reveal>
          <div><p className="landing-eyebrow">A clearer picture of security</p><h2 id="landing-features-title">Make the invisible<br /><span>visible.</span></h2></div>
          <p>From the first weak credential to the moment a threat is contained, follow the story across your connected home.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map(({ number, icon: Icon, title, description, label, href }, index) => (
            <a className="landing-feature-card" key={number} href={href} data-landing-reveal style={{ transitionDelay: `${index * 85}ms` }}>
              <div className="landing-feature-card__top"><span className="landing-feature-card__icon"><Icon size={25} strokeWidth={1.35} /></span><span className="landing-feature-card__number">/ {number}</span></div>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="landing-feature-card__link">{label}<ArrowUpRight size={16} /></span>
            </a>
          ))}
        </div>
        <div className="landing-closing" data-landing-reveal>
          <div><SlidersHorizontal size={19} strokeWidth={1.4} /><span>Different scenarios. One connected home.</span></div>
          <a href="#/simulation">Put containment to the test <ArrowRight size={15} /></a>
        </div>
      </section>
    </div>
  );
}
