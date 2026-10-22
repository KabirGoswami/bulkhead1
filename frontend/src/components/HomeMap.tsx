import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export default function HomeMap() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [blastRadius, setBlastRadius] = useState<string[]>([]);

  const fetchHomeData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/state`);
      const { devices, accounts } = response.data;

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      // Add Devices
      devices.forEach((d: any, index: number) => {
        newNodes.push({
          id: d.id,
          data: { label: `${d.name} (${d.type})` },
          position: { x: 100 + (index % 3) * 250, y: 50 + Math.floor(index / 3) * 150 },
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '8px',
            width: 150,
            textAlign: 'center' as any,
            fontSize: '12px'
          },
        });

        // Zone edges (Simplified: just connect to first device in same zone)
        devices.forEach((other: any) => {
          if (d.id !== other.id && d.zone === other.zone) {
            newEdges.push({
              id: `edge-${d.id}-${other.id}`,
              source: d.id,
              target: other.id,
              animated: false,
              style: { stroke: '#334155' },
            });
          }
        });
      });

      // Add Accounts
      accounts.forEach((a: any, index: number) => {
        const accId = a.id;
        newNodes.push({
          id: accId,
          data: { label: `Account: ${a.name}` },
          position: { x: 600, y: 100 + index * 100 },
          style: {
            background: '#334155',
            color: '#f1f5f9',
            border: '2px solid #3b82f6',
            borderRadius: '20px',
            width: 180,
            textAlign: 'center' as any,
            fontSize: '12px'
          },
        });

        // Account to Device edges
        a.linked_device_ids.forEach((devId: string) => {
          newEdges.push({
            id: `acc-edge-${accId}-${devId}`,
            source: accId,
            target: devId,
            label: 'linked',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
            style: { stroke: '#3b82f6', strokeWidth: 2 },
          });
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (error) {
      console.error("Failed to fetch home data", error);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  const onNodeClick = async (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    try {
      const response = await axios.get(`${API_BASE}/blast/${node.id}`);
      setBlastRadius(response.data.reachable);
    } catch (error) {
      console.error("Failed to fetch blast radius", error);
    }
  };

  // Update node styles based on blast radius
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const isSource = node.id === selectedNode;
        const isReachable = blastRadius.includes(node.id);

        return {
          ...node,
          style: {
            ...node.style,
            boxShadow: isSource ? '0 0 15px #ef4444' : isReachable ? '0 0 10px #f59e0b' : 'none',
            borderColor: isSource ? '#ef4444' : isReachable ? '#f59e0b' : (node.style as any).border,
            background: isSource ? '#7f1d1d' : isReachable ? '#78350f' : (node.style as any).background,
          }
        };
      })
    );
  }, [selectedNode, blastRadius, setNodes]);

  return (
    <div className="h-full w-full bg-dark-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={() => {}} // Handled by useNodesState internally via custom setNodes
        onEdgesChange={() => {}}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background color="#334155" gap={20} />
        <Controls />
      </ReactFlow>

      {selectedNode && (
        <div className="absolute bottom-4 left-4 p-4 bg-dark-card border border-slate-700 rounded-lg shadow-xl max-w-xs">
          <h4 className="text-sm font-bold text-white mb-1">Node Analysis</h4>
          <p className="text-xs text-slate-400 mb-2">Analyzing impact of compromise for: <span className="text-accent-blue">{selectedNode}</span></p>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500">Blast Radius:</span>
            <span className="text-warn-amber font-bold">{blastRadius.length} nodes affected</span>
          </div>
          <button
            onClick={() => { setSelectedNode(null); setBlastRadius([]); }}
            className="mt-3 w-full py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}
