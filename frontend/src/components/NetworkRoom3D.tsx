import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useBulkhead } from '../lib/session';
import { api, errorText } from '../lib/api';
import { Target, X } from 'lucide-react';

/* ───── helpers ───── */
const DEVICE_COLORS: Record<string, string> = {
  router: '#b9f574', hub: '#87dff0', camera: '#ff9b94', lock: '#edc478',
  thermostat: '#d9a8fa', speaker: '#9ab4ff', plug: '#ffa1ad', bulb: '#edcc96',
  phone: '#8bbcec', laptop: '#abbdff',
};

const DEVICE_SHAPES: Record<string, 'box' | 'sphere' | 'cylinder' | 'octahedron'> = {
  router: 'octahedron', hub: 'octahedron', camera: 'box', lock: 'cylinder',
  thermostat: 'sphere', speaker: 'cylinder', plug: 'box', bulb: 'sphere',
  phone: 'box', laptop: 'box',
};

function getColor(type?: string): string {
  return type ? (DEVICE_COLORS[type] || '#b9f574') : '#9ab4ff';
}
function getShape(type?: string): 'box' | 'sphere' | 'cylinder' | 'octahedron' {
  return type ? (DEVICE_SHAPES[type] || 'box') : 'sphere';
}

/* ────────────────────── Animated grid floor ────────────────────── */
function GridFloor() {
  const gridRef = useRef<THREE.Group>(null!);

  return (
    <group ref={gridRef}>
      {/* Main grid */}
      <gridHelper args={[40, 40, '#293235', '#1a2225']} position={[0, -0.01, 0]} />
      {/* Accent ring on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[8, 8.08, 64]} />
        <meshBasicMaterial color="#b9f574" transparent opacity={0.15} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[12, 12.06, 64]} />
        <meshBasicMaterial color="#87dff0" transparent opacity={0.08} />
      </mesh>
      {/* Reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0d1215" metalness={0.8} roughness={0.3} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/* ────────────────────── Ambient particles ────────────────────── */
function AmbientParticles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 15 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 0.15;
    ref.current.rotation.y = t * 0.08;
    const posArr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(t + i * 0.5) * 0.002;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#b9f574" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

/* ────────────────────── Glowing edge ────────────────────── */
function GlowEdge({ start, end, color = '#b9f574', opacity = 0.3, isBlast = false }: {
  start: THREE.Vector3; end: THREE.Vector3; color?: string; opacity?: number; isBlast?: boolean;
}) {
  const ref = useRef<THREE.Line>(null!);
  const curve = useMemo(() => {
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    mid.y += 1.2;
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [start, end]);
  const points = useMemo(() => curve.getPoints(32), [curve]);

  useFrame(({ clock }) => {
    if (ref.current && isBlast) {
      const mat = ref.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.3 + Math.sin(clock.getElapsedTime() * 3) * 0.2;
    }
  });

  return (
    <line ref={ref as any}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  );
}

/* ────────────────────── Device node ────────────────────── */
function DeviceNode({ position, name, type, kind, zone, status, onClick }: {
  position: [number, number, number]; name: string; type?: string;
  kind: 'device' | 'account'; zone?: string; status: 'normal' | 'source' | 'reachable';
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const color = kind === 'account' ? '#9ab4ff' : getColor(type);
  const shape = kind === 'account' ? 'sphere' as const : getShape(type);

  const statusColor = status === 'source' ? '#fa817b' : status === 'reachable' ? '#edc478' : color;
  const glowIntensity = status === 'source' ? 2.5 : status === 'reachable' ? 1.8 : hovered ? 1.4 : 0.8;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.3;
    if (status === 'source') {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    } else if (status === 'reachable') {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 3 + 1) * 0.05);
    }
  });

  const { gl } = useThree();
  const handlePointerOver = useCallback(() => {
    setHovered(true);
    gl.domElement.style.cursor = 'pointer';
  }, [gl]);
  const handlePointerOut = useCallback(() => {
    setHovered(false);
    gl.domElement.style.cursor = 'grab';
  }, [gl]);

  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4} floatingRange={[-0.1, 0.1]}>
      <group position={position}>
        {/* Glow ring on ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -position[1] + 0.02, 0]}>
          <ringGeometry args={[0.3, 0.5, 32]} />
          <meshBasicMaterial color={statusColor} transparent opacity={status !== 'normal' ? 0.35 : 0.12} />
        </mesh>
        {/* Vertical beam to ground */}
        <mesh position={[0, -position[1] / 2, 0]}>
          <cylinderGeometry args={[0.015, 0.015, position[1], 6]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.15} />
        </mesh>

        {/* Main shape */}
        <mesh
          ref={meshRef}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          castShadow
        >
          {shape === 'box' && <boxGeometry args={[0.7, 0.7, 0.7]} />}
          {shape === 'sphere' && <sphereGeometry args={[0.4, 24, 24]} />}
          {shape === 'cylinder' && <cylinderGeometry args={[0.35, 0.35, 0.65, 16]} />}
          {shape === 'octahedron' && <octahedronGeometry args={[0.45]} />}
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={glowIntensity}
            metalness={0.6}
            roughness={0.2}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Outer glow shell */}
        <mesh scale={1.35}>
          {shape === 'box' && <boxGeometry args={[0.7, 0.7, 0.7]} />}
          {shape === 'sphere' && <sphereGeometry args={[0.4, 16, 16]} />}
          {shape === 'cylinder' && <cylinderGeometry args={[0.35, 0.35, 0.65, 12]} />}
          {shape === 'octahedron' && <octahedronGeometry args={[0.45]} />}
          <meshBasicMaterial color={statusColor} transparent opacity={0.06} side={THREE.BackSide} />
        </mesh>

        {/* Label */}
        <Text
          position={[0, -0.75, 0]}
          fontSize={0.24}
          color="#eef2ed"
          anchorX="center"
          anchorY="top"
          font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
          maxWidth={3}
          outlineWidth={0.015}
          outlineColor="#0b0e11"
        >
          {name}
        </Text>
        <Text
          position={[0, -1.02, 0]}
          fontSize={0.16}
          color="#8e9c9a"
          anchorX="center"
          anchorY="top"
          font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
          maxWidth={3}
          outlineWidth={0.01}
          outlineColor="#0b0e11"
        >
          {kind === 'account' ? 'Account' : `${type || 'device'} · ${zone || ''}`}
        </Text>
      </group>
    </Float>
  );
}

/* ────────────────────── Room walls ────────────────────── */
function RoomWalls() {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#121719', metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  }), []);

  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 6, -15]} material={wallMat}>
        <planeGeometry args={[40, 12]} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-20, 6, 0]} rotation={[0, Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[30, 12]} />
      </mesh>
      {/* Right wall */}
      <mesh position={[20, 6, 0]} rotation={[0, -Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[30, 12]} />
      </mesh>
      {/* Ceiling subtle glow */}
      <mesh position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial color="#0d1215" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Wall edge light strips */}
      <mesh position={[0, 0.05, -14.95]}>
        <boxGeometry args={[39, 0.06, 0.06]} />
        <meshBasicMaterial color="#b9f574" transparent opacity={0.2} />
      </mesh>
      <mesh position={[-19.95, 0.05, 0]}>
        <boxGeometry args={[0.06, 0.06, 29]} />
        <meshBasicMaterial color="#87dff0" transparent opacity={0.15} />
      </mesh>
      <mesh position={[19.95, 0.05, 0]}>
        <boxGeometry args={[0.06, 0.06, 29]} />
        <meshBasicMaterial color="#87dff0" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

/* ────────────────────── Scene content ────────────────────── */
interface SceneProps {
  devices: any[]; accounts: any[]; edges: any[];
  selectedNode: string | null; blastRadius: string[];
  onSelectNode: (id: string) => void;
}

function Scene({ devices, accounts, edges, selectedNode, blastRadius, onSelectNode }: SceneProps) {
  const nodePositions = useMemo(() => {
    const positions: Record<string, [number, number, number]> = {};
    const total = devices.length + accounts.length;
    const radius = Math.max(5, Math.sqrt(total) * 2.2);

    // Place devices in a spiral pattern on the floor level
    devices.forEach((d: any, i: number) => {
      const angle = (i / Math.max(devices.length, 1)) * Math.PI * 2 + Math.PI / 4;
      const r = radius * (0.4 + (i % 3) * 0.25);
      const y = 1.5 + (i % 4) * 0.8;
      positions[d.id] = [Math.cos(angle) * r, y, Math.sin(angle) * r];
    });

    // Place accounts higher and in center-ish area
    accounts.forEach((a: any, i: number) => {
      const angle = (i / Math.max(accounts.length, 1)) * Math.PI * 2;
      const r = radius * 0.2;
      positions[a.id] = [Math.cos(angle) * r, 4.5 + i * 0.6, Math.sin(angle) * r];
    });

    return positions;
  }, [devices, accounts]);

  const getStatus = useCallback((id: string): 'normal' | 'source' | 'reachable' => {
    if (id === selectedNode) return 'source';
    if (blastRadius.includes(id)) return 'reachable';
    return 'normal';
  }, [selectedNode, blastRadius]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 15, 5]} intensity={0.4} castShadow />
      <pointLight position={[0, 8, 0]} intensity={0.6} color="#b9f574" distance={25} decay={2} />
      <pointLight position={[-8, 5, -8]} intensity={0.3} color="#87dff0" distance={20} decay={2} />
      <pointLight position={[8, 5, 8]} intensity={0.3} color="#9ab4ff" distance={20} decay={2} />

      <RoomWalls />
      <GridFloor />
      <AmbientParticles />

      {/* Device nodes */}
      {devices.map((device: any) => (
        <DeviceNode
          key={device.id}
          position={nodePositions[device.id] || [0, 2, 0]}
          name={device.name}
          type={device.type}
          kind="device"
          zone={`${device.zone}${device.isolated ? ' · contained' : ''}`}
          status={getStatus(device.id)}
          onClick={() => onSelectNode(device.id)}
        />
      ))}

      {/* Account nodes */}
      {accounts.map((account: any) => (
        <DeviceNode
          key={account.id}
          position={nodePositions[account.id] || [0, 4, 0]}
          name={`${account.name}${account.access_revoked ? ' · revoked' : ''}`}
          kind="account"
          status={getStatus(account.id)}
          onClick={() => onSelectNode(account.id)}
        />
      ))}

      {/* Edges */}
      {edges.map((edge: any, i: number) => {
        const startPos = nodePositions[edge.source];
        const endPos = nodePositions[edge.target];
        if (!startPos || !endPos) return null;
        const isBlastEdge = blastRadius.includes(edge.source) || blastRadius.includes(edge.target);
        return (
          <GlowEdge
            key={`${edge.source}-${edge.target}-${i}`}
            start={new THREE.Vector3(...startPos)}
            end={new THREE.Vector3(...endPos)}
            color={edge.kind === 'account' ? '#9ab4ff' : isBlastEdge ? '#edc478' : '#b9f574'}
            opacity={isBlastEdge ? 0.5 : 0.2}
            isBlast={isBlastEdge}
          />
        );
      })}

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={4}
        maxDistance={25}
        enableDamping
        dampingFactor={0.05}
        target={[0, 2, 0]}
      />
    </>
  );
}

/* ────────────────────── Main export ────────────────────── */
export default function NetworkRoom3D() {
  const { state, path, error: stateError } = useBulkhead();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [blastRadius, setBlastRadius] = useState<string[]>([]);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const devices = state?.devices ?? [];
  const accounts = state?.accounts ?? [];
  const edges = state?.edges ?? [];

  useEffect(() => {
    setBlastRadius([]); setAnalysisError('');
    if (!selectedNode) return;
    const controller = new AbortController();
    setAnalysisLoading(true);
    api(path(`/blast/${selectedNode}`), { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setBlastRadius(response.reachable); })
      .catch(err => { if (!controller.signal.aborted) setAnalysisError(errorText(err)); })
      .finally(() => { if (!controller.signal.aborted) setAnalysisLoading(false); });
    return () => controller.abort();
  }, [selectedNode, path, state?.sequence]);

  const selectedLabel = [...devices, ...accounts].find((n: any) => n.id === selectedNode)?.name;

  return (
    <div className="room3d-workspace">
      {stateError && <p role="alert" className="app-error room3d-error">3D view unavailable: {stateError}</p>}
      {!state && !stateError && <p role="status" className="room3d-loading">Loading 3D room…</p>}

      <div className="room3d-canvas">
        <Canvas
          shadows
          camera={{ position: [12, 8, 12], fov: 50, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => { gl.setClearColor('#0b0e11'); gl.domElement.style.cursor = 'grab'; }}
        >
          <Scene
            devices={devices}
            accounts={accounts}
            edges={edges}
            selectedNode={selectedNode}
            blastRadius={blastRadius}
            onSelectNode={setSelectedNode}
          />
        </Canvas>

        {/* HUD overlay */}
        <div className="room3d-hud">
          <div className="room3d-hud__legend">
            <span><i className="room3d-legend-device" /> Device</span>
            <span><i className="room3d-legend-account" /> Account</span>
            <span><i className="room3d-legend-edge" /> Connection</span>
          </div>
          <span className="room3d-hud__hint">Orbit · Scroll to zoom · Click a node</span>
        </div>
      </div>

      {selectedNode && (
        <div className="room3d-analysis" aria-live="polite">
          <div className="room3d-analysis__header">
            <span className="room3d-analysis__title"><Target size={14} /> Node analysis</span>
            <button type="button" className="room3d-analysis__close" onClick={() => { setSelectedNode(null); setBlastRadius([]); }} aria-label="Clear Selection" title="Clear Selection"><X size={15} /></button>
          </div>
          <strong className="room3d-analysis__name">{selectedLabel}</strong>
          <span className="room3d-analysis__id">{selectedNode}</span>
          <div className="room3d-analysis__result">
            <span>Blast radius</span>
            <strong>{analysisLoading ? "Loading…" : analysisError ? "Unavailable" : `${blastRadius.length} nodes affected`}</strong>
          </div>
          {analysisError && <p role="alert" className="app-error">{analysisError}</p>}
          <div className="room3d-analysis__key">
            <span><i className="room3d-key-source" /> Selected source</span>
            <span><i className="room3d-key-reachable" /> Reachable</span>
          </div>
        </div>
      )}
    </div>
  );
}
