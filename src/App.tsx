import { useEffect, useMemo, useState } from "react";
import GraphCanvas from "./components/GraphCanvas";
import {
  addEvidenceCard,
  attachEvidenceCard,
  addSupportingDocument,
  createGraph,
  fetchHealth,
  getGraph,
  loadDataset,
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
  const [relationKind, setRelationKind] = useState("support");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [cardTitle, setCardTitle] = useState("");
  const [cardDocId, setCardDocId] = useState("");
  const [cardExcerpt, setCardExcerpt] = useState("");
  const [attachCardId, setAttachCardId] = useState("");
  const [cards, setCards] = useState<Record<string, unknown>>({});
  const [docs, setDocs] = useState<Record<string, unknown>>({});
  const [selection, setSelection] = useState<{
    type: "node" | "edge";
    id: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [datasetPath, setDatasetPath] = useState(
    "C:\\Users\\vasan\\Code\\arglib\\.external\\argument-mining\\processed_data\\augmented.jsonl",
  );
  const [datasetItems, setDatasetItems] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");

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
    const nodes = Object.values(graph.units || {}).map((unit) => {
      const text = unit.text || "";
      const maxChars = 26;
      const lines = Math.max(1, Math.ceil(text.length / maxChars));
      const width = Math.min(260, Math.max(140, maxChars * 6));
      const height = Math.min(140, 30 + lines * 16);
      return {
        data: {
          id: unit.id,
          label: text,
          width,
          height,
        },
      };
    });
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

  const handleAddClaim = async (textOverride?: string) => {
    if (!graph) {
      return;
    }
    const textValue = textOverride ?? claimText;
    if (!textValue.trim()) {
      return;
    }
    const nextId = `c${Object.keys(graph.units || {}).length + 1}`;
    const nextGraph: GraphData = {
      ...graph,
      units: {
        ...graph.units,
        [nextId]: { id: nextId, text: textValue, type: claimType },
      },
      relations: graph.relations || [],
    };
    setClaimText("");
    await updateGraphState(nextGraph);
  };

  const handleAddRelation = async (src?: string, dst?: string) => {
    if (!graph) {
      return;
    }
    const source = src ?? relationSrc;
    const target = dst ?? relationDst;
    if (!source || !target) {
      return;
    }
    const nextGraph: GraphData = {
      ...graph,
      relations: [
        ...(graph.relations || []),
        { src: source, dst: target, kind: relationKind },
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
    if (!graphId || !docName || !docUrl) {
      return;
    }
    const id = `doc_${Date.now()}`;
    await addSupportingDocument(graphId, {
      payload: { id, name: docName, type: "pdf", url: docUrl },
    });
    const next = await listSupportingDocuments(graphId);
    setDocs(next);
    setDocName("");
    setDocUrl("");
  };

  const handleAddCard = async () => {
    if (!graphId || !cardTitle || !cardDocId) {
      return;
    }
    const id = `card_${Date.now()}`;
    await addEvidenceCard(graphId, {
      payload: {
        id,
        title: cardTitle,
        supporting_doc_id: cardDocId,
        excerpt: cardExcerpt,
        confidence: 0.5,
      },
    });
    const next = await listEvidenceCards(graphId);
    setCards(next);
    setCardTitle("");
    setCardDocId("");
    setCardExcerpt("");
  };

  const handleAttachEvidence = async (unitId: string) => {
    if (!graphId || !attachCardId) {
      return;
    }
    await attachEvidenceCard(graphId, unitId, attachCardId);
    const data = await getGraph(graphId);
    setGraph(data.payload as GraphData);
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
        <aside className="panel inspector">
          <h2>Inspector</h2>
          {!selection && <div className="list-item">Nothing selected.</div>}
          {selection?.type === "node" && (
            <>
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
            <button
              className="button"
              onClick={async () => {
                if (!graph || !selection) {
                  return;
                }
                const nextGraph = {
                  ...graph,
                  units: {
                    ...graph.units,
                    [selection.id]: {
                      id: selection.id,
                      text: claimText,
                      type: claimType,
                    },
                  },
                };
                await updateGraphState(nextGraph);
              }}
            >
              Update Claim
            </button>
          </div>
              <div className="grid">
                <select
                  className="input"
                  value={attachCardId}
                  onChange={(event) => setAttachCardId(event.target.value)}
                >
                  <option value="">Select evidence card</option>
                  {Object.keys(cards).map((cardKey) => (
                    <option key={cardKey} value={cardKey}>
                      {cardKey}
                    </option>
                  ))}
                </select>
                <button
                  className="button"
                  onClick={() => handleAttachEvidence(selection.id)}
                >
                  Attach Evidence
                </button>
              </div>
            </>
          )}
          {selection?.type === "edge" && (
            <div className="grid">
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
              <button
                className="button"
                onClick={async () => {
                  if (!graph || !selection) {
                    return;
                  }
                  const nextGraph = {
                    ...graph,
                    relations: (graph.relations || []).map((rel, idx) => {
                      const edgeId = `e${idx}`;
                      if (edgeId !== selection.id) {
                        return rel;
                      }
                      return { ...rel, kind: relationKind };
                    }),
                  };
                  await updateGraphState(nextGraph);
                }}
              >
                Update Edge
              </button>
            </div>
          )}
        </aside>
        <section className="canvas">
          <GraphCanvas
            elements={elements}
            onSelect={setSelection}
            onAddEdge={(src, dst) => handleAddRelation(src, dst)}
            onAddNode={() => handleAddClaim("New claim")}
          />
        </section>
        <aside className="right-panels">
          <div className="panel">
            <h2>Evidence</h2>
            <div className="grid">
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
                placeholder="Card title"
                value={cardTitle}
                onChange={(event) => setCardTitle(event.target.value)}
              />
              <select
                className="input"
                value={cardDocId}
                onChange={(event) => setCardDocId(event.target.value)}
              >
                <option value="">Select supporting document</option>
                {Object.keys(docs).map((docKey) => (
                  <option key={docKey} value={docKey}>
                    {docKey}
                  </option>
                ))}
              </select>
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
          <div className="panel">
            <h2>Summary</h2>
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
            <div className="grid">
              <input
                className="input"
                placeholder="Dataset path"
                value={datasetPath}
                onChange={(event) => setDatasetPath(event.target.value)}
              />
              <button
                className="button"
                onClick={async () => {
                  const response = await loadDataset({
                    path: datasetPath,
                    limit: 50,
                  });
                  setDatasetItems(response.items);
                  setSelectedDatasetId("");
                }}
              >
                Load Dataset
              </button>
            </div>
            <div className="grid">
              <select
                className="input"
                value={selectedDatasetId}
                onChange={(event) => setSelectedDatasetId(event.target.value)}
              >
                <option value="">Select a graph</option>
                {datasetItems.map((item) => (
                  <option key={item.id as string} value={item.id as string}>
                    {item.topic ?? "Graph"} · {item.id}
                  </option>
                ))}
              </select>
              <button
                className="button"
                onClick={async () => {
                  if (!selectedDatasetId) {
                    return;
                  }
                  const data = await getGraph(selectedDatasetId);
                  setGraphId(data.id);
                  setGraph(data.payload as GraphData);
                }}
              >
                Load Graph
              </button>
            </div>
          </div>
          <div className="panel">
            <h2>Reasoning</h2>
            <div className="list">
              <div className="list-item">Dung semantics (pending)</div>
              <div className="list-item">ABA dispute trees (pending)</div>
              <div className="list-item">LLM mining (pending)</div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
