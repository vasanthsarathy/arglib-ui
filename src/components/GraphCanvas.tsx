import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  MarkerType,
  Position,
  ReactFlowInstance,
  applyNodeChanges,
  applyEdgeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  Handle,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

type GraphCanvasProps = {
  elements: Array<{ data?: Record<string, unknown> }>;
  highlightNodes?: string[];
  onSelect: (selection: {
    type: "node" | "edge";
    id: string;
    data: Record<string, unknown>;
  } | null) => void;
  onAddEdge: (src: string, dst: string) => void;
  onAddNode: () => void;
};

const ClaimNode = ({
  data,
}: {
  data: {
    label: string;
    id: string;
    scoreBadge?:
      | { label: string; color: string; bgColor: string; borderColor: string }
      | null;
  };
}) => {
  return (
    <div className="rf-node">
      <div className="rf-node-id">{data.id}</div>
      {data.scoreBadge && (
        <div
          className="rf-node-score"
          style={{
            color: data.scoreBadge.color,
            background: data.scoreBadge.bgColor,
            borderColor: data.scoreBadge.borderColor,
          }}
        >
          {data.scoreBadge.label}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="rf-handle"
      />
      <div className="rf-label">{data.label}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="rf-handle"
      />
    </div>
  );
};

export default function GraphCanvas({
  elements,
  highlightNodes = [],
  onSelect,
  onAddEdge,
  onAddNode,
}: GraphCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [panEnabled, setPanEnabled] = useState(true);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const nodeTypes = useMemo(() => ({ claim: ClaimNode }), []);

  const highlightSet = useMemo(
    () => new Set(highlightNodes),
    [highlightNodes],
  );

  useEffect(() => {
    const positionMap = new Map(nodes.map((node) => [node.id, node.position]));
    const nextNodes: Node[] = [];
    const nextEdges: Edge[] = [];
    let index = 0;

    for (const element of elements) {
      const data = element.data ?? {};
      const id = String(data.id ?? "");
      const isEdge = "source" in data && "target" in data;
      if (isEdge) {
        const kind = String(data.kind ?? data.label ?? "support");
        const color = kind === "attack" ? "#b00020" : "#188038";
        nextEdges.push({
          id,
          source: String(data.source),
          target: String(data.target),
          label: String(data.label ?? kind),
          data: { kind },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: 1 },
          labelStyle: { fill: color, fontSize: 10, fontFamily: "IBM Plex Mono" },
        });
        continue;
      }
      const label = String(data.label ?? "");
      const scoreBadge =
        (data.scoreBadge as
          | { label: string; color: string; bgColor: string; borderColor: string }
          | null
          | undefined) ?? null;
      const width = Number(data.width ?? 180);
      const height = Number(data.height ?? 80);
      const existingPos = positionMap.get(id);
      const position =
        existingPos ?? {
          x: (index % 4) * 240,
          y: Math.floor(index / 4) * 160,
        };
      index += 1;
      nextNodes.push({
        id,
        type: "claim",
        data: { label, id, scoreBadge },
        position,
        style: { width, height },
        className: highlightSet.has(id) ? "rf-node-highlight" : "",
      });
    }

    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [elements, highlightSet]);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  };

  const layoutLeftToRight = () => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "LR",
      nodesep: 40,
      ranksep: 80,
    });

    nodes.forEach((node) => {
      const width = Number(node.style?.width ?? 180);
      const height = Number(node.style?.height ?? 80);
      g.setNode(node.id, { width, height });
    });
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const nextNodes = nodes.map((node) => {
      const layout = g.node(node.id);
      if (!layout) {
        return node;
      }
      const width = Number(node.style?.width ?? 180);
      const height = Number(node.style?.height ?? 80);
      return {
        ...node,
        position: {
          x: layout.x - width / 2,
          y: layout.y - height / 2,
        },
      };
    });

    setNodes(nextNodes);
    rfInstance?.fitView({ padding: 0.2 });
  };

  return (
    <div className="graph-wrapper">
      <div className="graph-toolbar">
        <button
          className="button"
          onClick={() => {
            if (!rfInstance) {
              return;
            }
            rfInstance.zoomIn({ duration: 120 });
          }}
        >
          Zoom In
        </button>
        <button
          className="button"
          onClick={() => {
            if (!rfInstance) {
              return;
            }
            rfInstance.zoomOut({ duration: 120 });
          }}
        >
          Zoom Out
        </button>
        <button className="button" onClick={() => rfInstance?.fitView()}>
          Fit
        </button>
        <button
          className="button"
          onClick={() => {
            if (!rfInstance) {
              return;
            }
            rfInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 120 });
          }}
        >
          Reset
        </button>
        <button
          className="button"
          onClick={() => setPanEnabled((prev) => !prev)}
        >
          Pan: {panEnabled ? "On" : "Off"}
        </button>
        <button className="button" onClick={onAddNode}>
          + Claim
        </button>
        <button className="button" onClick={layoutLeftToRight}>
          Layout LR
        </button>
        <div className="zoom-indicator">Zoom: {Math.round(zoom * 100)}%</div>
      </div>
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_event, node) =>
            onSelect({
              type: "node",
              id: node.id,
              data: node.data as Record<string, unknown>,
            })
          }
          onEdgeClick={(_event, edge) =>
            onSelect({
              type: "edge",
              id: edge.id,
              data: (edge.data ?? {}) as Record<string, unknown>,
            })
          }
          onPaneClick={() => onSelect(null)}
          onConnect={(params) => {
            if (params.source && params.target) {
              onAddEdge(params.source, params.target);
            }
          }}
          panOnDrag={panEnabled}
          fitView
          onMove={(_event, viewport) => setZoom(viewport.zoom)}
          onInit={(instance) => setRfInstance(instance)}
        >
          <Background color="#efefef" gap={24} />
        </ReactFlow>
      </div>
    </div>
  );
}
