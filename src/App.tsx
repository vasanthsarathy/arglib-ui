import { useEffect, useState } from "react";
import { fetchHealth } from "./api/client";

export default function App() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetchHealth()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>ArgLib UI</h1>
          <p>Graph authoring and analysis frontend (scaffold).</p>
        </div>
        <div className="status">
          <span className={`dot ${status}`}></span>
          <span>Server: {status}</span>
        </div>
      </header>
      <section className="panel">
        <h2>Next Steps</h2>
        <ul>
          <li>Graph editor canvas (Cytoscape.js)</li>
          <li>Evidence cards & supporting docs sidebar</li>
          <li>Analysis panel: diagnostics, credibility, critique</li>
          <li>LLM-assisted mining workflow</li>
        </ul>
      </section>
    </div>
  );
}
