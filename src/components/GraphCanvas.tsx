import { useEffect, useRef, useState } from "react";
import cytoscape, { Core, ElementDefinition, EventObjectNode } from "cytoscape";
import edgehandles from "cytoscape-edgehandles";

type GraphCanvasProps = {
  elements: ElementDefinition[];
  onSelect: (selection: {
    type: "node" | "edge";
    id: string;
    data: Record<string, unknown>;
  } | null) => void;
  onAddEdge: (src: string, dst: string) => void;
  onAddNode: () => void;
};

export default function GraphCanvas({
  elements,
  onSelect,
  onAddEdge,
  onAddNode,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panEnabled, setPanEnabled] = useState(true);
  const [wheelStep, setWheelStep] = useState(0.08);
  const [edgeMode, setEdgeMode] = useState(false);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    cytoscape.use(edgehandles);
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      layout: { name: "breadthfirst", padding: 10 },
      wheelSensitivity: 0.2,
      minZoom: 0.2,
      maxZoom: 2.5,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#ffffff",
            "border-color": "#111111",
            "border-width": 1,
            color: "#111111",
            label: "data(label)",
            "font-family": "IBM Plex Mono, monospace",
            "font-size": "12px",
            "text-wrap": "wrap",
            "text-max-width": "160px",
            "text-valign": "center",
            "text-halign": "center",
            width: "data(width)",
            height: "data(height)",
            shape: "rectangle",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#333333",
            "target-arrow-color": "#333333",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            label: "data(label)",
            color: "#666666",
            "font-family": "IBM Plex Mono, monospace",
            "font-size": "10px",
            "text-background-color": "#ffffff",
            "text-background-opacity": 1,
            "text-background-padding": "2px",
            "curve-style": "bezier",
            "text-rotation": "autorotate",
            "text-margin-y": -8,
          },
        },
        {
          selector: 'edge[kind = "support"]',
          style: {
            color: "#188038",
            "line-color": "#188038",
            "target-arrow-color": "#188038",
          },
        },
        {
          selector: 'edge[kind = "attack"]',
          style: {
            color: "#b00020",
            "line-color": "#b00020",
            "target-arrow-color": "#b00020",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 2,
            "border-color": "#ff6a00",
          },
        },
      ],
    });

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const handler = (event: any, source: any, target: any) => {
      if (!source || !target) {
        return;
      }
      onAddEdge(source.id(), target.id());
    };
    const eh = (cy as any).edgehandles?.({
      handleNodes: "node",
      handlePosition: "right middle",
      handleSize: 10,
      handleColor: "#ff6a00",
      handleLineType: "ghost",
      handleLineColor: "#ff6a00",
      edgeType: () => "flat",
      complete: handler,
    });
    return () => {
      eh?.disableDrawMode();
      eh?.destroy();
    };
  }, [onAddEdge]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }
    cyRef.current.json({ elements });
    cyRef.current.layout({ name: "breadthfirst", padding: 10 }).run();
  }, [elements]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }
    cyRef.current.userPanningEnabled(panEnabled);
  }, [panEnabled]);

  useEffect(() => {
    const container = containerRef.current;
    const cy = cyRef.current;
    if (!container || !cy) {
      return;
    }
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextZoom = Math.min(
        cy.maxZoom(),
        Math.max(cy.minZoom(), cy.zoom() + direction * wheelStep),
      );
      cy.zoom({
        level: nextZoom,
        renderedPosition: { x: event.offsetX, y: event.offsetY },
      });
    };
    cy.userZoomingEnabled(false);
    container.addEventListener("wheel", handler, { passive: false });
    return () => {
      container.removeEventListener("wheel", handler);
      cy.userZoomingEnabled(true);
    };
  }, [wheelStep]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const handler = () => setZoom(Number(cy.zoom().toFixed(2)));
    cy.on("zoom", handler);
    const onTap = (event: EventObjectNode) => {
      const target = event.target;
      if (!target || !target.data) {
        return;
      }
      if (edgeMode) {
        const nodeId = target.id();
        if (!edgeSource) {
          setEdgeSource(nodeId);
        } else if (edgeSource !== nodeId) {
          onAddEdge(edgeSource, nodeId);
          setEdgeSource(null);
        }
        return;
      }
      onSelect({
        type: "node",
        id: target.id(),
        data: target.data() as Record<string, unknown>,
      });
    };
    const onEdgeTap = (event: EventObjectNode) => {
      const target = event.target;
      onSelect({
        type: "edge",
        id: target.id(),
        data: target.data() as Record<string, unknown>,
      });
    };
    const onBgTap = () => onSelect(null);
    cy.on("tap", "node", onTap);
    cy.on("tap", "edge", onEdgeTap);
    cy.on("tap", onBgTap);
    return () => {
      cy.off("zoom", handler);
      cy.off("tap", "node", onTap);
      cy.off("tap", "edge", onEdgeTap);
      cy.off("tap", onBgTap);
    };
  }, [edgeMode, edgeSource, onAddEdge, onSelect]);

  return (
    <div className="graph-wrapper">
      <div className="graph-toolbar">
        <button
          className="button"
          onClick={() => {
            const cy = cyRef.current;
            if (!cy) {
              return;
            }
            cy.zoom(cy.zoom() * 1.1);
            cy.center();
          }}
        >
          Zoom In
        </button>
        <button
          className="button"
          onClick={() => {
            const cy = cyRef.current;
            if (!cy) {
              return;
            }
            cy.zoom(cy.zoom() * 0.9);
            cy.center();
          }}
        >
          Zoom Out
        </button>
        <button className="button" onClick={() => cyRef.current?.fit()}>
          Fit
        </button>
        <button
          className="button"
          onClick={() => {
            const cy = cyRef.current;
            if (!cy) {
              return;
            }
            cy.zoom(1);
            cy.center();
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
        <button
          className="button"
          onClick={() => {
            setEdgeMode((prev) => !prev);
            setEdgeSource(null);
            const cy = cyRef.current;
            if (!cy) {
              return;
            }
            const plugin = (cy as any).edgehandles?.();
            if (plugin) {
              if (!edgeMode) {
                plugin.enableDrawMode();
              } else {
                plugin.disableDrawMode();
              }
            }
          }}
        >
          Edge: {edgeMode ? "On" : "Off"}
        </button>
        <button className="button" onClick={onAddNode}>
          + Claim
        </button>
        <label className="zoom-step">
          Wheel Step
          <input
            type="range"
            min="0.02"
            max="0.2"
            step="0.01"
            value={wheelStep}
            onChange={(event) => setWheelStep(Number(event.target.value))}
          />
        </label>
        <div className="zoom-indicator">Zoom: {zoom}x</div>
        {edgeSource && (
          <div className="zoom-indicator">Edge from {edgeSource}</div>
        )}
      </div>
      <div ref={containerRef} className="graph-canvas" />
    </div>
  );
}
