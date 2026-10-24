import { Camera, LockKeyhole, ShieldCheck, ShieldOff, UnlockKeyhole } from 'lucide-react'
export function HomeScene({ revealed = false }: { revealed?: boolean }) {
  const color = revealed ? '#ff9470' : '#a0bbb2'
  return <div className={`home-scene ${revealed ? 'is-revealed' : ''}`}>
    <div className="scene-verdict">{revealed ? 'REALITY: COMPROMISED' : 'REPORTED: SECURE'}</div>
    <svg viewBox="0 0 1000 650" className="house" fill="none" aria-hidden="true">
      <defs><pattern id={revealed ? 'grid-r' : 'grid-s'} width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" stroke="#9dafa5" strokeOpacity=".065" /></pattern></defs>
      <path d="M75 420 495 190 943 420 520 653Z" fill={`url(#${revealed ? 'grid-r' : 'grid-s'})`} />
      <g stroke="#3c4844" strokeWidth="1"><path d="M100 431 510 651M150 404 560 624M200 377 610 597M250 350 660 570M300 323 710 543M350 296 760 516M400 269 810 489M450 242 860 462M500 215 910 435"/><path d="m110 445 420-230m-365 260 420-230m-365 260 420-230m-365 260 420-230m-365 260 420-230m-365 260 420-230m-365 260 420-230"/></g>
      <path d="m200 380 0-200 300-164 300 164v200L500 546Z" fill={revealed ? '#321811' : '#101917'} stroke={revealed ? '#bc6448' : '#62736a'} strokeWidth="1.5"/>
      <path d="M200 180 500 345 800 180 500 16Z" fill={revealed ? '#492219' : '#1b2621'} stroke={revealed ? '#d37b56' : '#7b897d'} strokeWidth="1.5"/>
      <path d="M500 345v201M200 180v200l300 166 300-166V180" stroke={revealed ? '#f0a478' : '#a0ac95'} strokeWidth="2"/>
      <path d="m200 380 300-164 300 164-300 166Z" fill={revealed ? '#783723' : '#26332b'} stroke={revealed ? '#ed9669' : '#758572'}/>
      <path d="M200 180 500 16v200L200 380Z" fill={revealed ? '#643122' : '#263129'} fillOpacity=".85" stroke={revealed ? '#db835d' : '#6a7b69'}/>
      <path d="M500 16 800 180v200L500 216Z" fill={revealed ? '#4c241b' : '#1c2822'} stroke={revealed ? '#db835d' : '#6a7b69'}/>
      <path d="m350 99 0 200 300 164v-200M350 299l150-83M650 263l150-83" stroke={revealed ? '#ef9b71' : '#778972'} strokeWidth="4"/>
      <path d="m225 190 95-52v112l-95 52Z" fill={revealed ? '#29130f' : '#101b18'} stroke={revealed ? '#f4a378' : '#8a9a82'}/><path d="m272 165 0 111M225 245l95-52" stroke={revealed ? '#cc7251' : '#5f7568'}/>
      <path d="m684 154 87 48v100l-87-48Z" fill={revealed ? '#301811' : '#12201c'} stroke={revealed ? '#e58c63' : '#7c8e7b'}/><path d="m727 178 0 100m-43-74 87 48" stroke={revealed ? '#cc7251' : '#5f7568'}/>
      <path d="m395 362 88-48 98 54-88 48Z" fill={revealed ? '#a65a37' : '#707765'} stroke={revealed ? '#edac79' : '#a2a18b'}/><path d="M395 362v32l98 54v-32m0 32 88-48v-32" fill={revealed ? '#6c3524' : '#404d3e'} stroke={revealed ? '#b96e4c' : '#7e8c72'}/>
      <path d="m552 300 76-41 64 35-77 42Z" fill={revealed ? '#a85e37' : '#59664f'} stroke={revealed ? '#f0a675' : '#929b80'}/><path d="M552 300v42l63 35v-41m0 41 77-42v-41" fill={revealed ? '#713720' : '#394937'} stroke={revealed ? '#dc8b5c' : '#7d8e70'}/>
      <path d="m565 283 62-34 62 34-62 34Z" fill={revealed ? '#d0884d' : '#788166'}/><path d="m568 284 0 20 59 33 59-33v-20" stroke={revealed ? '#ffd09c' : '#9ca38a'}/>
      <path d="m253 326 62-34 52 28-62 34Z" fill={revealed ? '#b36539' : '#6d775e'}/><path d="M253 326v25l52 29v-26m0 26 62-34v-26" fill={revealed ? '#7b3a25' : '#45533d'} stroke={revealed ? '#e39667' : '#7d8b6a'}/>
      <path d="m390 186 42-23 36 20-42 23Z" fill={revealed ? '#d48d5a' : '#839279'}/><path d="M390 186v45l36 20v-45m0 45 42-23v-45" fill={revealed ? '#8c432b' : '#455d46'} stroke={revealed ? '#ffb080' : '#8a9d7d'}/>
      {revealed && <>
        <g fill="#ff6d36" fillOpacity=".2" stroke="#ff925d" strokeWidth="1.5">
          <path d="m200 380 150-81 150 82-150 82Z"/>
          <path d="m500 216 150 82 150-82v164l-150 83-150-82Z"/>
        </g>
        <path d="M530 453v-94l51-28v94Z" fill="#190b08" stroke="#ffae7e" strokeWidth="2"/>
      </>}
      <path d={revealed ? 'M530 453v-94l-55-4v94Z' : 'M530 453v-94l51-28v94Z'} fill={revealed ? '#b85530' : '#33483a'} stroke={color} strokeWidth="2"/>
      <path d="m537 401 4-2" stroke={color} strokeWidth="3"/>
      <path d="M200 180 500 345 800 180" stroke={revealed ? '#ed9a72' : '#9cad92'} strokeWidth="2" strokeDasharray="5 6" opacity=".45"/>
      <g stroke={color} opacity=".6" strokeDasharray="3 6"><path d="M545 426v78l140 76"/><path d="M294 225 165 155H92"/><path d="M670 237 834 148h65"/></g>
      <g fill={color}><circle cx="545" cy="426" r="4"/><circle cx="294" cy="225" r="4"/><circle cx="670" cy="237" r="4"/></g>
      {revealed && <g>
        <g stroke="#ffa06d" strokeWidth="2" strokeDasharray="7 5" fill="none">
          <path d="M294 225 430 298 670 237 857 339 876 458"/>
          <path d="M545 426 430 298 294 225 125 320"/>
        </g>
        <g fill="#ffb181" stroke="#522416" strokeWidth="3">
          <circle cx="430" cy="298" r="7"/><circle cx="857" cy="339" r="7"/>
          <circle cx="876" cy="458" r="8"/><circle cx="125" cy="320" r="8"/>
        </g>
        <g stroke="#ffd2ac" strokeWidth="3"><path d="m281 210 26 30m-27-15 29 0M658 223l24 26m-24 0 24-26"/></g>
        <g fill="#ffc09b" fontFamily="monospace" fontSize="11" letterSpacing="1">
          <text x="701" y="491">UNTRUSTED EGRESS</text>
          <text x="701" y="509" fontSize="9">203.0.113.42 : 8443 · SIMULATED</text>
        </g>
      </g>}
    </svg>
    <div className="scene-label camera-label"><Camera size={15}/><span>LIVING ROOM CAMERA<strong>{revealed ? 'Feed frozen · 02:06' : 'Live feed active'}</strong></span><i/></div>
    <div className="scene-label alarm-label">{revealed ? <ShieldOff size={15}/> : <ShieldCheck size={15}/>}<span>SECURITY SYSTEM<strong>{revealed ? 'Alarm disabled' : 'Armed · Away mode'}</strong></span><i/></div>
    <div className="scene-label door-label">{revealed ? <UnlockKeyhole size={15}/> : <LockKeyhole size={15}/>}<span>FRONT DOOR<strong>{revealed ? 'Door open · 4 min' : 'Locked & secured'}</strong></span><i/></div>
  </div>
}
