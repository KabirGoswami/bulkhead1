import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, Handle, Position, Node, NodeProps, Edge, ReactFlowInstance, ReactFlowProvider, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import { Camera, Laptop, Lightbulb, Lock, Network, Plug, Radio, Router, ShieldCheck, Smartphone, Speaker, Target, Thermometer, X, type LucideIcon } from 'lucide-react';
import 'reactflow/dist/style.css';
import '../styles/home-map.css';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

interface NetworkNodeData {
  label: string;
  kind: 'device' | 'account';
  deviceType?: string;
  zone?: string;
  linkedCount?: number;
  status?: 'normal' | 'source' | 'reachable';
}

const deviceIcons: Record<string, LucideIcon> = {
  router: Router, hub: Radio, camera: Camera, lock: Lock, thermostat: Thermometer,
  speaker: Speaker, plug: Plug, bulb: Lightbulb, phone: Smartphone, laptop: Laptop,
};

function NetworkNode({ data }: NodeProps<NetworkNodeData>) {
  const Icon = data.kind === 'account' ? ShieldCheck : deviceIcons[data.deviceType || ''] || Network;
  return (
    <div className={`network-node-card network-node-card--${data.kind}`} data-status={data.status || 'normal'}>
      <Handle type="target" position={Position.Top} className="network-node-handle" />
      <span className="network-node-icon"><Icon size={20} strokeWidth={1.6} /></span>
      <span className="network-node-copy">
        <span className="network-node-name">{data.label}</span>
        <span className="network-node-meta">
          {data.kind === 'account' ? `${data.linkedCount} linked devices` : <><span>{data.deviceType}</span><span className="network-node-meta-dot" />{data.zone} zone</>}
        </span>
      </span>
      <Handle type="source" position={Position.Bottom} className="network-node-handle" />
    </div>
  );
}

const nodeTypes = { network: NetworkNode };

export default function HomeMap() {
  const [nodes, setNodes] = useNodesState<NetworkNodeData>([]);
  const [edges, setEdges] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [blastRadius, setBlastRadius] = useState<string[]>([]);
  const [flow, setFlow] = useState<ReactFlowInstance<NetworkNodeData> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchHomeData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/state`);
      const { devices, accounts } = response.data;
      const newNodes: Node<NetworkNodeData>[] = [];
      const newEdges: Edge[] = [];

      devices.forEach((device: any, index: number) => {
        newNodes.push({
          id: device.id,
          type: 'network',
          data: { label: device.name, kind: 'device', deviceType: device.type, zone: device.zone },
          position: { x: (index % 4) * 205, y: 140 + Math.floor(index / 4) * 120 },
        });
        // Preserve all network-zone connections, with a quieter visual weight.
        devices.forEach((other: any) => {
          if (device.id !== other.id && device.zone === other.zone) {
            newEdges.push({
              id: `edge-${device.id}-${other.id}`,
              source: device.id,
              target: other.id,
              type: 'smoothstep',
              animated: false,
              className: 'network-zone-edge',
              style: { stroke: 'var(--muted)', strokeWidth: 1, opacity: 0.3 },
            });
          }
        });
      });

      accounts.forEach((account: any, index: number) => {
        newNodes.push({
          id: account.id,
          type: 'network',
          data: { label: account.name, kind: 'account', linkedCount: account.linked_device_ids.length },
          position: { x: 100 + (index % 2) * 410, y: Math.floor(index / 2) * -105 },
        });
        account.linked_device_ids.forEach((deviceId: string) => {
          newEdges.push({
            id: `acc-edge-${account.id}-${deviceId}`,
            source: account.id,
            target: deviceId,
            type: 'smoothstep',
            label: 'linked',
            // Keep the marker ID stable while its inherited color follows the theme.
            markerEnd: { type: MarkerType.ArrowClosed, color: 'currentColor', width: 14, height: 14 },
            className: 'network-account-edge',
            style: { stroke: 'var(--accent)', strokeWidth: 1.3, opacity: 0.64 },
            labelStyle: { fill: 'var(--accent)', fontSize: 9, fontWeight: 500 },
            labelBgStyle: { fill: 'var(--map-bg)', fillOpacity: 0.94 },
            labelBgPadding: [5, 3],
            labelBgBorderRadius: 4,
          });
        });
      });
      setNodes(newNodes);
      setEdges(newEdges);
    } catch (error) {
      console.error('Failed to fetch home data', error);
    }
  }, []);

  useEffect(() => { fetchHomeData(); }, [fetchHomeData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!flow || !canvas || nodes.length === 0) return;

    // A viewport resize must reveal the same complete graph at every breakpoint.
    // Only resize or a changed node count resets the fit, preserving manual zoom.
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => flow.fitView({ padding: 0.13, minZoom: 0.2, maxZoom: 1 }));
    };
    const observer = new ResizeObserver(refit);
    observer.observe(canvas);
    refit();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [flow, nodes.length]);

  const onNodeClick = async (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    try {
      const response = await axios.get(`${API_BASE}/blast/${node.id}`);
      setBlastRadius(response.data.reachable);
    } catch (error) {
      console.error('Failed to fetch blast radius', error);
    }
  };

  useEffect(() => {
    setNodes(current => current.map(node => ({
      ...node,
      data: { ...node.data, status: node.id === selectedNode ? 'source' : blastRadius.includes(node.id) ? 'reachable' : 'normal' },
    })));
  }, [selectedNode, blastRadius, setNodes]);

  const selectedLabel = nodes.find(node => node.id === selectedNode)?.data.label;

  return (
    <ReactFlowProvider>
    <div className="map-workspace">
      <div className="map-toolbar">
        <div className="map-legend" aria-label="Network map legend">
          <span><i className="map-legend-device" /> Device</span>
          <span><i className="map-legend-account" /> Account</span>
          <span><i className="map-legend-link" /> Linked access</span>
        </div>
        <Controls position="top-right" fitViewOptions={{ padding: 0.13, minZoom: 0.2, maxZoom: 1 }} />
      </div>
      <div className="map-canvas" ref={canvasRef}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onInit={instance => setFlow(instance)}
        onNodesChange={() => {}} onEdgesChange={() => {}} onNodeClick={onNodeClick}
        fitView fitViewOptions={{ padding: 0.13, maxZoom: 1 }} minZoom={0.2} maxZoom={2}
      >
        <Background color="var(--border)" gap={22} size={1} />
      </ReactFlow>
      </div>
      {selectedNode && (
        <div className="map-analysis" aria-live="polite">
          <div className="map-analysis-header">
            <span className="map-analysis-title"><Target size={14} /> Node analysis</span>
            <button type="button" className="map-analysis-close" onClick={() => { setSelectedNode(null); setBlastRadius([]); }} aria-label="Clear Selection" title="Clear Selection"><X size={15} /></button>
          </div>
          <strong className="map-analysis-name">{selectedLabel}</strong>
          <span className="map-analysis-id">{selectedNode}</span>
          <div className="map-analysis-result"><span>Blast radius</span><strong>{blastRadius.length} nodes affected</strong></div>
          <div className="map-analysis-key"><span><i className="map-key-source" /> Selected source</span><span><i className="map-key-reachable" /> Reachable</span></div>
        </div>
      )}
    </div>
    </ReactFlowProvider>
  );
}
