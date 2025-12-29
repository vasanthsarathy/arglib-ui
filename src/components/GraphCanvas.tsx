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
            height: "48px",
            shape: "rectangle",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#444444",
            "target-arrow-color": "#444444",
            "target-arrow-shape": "triangle",
            label: "data(label)",
            color: "#666666",
            "font-family": "IBM Plex Mono, monospace",
            "font-size": "10px",
            "text-background-color": "#ffffff",
            "text-background-opacity": 1,
            "text-background-padding": "2px",
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

  return <div ref={containerRef} className="graph-canvas" />;
}
