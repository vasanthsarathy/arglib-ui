import { useEffect, useState } from "react";
import GraphCanvas from "./components/GraphCanvas";
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
          <p>Graph authoring and analysis frontend.</p>
        </div>
        <div className="status">
          <span className={`dot ${status}`}></span>
          <span>Server: {status}</span>
        </div>
      </header>
      <main className="workspace">
        <aside className="sidebar">
          <h2>Claims</h2>
          <button className="button">Add Claim</button>
          <div className="list">
            <div className="list-item">Claim 1</div>
            <div className="list-item">Claim 2</div>
          </div>
        </aside>
        <section className="canvas">
          <GraphCanvas />
        </section>
        <aside className="sidebar">
          <h2>Analysis</h2>
          <button className="button">Run Diagnostics</button>
          <button className="button">Credibility</button>
          <div className="list">
            <div className="list-item">No results yet.</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
