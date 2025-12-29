import { useEffect, useRef } from "react";
import cytoscape, { Core, ElementDefinition } from "cytoscape";

type GraphCanvasProps = {
  elements: ElementDefinition[];
};

export default function GraphCanvas({ elements }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

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
            "background-color": "#111111",
            "border-color": "#ff6a00",
            "border-width": 1,
            color: "#f2f2f2",
            label: "data(label)",
            "font-family": "IBM Plex Mono, monospace",
            "font-size": "12px",
            "text-wrap": "wrap",
            "text-max-width": "140px",
            "text-valign": "center",
            "text-halign": "center",
            width: "150px",
            height: "60px",
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
    if (!cyRef.current) {
      return;
    }
    cyRef.current.json({ elements });
    cyRef.current.layout({ name: "breadthfirst", padding: 10 }).run();
  }, [elements]);

  return (
    <div className="graph-wrapper">
      <div className="graph-toolbar">
        <button
          className="button"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.1)}
        >
          Zoom In
        </button>
        <button
          className="button"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.9)}
        >
          Zoom Out
        </button>
        <button className="button" onClick={() => cyRef.current?.fit()}>
          Fit
        </button>
      </div>
      <div ref={containerRef} className="graph-canvas" />
    </div>
  );
}
