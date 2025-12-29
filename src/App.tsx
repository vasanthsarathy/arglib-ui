import { useEffect, useMemo, useState } from "react";
import GraphCanvas from "./components/GraphCanvas";
import {
  addEvidenceCard,
  addSupportingDocument,
  createGraph,
  fetchHealth,
  getGraph,
  listEvidenceCards,
  listSupportingDocuments,
  runCredibility,
  runDiagnostics,
  updateGraph,
} from "./api/client";

type GraphData = {
  units: Record<string, { id: string; text: string; type?: string }>;
  relations: Array<{
    src: string;
    dst: string;
    kind: string;
    weight?: number | null;
  }>;
  evidence_cards?: Record<string, Record<string, unknown>>;
  supporting_documents?: Record<string, Record<string, unknown>>;
};

export default function App() {
  const [status, setStatus] = useState("loading");
  const [graphId, setGraphId] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(
    null,
  );
  const [credibility, setCredibility] = useState<Record<string, unknown> | null>(
    null,
  );
  const [claimText, setClaimText] = useState("");
  const [claimType, setClaimType] = useState("fact");
  const [relationSrc, setRelationSrc] = useState("");
  const [relationDst, setRelationDst] = useState("");
  const [relationKind, setRelationKind] = useState("support");
  const [docId, setDocId] = useState("");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [cardId, setCardId] = useState("");
  const [cardTitle, setCardTitle] = useState("");
  const [cardDocId, setCardDocId] = useState("");
  const [cardExcerpt, setCardExcerpt] = useState("");
  const [cards, setCards] = useState<Record<string, unknown>>({});
  const [docs, setDocs] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetchHealth()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (graphId) {
      return;
    }
    createGraph({ payload: { units: {}, relations: [], metadata: {} } as any })
      .then((data) => {
        setGraphId(data.id);
        setGraph(data.payload as GraphData);
      })
      .catch(() => setStatus("error"));
  }, [graphId]);

  useEffect(() => {
    if (!graphId) {
      return;
    }
    getGraph(graphId)
      .then((data) => setGraph(data.payload as GraphData))
      .catch(() => setStatus("error"));
    listEvidenceCards(graphId)
      .then((data) => setCards(data))
      .catch(() => undefined);
    listSupportingDocuments(graphId)
      .then((data) => setDocs(data))
      .catch(() => undefined);
  }, [graphId]);

  const elements = useMemo(() => {
    if (!graph) {
      return [];
    }
    const nodes = Object.values(graph.units || {}).map((unit) => ({
      data: { id: unit.id, label: unit.text },
    }));
    const edges = (graph.relations || []).map((rel, index) => ({
      data: {
        id: `e${index}`,
        source: rel.src,
        target: rel.dst,
        label: rel.kind,
      },
    }));
    return [...nodes, ...edges];
  }, [graph]);

  const updateGraphState = async (next: GraphData) => {
    if (!graphId) {
      return;
    }
    setGraph(next);
    await updateGraph(graphId, { payload: next });
  };

  const handleAddClaim = async () => {
    if (!graph || !claimText.trim()) {
      return;
    }
    const nextId = `c${Object.keys(graph.units || {}).length + 1}`;
    const nextGraph: GraphData = {
      ...graph,
      units: {
        ...graph.units,
        [nextId]: { id: nextId, text: claimText, type: claimType },
      },
      relations: graph.relations || [],
    };
    setClaimText("");
    await updateGraphState(nextGraph);
  };

  const handleAddRelation = async () => {
    if (!graph || !relationSrc || !relationDst) {
      return;
    }
    const nextGraph: GraphData = {
      ...graph,
      relations: [
        ...(graph.relations || []),
        { src: relationSrc, dst: relationDst, kind: relationKind },
      ],
      units: graph.units || {},
    };
    await updateGraphState(nextGraph);
  };

  const handleRunDiagnostics = async () => {
    if (!graphId) {
      return;
    }
    const result = await runDiagnostics(graphId);
    setDiagnostics(result);
  };

  const handleRunCredibility = async () => {
    if (!graphId) {
      return;
    }
    const result = await runCredibility(graphId);
    setCredibility(result);
  };

  const handleAddDocument = async () => {
    if (!graphId || !docId || !docName || !docUrl) {
      return;
    }
    await addSupportingDocument(graphId, {
      payload: { id: docId, name: docName, type: "pdf", url: docUrl },
    });
    const next = await listSupportingDocuments(graphId);
    setDocs(next);
    setDocId("");
    setDocName("");
    setDocUrl("");
  };

  const handleAddCard = async () => {
    if (!graphId || !cardId || !cardTitle || !cardDocId) {
      return;
    }
    await addEvidenceCard(graphId, {
      payload: {
        id: cardId,
        title: cardTitle,
        supporting_doc_id: cardDocId,
        excerpt: cardExcerpt,
        confidence: 0.5,
      },
    });
    const next = await listEvidenceCards(graphId);
    setCards(next);
    setCardId("");
    setCardTitle("");
    setCardDocId("");
    setCardExcerpt("");
  };

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
          <GraphCanvas elements={elements} />
        </section>
        <aside className="sidebar">
          <h2>Analysis</h2>
          <button className="button" onClick={handleRunDiagnostics}>
            Run Diagnostics
          </button>
          <button className="button" onClick={handleRunCredibility}>
            Credibility
          </button>
          <div className="list">
            <div className="list-item">
              {diagnostics ? JSON.stringify(diagnostics) : "Diagnostics pending"}
            </div>
            <div className="list-item">
              {credibility ? JSON.stringify(credibility) : "Credibility pending"}
            </div>
          </div>
        </aside>
      </main>
      <section className="footer">
        <div className="panel">
          <h2>Graph Builder</h2>
          <div className="grid">
            <input
              className="input"
              placeholder="Claim text"
              value={claimText}
              onChange={(event) => setClaimText(event.target.value)}
            />
            <select
              className="input"
              value={claimType}
              onChange={(event) => setClaimType(event.target.value)}
            >
              <option value="fact">fact</option>
              <option value="value">value</option>
              <option value="policy">policy</option>
              <option value="other">other</option>
            </select>
            <button className="button" onClick={handleAddClaim}>
              Add Claim
            </button>
          </div>
          <div className="grid">
            <input
              className="input"
              placeholder="Relation src id"
              value={relationSrc}
              onChange={(event) => setRelationSrc(event.target.value)}
            />
            <input
              className="input"
              placeholder="Relation dst id"
              value={relationDst}
              onChange={(event) => setRelationDst(event.target.value)}
            />
            <select
              className="input"
              value={relationKind}
              onChange={(event) => setRelationKind(event.target.value)}
            >
              <option value="support">support</option>
              <option value="attack">attack</option>
              <option value="undercut">undercut</option>
              <option value="rebut">rebut</option>
            </select>
            <button className="button" onClick={handleAddRelation}>
              Add Relation
            </button>
          </div>
        </div>
        <div className="panel">
          <h2>Evidence</h2>
          <div className="grid">
            <input
              className="input"
              placeholder="Doc id"
              value={docId}
              onChange={(event) => setDocId(event.target.value)}
            />
            <input
              className="input"
              placeholder="Doc name"
              value={docName}
              onChange={(event) => setDocName(event.target.value)}
            />
            <input
              className="input"
              placeholder="Doc url"
              value={docUrl}
              onChange={(event) => setDocUrl(event.target.value)}
            />
            <button className="button" onClick={handleAddDocument}>
              Add Document
            </button>
          </div>
          <div className="grid">
            <input
              className="input"
              placeholder="Card id"
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
            />
            <input
              className="input"
              placeholder="Card title"
              value={cardTitle}
              onChange={(event) => setCardTitle(event.target.value)}
            />
            <input
              className="input"
              placeholder="Doc id for card"
              value={cardDocId}
              onChange={(event) => setCardDocId(event.target.value)}
            />
            <input
              className="input"
              placeholder="Excerpt"
              value={cardExcerpt}
              onChange={(event) => setCardExcerpt(event.target.value)}
            />
            <button className="button" onClick={handleAddCard}>
              Add Evidence Card
            </button>
          </div>
          <div className="grid">
            <div className="list-item">
              Docs: {Object.keys(docs).length}
            </div>
            <div className="list-item">
              Cards: {Object.keys(cards).length}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
