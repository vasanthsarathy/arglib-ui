import { useEffect, useMemo, useRef, useState } from "react";
import GraphCanvas from "./components/GraphCanvas";
import {
  addEvidenceCard,
  attachEvidenceCard,
  addSupportingDocument,
  createGraph,
  fetchHealth,
  getGraph,
  parseMining,
  parseMiningUrl,
  loadDataset,
  listEvidenceCards,
  listSupportingDocuments,
  runCredibility,
  runDiagnostics,
  runReasoner,
  runReasoning,
  scoreClaimConfidence,
  classifyClaimType,
  validateEdge,
  generateEdgeAssumptions,
  updateGraph,
} from "./api/client";
import type {
  LLMClaimConfidenceResponse,
  LLMClaimTypeResponse,
  LLMEdgeValidationResponse,
  EdgeAssumptionsResponse,
  ReasonerResponse,
  ReasoningResponse,
} from "./api/types";

type GraphData = {
  units: Record<
    string,
    {
      id: string;
      text: string;
      type?: string;
      evidence_ids?: string[];
      metadata?: Record<string, unknown>;
    }
  >;
  relations: Array<{
    src: string;
    dst: string;
    kind: string;
    weight?: number | null;
  }>;
  evidence_cards?: Record<string, Record<string, unknown>>;
  supporting_documents?: Record<string, Record<string, unknown>>;
};

type Diagnostics = {
  node_count?: number;
  relation_count?: number;
  attack_edge_count?: number;
  support_edge_count?: number;
  cycle_count?: number;
  cycles?: string[][];
  component_count?: number;
  components?: string[][];
  scc_count?: number;
  strongly_connected_components?: string[][];
  isolated_units?: string[];
  unsupported_claims?: string[];
  degrees?: Record<string, { in: number; out: number }>;
  degree_summary?: { avg_in: number; avg_out: number; max_in: number; max_out: number };
  reachability?: Record<string, string[]>;
  max_reachability?: number;
};

type EvidenceMeta = {
  evidence_id?: string;
  trust?: number;
  score?: number;
  rationale?: string | null;
};

type ResizeState = {
  kind: "left" | "right" | "bottom" | "left-vert" | "right-vert";
  startX: number;
  startY: number;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftTopHeight: number;
  rightTopHeight: number;
};

const DEFAULT_LAYOUT = {
  leftWidth: 320,
  rightWidth: 320,
  bottomHeight: 180,
  leftTopHeight: 360,
  rightTopHeight: 360,
};

const LAYOUT_MIN = {
  leftWidth: 240,
  rightWidth: 240,
  centerWidth: 420,
  bottomHeight: 140,
  panelHeight: 160,
};

const SPLITTER_SIZE = 6;

export default function App() {
  const [status, setStatus] = useState("loading");
  const [graphId, setGraphId] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const graphRef = useRef<GraphData | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [credibility, setCredibility] = useState<Record<string, unknown> | null>(
    null,
  );
  const [llmProvider, setLlmProvider] = useState<
    "openai" | "anthropic" | "ollama"
  >("openai");
  const [llmModel, setLlmModel] = useState("gpt-5-mini");
  const [llmResult, setLlmResult] = useState<LLMClaimConfidenceResponse | null>(
    null,
  );
  const [llmError, setLlmError] = useState("");
  const [claimTypeResult, setClaimTypeResult] =
    useState<LLMClaimTypeResponse | null>(null);
  const [claimTypeError, setClaimTypeError] = useState("");
  const [isScoringClaim, setIsScoringClaim] = useState(false);
  const [isClassifyingClaim, setIsClassifyingClaim] = useState(false);
  const [isValidatingEdge, setIsValidatingEdge] = useState(false);
  const [isGeneratingAssumptions, setIsGeneratingAssumptions] = useState(false);
  const [isRunningCredibility, setIsRunningCredibility] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [reasoning, setReasoning] = useState<ReasoningResponse | null>(null);
  const [reasoningError, setReasoningError] = useState("");
  const [reasonerResults, setReasonerResults] = useState<ReasonerResponse | null>(
    null,
  );
  const [reasonerTasks, setReasonerTasks] = useState<string[]>([
    "grounded_extension",
    "preferred_extensions",
    "stable_extensions",
    "complete_extensions",
    "grounded_labeling",
    "credibility_propagation",
  ]);
  const [reasonerError, setReasonerError] = useState("");
  const [claimText, setClaimText] = useState("");
  const [claimType, setClaimType] = useState("fact");
  const [relationKind, setRelationKind] = useState("support");
  const [manualClaimScore, setManualClaimScore] = useState("");
  const [edgeAssumptions, setEdgeAssumptions] =
    useState<EdgeAssumptionsResponse | null>(null);
  const [edgeAssumptionsError, setEdgeAssumptionsError] = useState("");
  const [edgeAssumptionCount, setEdgeAssumptionCount] = useState(3);
  const [edgeValidation, setEdgeValidation] =
    useState<LLMEdgeValidationResponse | null>(null);
  const [edgeValidationError, setEdgeValidationError] = useState("");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docType, setDocType] = useState("pdf");
  const [cardTitle, setCardTitle] = useState("");
  const [cardDocId, setCardDocId] = useState("");
  const [cardExcerpt, setCardExcerpt] = useState("");
  const [cardConfidence, setCardConfidence] = useState(1.0);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [attachCardId, setAttachCardId] = useState("");
  const [cards, setCards] = useState<Record<string, unknown>>({});
  const [docs, setDocs] = useState<Record<string, unknown>>({});
  const [selection, setSelection] = useState<{
    type: "node" | "edge";
    id: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [miningText, setMiningText] = useState("");
  const [miningDocId, setMiningDocId] = useState("");
  const [miningUrl, setMiningUrl] = useState("");
  const [miningIncludeLinks, setMiningIncludeLinks] = useState(true);
  const [miningError, setMiningError] = useState("");
  const [isMining, setIsMining] = useState(false);
  const [datasetSource, setDatasetSource] = useState("");
  const [datasetPath, setDatasetPath] = useState(
    "C:\\Users\\vasan\\Code\\arglib\\.external\\argument-mining\\processed_data\\augmented.jsonl",
  );
  const [datasetItems, setDatasetItems] = useState<
    Array<{
      id: string;
      label: string;
      payload?: GraphData;
      raw?: Record<string, unknown>;
      source?: string;
    }>
  >([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [datasetCount, setDatasetCount] = useState(0);
  const [datasetError, setDatasetError] = useState("");
  const [highlightIsolated, setHighlightIsolated] = useState(false);
  const [highlightUnsupported, setHighlightUnsupported] = useState(false);
  const [diagnosticFocus, setDiagnosticFocus] = useState<string[]>([]);
  const [reasoningHighlight, setReasoningHighlight] = useState<string[]>([]);
  const panelBoardRef = useRef<HTMLDivElement | null>(null);
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LAYOUT.leftWidth);
  const [rightWidth, setRightWidth] = useState(DEFAULT_LAYOUT.rightWidth);
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_LAYOUT.bottomHeight);
  const [leftTopHeight, setLeftTopHeight] = useState(
    DEFAULT_LAYOUT.leftTopHeight,
  );
  const [rightTopHeight, setRightTopHeight] = useState(
    DEFAULT_LAYOUT.rightTopHeight,
  );
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<
    Array<{ ts: string; message: string }>
  >([]);
  const graphFileRef = useRef<HTMLInputElement | null>(null);
  const datasetFileRef = useRef<HTMLInputElement | null>(null);
  const folderFileRef = useRef<HTMLInputElement | null>(null);
  const logConsole = (message: string) => {
    setConsoleEntries((prev) => [
      { ts: new Date().toLocaleTimeString(), message },
      ...prev,
    ]);
  };

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

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    if (!panelBoardRef.current) {
      return;
    }
    const update = () => {
      const rect = panelBoardRef.current?.getBoundingClientRect();
      if (rect) {
        setLayoutSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(panelBoardRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const defaults: Record<string, string> = {
      openai: "gpt-5-mini",
      anthropic: "claude-3-5-sonnet-20240620",
      ollama: "llama3.1",
    };
    setLlmModel(defaults[llmProvider] ?? "gpt-5-mini");
  }, [llmProvider]);

  useEffect(() => {
    if (!selection || selection.type !== "node" || !graph) {
      return;
    }
    const unit = graph.units?.[selection.id];
    if (!unit) {
      return;
    }
    setClaimText(unit.text ?? "");
    setClaimType(unit.type ?? "fact");
    const metadata = unit.metadata ?? {};
    const claimScore =
      typeof metadata.claim_credibility === "number"
        ? (metadata.claim_credibility as number)
        : typeof metadata.llm_confidence === "number"
          ? (metadata.llm_confidence as number)
          : null;
    if (claimScore !== null) {
      const evidenceMeta = Array.isArray(metadata.claim_credibility_evidence)
        ? metadata.claim_credibility_evidence
        : [];
      const rationale =
        evidenceMeta.length > 0 && evidenceMeta[0]?.rationale
          ? String(evidenceMeta[0].rationale)
          : String(metadata.llm_confidence_rationale ?? "");
      setLlmResult({
        score: claimScore,
        weighted_score:
          typeof metadata.claim_credibility_weighted === "number"
            ? (metadata.claim_credibility_weighted as number)
            : null,
        rationale,
        provider: String(
          metadata.claim_credibility_provider ??
            metadata.llm_confidence_provider ??
            llmProvider,
        ),
        model: String(
          metadata.claim_credibility_model ??
            metadata.llm_confidence_model ??
            llmModel,
        ),
        score_source: String(metadata.claim_credibility_method ?? ""),
      });
    } else {
      setLlmResult(null);
    }
    const claimType = unit.type ?? "";
    if (claimType) {
      setClaimTypeResult({
        claim_type: claimType,
        confidence:
          typeof metadata.claim_type_confidence === "number"
            ? metadata.claim_type_confidence
            : null,
        rationale:
          typeof metadata.claim_type_rationale === "string"
            ? metadata.claim_type_rationale
            : null,
        provider: String(metadata.claim_type_provider ?? llmProvider),
        model: String(metadata.claim_type_model ?? llmModel),
      });
    } else {
      setClaimTypeResult(null);
    }
    const rawManual =
      typeof metadata.claim_credibility === "number"
        ? metadata.claim_credibility
        : "";
    setManualClaimScore(
      rawManual === "" ? "" : Number(rawManual).toFixed(2),
    );
  }, [selection, graph]);

  useEffect(() => {
    if (!selection || selection.type !== "edge" || !graph) {
      return;
    }
    const index = Number(selection.id.replace("e", ""));
    const rel = graph.relations?.[index];
    if (rel?.kind) {
      setRelationKind(rel.kind);
    }
    const storedValidation =
      (rel?.metadata as Record<string, unknown> | undefined)?.llm_validation;
    if (storedValidation && typeof storedValidation === "object") {
      const payload = storedValidation as Record<string, unknown>;
      if (
        typeof payload.evaluation === "string" &&
        typeof payload.score === "number"
      ) {
        setEdgeValidation({
          evaluation: payload.evaluation,
          score: payload.score,
          rationale:
            typeof payload.rationale === "string"
              ? payload.rationale
              : undefined,
          provider: String(payload.provider ?? llmProvider),
          model: String(payload.model ?? llmModel),
        });
      } else {
        setEdgeValidation(null);
      }
    } else {
      setEdgeValidation(null);
    }
    setEdgeValidationError("");
    setEdgeAssumptions(null);
    setEdgeAssumptionsError("");
  }, [selection, graph]);

  useEffect(() => {
    if (!resizing) {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      const deltaX = event.clientX - resizing.startX;
      const deltaY = event.clientY - resizing.startY;
      const maxLeft =
        layoutSize.width -
        resizing.rightWidth -
        LAYOUT_MIN.centerWidth -
        SPLITTER_SIZE * 2;
      const maxRight =
        layoutSize.width -
        resizing.leftWidth -
        LAYOUT_MIN.centerWidth -
        SPLITTER_SIZE * 2;
      const maxBottom = layoutSize.height - LAYOUT_MIN.panelHeight - SPLITTER_SIZE;
      if (resizing.kind === "left") {
        setLeftWidth(
          Math.max(
            LAYOUT_MIN.leftWidth,
            Math.min(maxLeft, resizing.leftWidth + deltaX),
          ),
        );
      }
      if (resizing.kind === "right") {
        setRightWidth(
          Math.max(
            LAYOUT_MIN.rightWidth,
            Math.min(maxRight, resizing.rightWidth - deltaX),
          ),
        );
      }
      if (resizing.kind === "bottom") {
        setBottomHeight(
          Math.max(
            LAYOUT_MIN.bottomHeight,
            Math.min(maxBottom, resizing.bottomHeight - deltaY),
          ),
        );
      }
      if (resizing.kind === "left-vert") {
        const topHeight = layoutSize.height - bottomHeight - SPLITTER_SIZE;
        const maxTop = topHeight - LAYOUT_MIN.panelHeight - SPLITTER_SIZE;
        setLeftTopHeight(
          Math.max(
            LAYOUT_MIN.panelHeight,
            Math.min(maxTop, resizing.leftTopHeight + deltaY),
          ),
        );
      }
      if (resizing.kind === "right-vert") {
        const topHeight = layoutSize.height - bottomHeight - SPLITTER_SIZE;
        const maxTop = topHeight - LAYOUT_MIN.panelHeight - SPLITTER_SIZE;
        setRightTopHeight(
          Math.max(
            LAYOUT_MIN.panelHeight,
            Math.min(maxTop, resizing.rightTopHeight + deltaY),
          ),
        );
      }
    };
    const handleUp = () => setResizing(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [resizing, layoutSize.height, layoutSize.width, bottomHeight]);

  const getScoreClassification = (credibilityScore: number) => {
    if (credibilityScore >= -1.0 && credibilityScore <= -0.6) {
      return {
        label: "Very Low Confidence",
        color: "#dc2626",
        bgColor: "#fef2f2",
        borderColor: "#fecaca",
      };
    }
    if (credibilityScore >= -0.59 && credibilityScore <= -0.2) {
      return {
        label: "Low Confidence",
        color: "#ea580c",
        bgColor: "#fff7ed",
        borderColor: "#fed7aa",
      };
    }
    if (credibilityScore >= -0.19 && credibilityScore <= 0.19) {
      return {
        label: "Neutral / Unknown",
        color: "#6b7280",
        bgColor: "#f9fafb",
        borderColor: "#d1d5db",
      };
    }
    if (credibilityScore >= 0.2 && credibilityScore <= 0.59) {
      return {
        label: "High Confidence",
        color: "#16a34a",
        bgColor: "#f0fdf4",
        borderColor: "#bbf7d0",
      };
    }
    if (credibilityScore >= 0.6 && credibilityScore <= 1.0) {
      return {
        label: "Very High Confidence",
        color: "#15803d",
        bgColor: "#ecfdf5",
        borderColor: "#86efac",
      };
    }
    return {
      label: "Unknown",
      color: "#6b7280",
      bgColor: "#f9fafb",
      borderColor: "#d1d5db",
    };
  };

  const highlightNodes = useMemo(() => {
    const nodes = new Set<string>();
    if (diagnostics) {
      if (highlightIsolated && Array.isArray(diagnostics.isolated_units)) {
        diagnostics.isolated_units.forEach((node: string) => nodes.add(node));
      }
      if (
        highlightUnsupported &&
        Array.isArray(diagnostics.unsupported_claims)
      ) {
        diagnostics.unsupported_claims.forEach((node: string) => nodes.add(node));
      }
    }
    diagnosticFocus.forEach((node) => nodes.add(node));
    reasoningHighlight.forEach((node) => nodes.add(node));
    return Array.from(nodes);
  }, [
    diagnostics,
    highlightIsolated,
    highlightUnsupported,
    diagnosticFocus,
    reasoningHighlight,
  ]);

  const elements = useMemo(() => {
    if (!graph) {
      return [];
    }
    const nodes = Object.values(graph.units || {}).map((unit) => {
      const text = unit.text || "";
      const metadata = unit.metadata ?? {};
      const rawScore =
        metadata.claim_credibility_propagated ??
        metadata.claim_credibility ??
        metadata.claim_credibility_score ??
        metadata.llm_confidence ??
        metadata.llm_confidence_score ??
        (metadata.claim_credibility_result as Record<string, unknown> | undefined)
          ?.score ??
        (metadata.llm_confidence_result as Record<string, unknown> | undefined)
          ?.score ??
        null;
      const numericScore =
        typeof rawScore === "number"
          ? rawScore
          : typeof rawScore === "string"
            ? Number(rawScore)
            : null;
      const score =
        numericScore !== null && Number.isFinite(numericScore)
          ? numericScore
          : null;
      const propagatedScore =
        typeof metadata.claim_credibility_propagated === "number"
          ? metadata.claim_credibility_propagated
          : null;
      const rawLabel =
        metadata.claim_credibility_label ??
        metadata.llm_confidence_label ??
        null;
      const scoreBadge =
        typeof rawLabel === "string" && rawLabel.trim()
          ? {
              label: rawLabel,
              color: "#166534",
              bgColor: "#f0fdf4",
              borderColor: "#bbf7d0",
            }
          : typeof score === "number"
            ? getScoreClassification(score)
            : null;
      const maxChars = 26;
      const lines = Math.max(1, Math.ceil(text.length / maxChars));
      const width = Math.min(300, Math.max(160, maxChars * 7));
      const height = Math.min(140, 30 + lines * 16);
      return {
        data: {
          id: unit.id,
          label: text,
          scoreBadge,
          propagatedScore,
          width,
          height,
        },
      };
    });
    const edges = (graph.relations || []).map((rel, index) => {
      const metadata = rel.metadata ?? {};
      const validation = metadata.llm_validation as
        | Record<string, unknown>
        | undefined;
      const validationScore =
        validation && typeof validation.score === "number"
          ? validation.score
          : typeof rel.weight === "number"
            ? rel.weight
            : null;
      const label =
        validationScore !== null
          ? `${rel.kind} ${validationScore.toFixed(2)}`
          : rel.kind;
      return {
        data: {
          id: `e${index}`,
          source: rel.src,
          target: rel.dst,
          label,
          kind: rel.kind,
          validationScore,
        },
      };
    });
    return [...nodes, ...edges];
  }, [graph]);

  const updateGraphState = async (next: GraphData) => {
    if (!graphId) {
      return;
    }
    graphRef.current = next;
    setGraph(next);
    await updateGraph(graphId, { payload: next });
  };

  const extractGraphPayload = (
    raw: unknown,
  ): { graph: GraphData; bundle?: Record<string, unknown> } | null => {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const record = raw as Record<string, unknown>;
    if (record.kind === "arglib-graph-bundle" && record.payload) {
      const payload = record.payload as Record<string, unknown>;
      if (payload?.units && payload?.relations) {
        return { graph: payload as GraphData, bundle: record };
      }
    }
    if (record.payload) {
      const payload = record.payload as Record<string, unknown>;
      if (payload?.units && payload?.relations) {
        return { graph: payload as GraphData, bundle: record };
      }
    }
    if (record.graph && typeof record.graph === "object") {
      const payload = record.graph as Record<string, unknown>;
      if (payload?.units && payload?.relations) {
        return { graph: payload as GraphData, bundle: record };
      }
    }
    if (record.units && record.relations) {
      return { graph: record as GraphData };
    }
    return null;
  };

  const applyImportedGraph = async (
    payload: GraphData,
    bundle?: Record<string, unknown>,
  ) => {
    await updateGraphState(payload);
    if (!bundle) {
      return;
    }
    if (bundle.cards && typeof bundle.cards === "object") {
      setCards(bundle.cards as Record<string, unknown>);
    }
    if (bundle.docs && typeof bundle.docs === "object") {
      setDocs(bundle.docs as Record<string, unknown>);
    }
    if (bundle.diagnostics) {
      setDiagnostics(bundle.diagnostics as Diagnostics);
    }
    if (bundle.credibility) {
      setCredibility(bundle.credibility as Record<string, unknown>);
    }
    if (bundle.reasoning) {
      setReasoning(bundle.reasoning as ReasoningResponse);
    }
    if (bundle.reasoner_results) {
      setReasonerResults(bundle.reasoner_results as ReasonerResponse);
    }
  };

  const parseDatasetRecords = (
    raw: unknown,
  ): Array<Record<string, unknown>> => {
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw as Array<Record<string, unknown>>;
    }
    if (typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      if (Array.isArray(record.items)) {
        return record.items as Array<Record<string, unknown>>;
      }
      if (Array.isArray(record.graphs)) {
        return record.graphs as Array<Record<string, unknown>>;
      }
      if (Array.isArray(record.dataset)) {
        return record.dataset as Array<Record<string, unknown>>;
      }
      return [record];
    }
    return [];
  };

  const buildDatasetItems = (
    records: Array<Record<string, unknown>>,
    source: string,
  ) => {
    const items: Array<{
      id: string;
      label: string;
      payload?: GraphData;
      raw?: Record<string, unknown>;
      source?: string;
    }> = [];
    records.forEach((record, index) => {
      const extracted = extractGraphPayload(record);
      const id =
        String(record.id ?? record.graph_id ?? record.key ?? "") ||
        `${source}-${index + 1}`;
      const label =
        String(record.topic ?? record.issue ?? record.title ?? "Graph") ||
        "Graph";
      items.push({
        id,
        label,
        payload: extracted?.graph,
        raw: record,
        source,
      });
    });
    return items;
  };

  const handleImportGraphFile = async (file: File) => {
    setDatasetError("");
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const extracted = extractGraphPayload(raw);
      if (!extracted) {
        throw new Error("File does not contain an ArgLib graph payload.");
      }
      await applyImportedGraph(extracted.graph, extracted.bundle);
      logConsole(`Imported graph from ${file.name}`);
    } catch (error) {
      setDatasetError(
        error instanceof Error ? error.message : "Graph import failed.",
      );
    } finally {
      if (graphFileRef.current) {
        graphFileRef.current.value = "";
      }
    }
  };

  const handleImportDatasetFiles = async (
    files: FileList,
    sourceLabel: string,
  ) => {
    setDatasetError("");
    const collected: Array<Record<string, unknown>> = [];
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith(".jsonl")) {
          text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => {
              collected.push(JSON.parse(line));
            });
          continue;
        }
        const raw = JSON.parse(text);
        const records = parseDatasetRecords(raw);
        collected.push(...records);
      }
      const nextItems = buildDatasetItems(collected, sourceLabel);
      setDatasetItems(nextItems);
      setDatasetCount(nextItems.length);
      setSelectedDatasetId("");
      setDatasetSource(sourceLabel);
      logConsole(`Imported dataset (${sourceLabel}): ${nextItems.length} graphs`);
    } catch (error) {
      setDatasetItems([]);
      setDatasetCount(0);
      setSelectedDatasetId("");
      setDatasetSource("");
      setDatasetError(
        error instanceof Error ? error.message : "Dataset import failed.",
      );
    } finally {
      if (datasetFileRef.current) {
        datasetFileRef.current.value = "";
      }
      if (folderFileRef.current) {
        folderFileRef.current.value = "";
      }
    }
  };

  const handleDownloadGraph = () => {
    if (!graph) {
      return;
    }
    const bundle = {
      kind: "arglib-graph-bundle",
      version: 1,
      exported_at: new Date().toISOString(),
      graph_id: graphId,
      payload: graph,
      diagnostics,
      credibility,
      reasoning,
      reasoner_results: reasonerResults,
      cards,
      docs,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arglib-graph-${graphId ?? "export"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    logConsole("Exported graph bundle");
  };

  const handleAddClaim = async (textOverride?: string) => {
    const current = graphRef.current;
    if (!current) {
      return;
    }
    const textValue = textOverride ?? claimText;
    if (!textValue.trim()) {
      return;
    }
    const nextId = `c${Object.keys(current.units || {}).length + 1}`;
    const nextGraph: GraphData = {
      ...current,
      units: {
        ...current.units,
        [nextId]: { id: nextId, text: textValue, type: claimType },
      },
      relations: current.relations || [],
    };
    setClaimText("");
    await updateGraphState(nextGraph);
  };

  const handleAddRelation = async (src?: string, dst?: string) => {
    const current = graphRef.current;
    if (!current) {
      return;
    }
    const source = src ?? "";
    const target = dst ?? "";
    if (!source || !target) {
      return;
    }
    const nextGraph: GraphData = {
      ...current,
      relations: [
        ...(current.relations || []),
        { src: source, dst: target, kind: relationKind },
      ],
      units: current.units || {},
    };
    await updateGraphState(nextGraph);
  };

  const handleRunDiagnostics = async () => {
    if (!graphId) {
      return;
    }
    setIsRunningDiagnostics(true);
    logConsole("Diagnostics: request sent");
    try {
      const result = await runDiagnostics(graphId);
      setDiagnostics(result);
      setDiagnosticFocus([]);
      logConsole(
        `Diagnostics: ${result.node_count ?? "-"} nodes, ${result.relation_count ?? "-"} relations`,
      );
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleRunCredibility = async () => {
    if (!graphId) {
      return;
    }
    setIsRunningCredibility(true);
    logConsole("Credibility: propagation started");
    try {
      const result = await runCredibility(graphId);
      setCredibility(result);
      logConsole(
        `Credibility: iterations ${Array.isArray(result.iterations) ? result.iterations.length : "-"}`,
      );
      const scores =
        (result.final_scores as Record<string, number> | undefined) ?? {};
      const current = graphRef.current;
      if (current && Object.keys(scores).length) {
        const nextUnits = { ...current.units };
        for (const [unitId, score] of Object.entries(scores)) {
          const unit = nextUnits[unitId];
          if (!unit) {
            continue;
          }
          nextUnits[unitId] = {
            ...unit,
            metadata: {
              ...(unit.metadata ?? {}),
              claim_credibility_propagated: score,
            },
          };
        }
        await updateGraphState({
          ...current,
          units: nextUnits,
        });
        logConsole("Credibility: propagated scores applied to graph");
      }
    } finally {
      setIsRunningCredibility(false);
    }
  };

  const handleMineText = async () => {
    if (!miningText.trim()) {
      return;
    }
    setMiningError("");
    setIsMining(true);
    logConsole(`Mining: ${llmProvider}/${llmModel}`);
    try {
      const response = await parseMining({
        text: miningText,
        doc_id: miningDocId.trim() ? miningDocId.trim() : undefined,
        provider: llmProvider,
        model: llmModel,
        use_llm: true,
        long_document: true,
      });
      setGraphId(response.id);
      setGraph(response.payload as GraphData);
      setSelection(null);
      setDiagnostics(null);
      setCredibility(null);
      setReasoning(null);
      setReasonerResults(null);
      const trace = (
        (response.payload as GraphData)?.metadata?.mining as
          | Record<string, unknown>
          | undefined
      )?.trace;
      if (Array.isArray(trace)) {
        trace.forEach((entry) => logConsole(`Mining: ${String(entry)}`));
      }
      logConsole(`Mining: graph ${response.id} created`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Mining request failed.";
      setMiningError(message);
      logConsole(`Mining failed: ${message}`);
    } finally {
      setIsMining(false);
    }
  };

  const handleMineUrl = async () => {
    if (!miningUrl.trim()) {
      return;
    }
    setMiningError("");
    setIsMining(true);
    logConsole(`Mining URL: ${llmProvider}/${llmModel}`);
    try {
      const response = await parseMiningUrl({
        url: miningUrl.trim(),
        doc_id: miningDocId.trim() ? miningDocId.trim() : undefined,
        provider: llmProvider,
        model: llmModel,
        use_llm: true,
        long_document: true,
        include_links: miningIncludeLinks,
      });
      setGraphId(response.id);
      setGraph(response.payload as GraphData);
      setSelection(null);
      setDiagnostics(null);
      setCredibility(null);
      setReasoning(null);
      setReasonerResults(null);
      const trace = (
        (response.payload as GraphData)?.metadata?.mining as
          | Record<string, unknown>
          | undefined
      )?.trace;
      if (Array.isArray(trace)) {
        trace.forEach((entry) => logConsole(`Mining: ${String(entry)}`));
      }
      logConsole(`Mining URL: graph ${response.id} created`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Mining request failed.";
      setMiningError(message);
      logConsole(`Mining URL failed: ${message}`);
    } finally {
      setIsMining(false);
    }
  };

  const handleScoreClaim = async () => {
    if (!graphId || !selection || selection.type !== "node") {
      return;
    }
    setLlmError("");
    setIsScoringClaim(true);
    logConsole(`LLM scoring: ${selection.id} (${llmProvider}/${llmModel})`);
    try {
      const result = await scoreClaimConfidence(graphId, selection.id, {
        provider: llmProvider,
        model: llmModel,
      });
      setLlmResult(result);
      logConsole(
        `LLM scoring: ${selection.id} score ${result.score.toFixed(2)} (${result.score_source ?? "llm"})`,
      );
      const data = await getGraph(graphId);
      setGraph(data.payload as GraphData);
      await handleRunCredibility();
    } catch (error) {
      setLlmError(error instanceof Error ? error.message : "LLM scoring failed.");
      logConsole(
        `LLM scoring failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setIsScoringClaim(false);
    }
  };

  const handleRunReasoning = async (
    semantics: "grounded" | "preferred" | "stable" | "complete" | "labelings",
  ) => {
    if (!graphId) {
      return;
    }
    setReasoningError("");
    setConsoleEntries((prev) => [
      {
        ts: new Date().toLocaleTimeString(),
        message: `Reasoning requested: ${semantics}`,
      },
      ...prev,
    ]);
    try {
      const result = await runReasoning(graphId, { semantics });
      setReasoning(result);
      logConsole(
        `Reasoning: ${semantics} returned ${result.extensions?.length ?? 0} extensions`,
      );
    } catch (error) {
      setReasoningError(
        error instanceof Error ? error.message : "Reasoning failed.",
      );
      logConsole(
        `Reasoning failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  };

  const handleRunReasonerPack = async () => {
    if (!graphId) {
      return;
    }
    setReasonerError("");
    setConsoleEntries((prev) => [
      {
        ts: new Date().toLocaleTimeString(),
        message: `Reasoner pack requested (${reasonerTasks.length} tasks)`,
      },
      ...prev,
    ]);
    try {
      const result = await runReasoner(graphId, {
        tasks: reasonerTasks,
      });
      setReasonerResults(result);
      logConsole(`Reasoner pack: completed ${reasonerTasks.length} tasks`);
    } catch (error) {
      setReasonerError(
        error instanceof Error ? error.message : "Reasoner failed.",
      );
      logConsole(
        `Reasoner pack failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  };

  const renderReasonerResult = (key: string, value: unknown) => {
    if (key === "credibility_propagation" && value) {
      const payload = value as Record<string, unknown>;
      const scores = (payload.final_scores as Record<string, number>) ?? {};
      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 3);
      const bottom = sorted.slice(-3).reverse();
      return (
        <div className="stat-card" key={key}>
          <div className="stat-label">Credibility</div>
          <div className="stat-value">
            {sorted.length ? "Computed" : "None"}
          </div>
          <div className="muted">
            Top:{" "}
            {top.length
              ? top.map(([id, score]) => `${id}(${score.toFixed(2)})`).join(", ")
              : "n/a"}
          </div>
          <div className="muted">
            Bottom:{" "}
            {bottom.length
              ? bottom
                  .map(([id, score]) => `${id}(${score.toFixed(2)})`)
                  .join(", ")
              : "n/a"}
          </div>
        </div>
      );
    }

    if (
      [
        "grounded_extension",
        "preferred_extensions",
        "stable_extensions",
        "complete_extensions",
      ].includes(key)
    ) {
      const extensions = Array.isArray(value) ? value : [];
      return (
        <div className="stat-card" key={key}>
          <div className="stat-label">{key.replace("_", " ")}</div>
          <div className="stat-value">{extensions.length}</div>
          <div className="muted">
            {extensions
              .map((ext: unknown) =>
                Array.isArray(ext) ? `[${ext.join(", ")}]` : "",
              )
              .filter(Boolean)
              .join(" ")}
          </div>
        </div>
      );
    }

    if (key === "grounded_labeling" && value) {
      const labeling = value as Record<string, string>;
      const entries = Object.entries(labeling);
      return (
        <div className="stat-card" key={key}>
          <div className="stat-label">Grounded labeling</div>
          <div className="stat-value">{entries.length}</div>
          <div className="muted">
            {entries
              .slice(0, 8)
              .map(([id, label]) => `${id}:${label}`)
              .join(", ")}
          </div>
        </div>
      );
    }

    if (key === "aba_dispute_trees" && value) {
      const trees = value as Record<string, unknown>;
      return (
        <div className="stat-card" key={key}>
          <div className="stat-label">ABA dispute trees</div>
          <div className="stat-value">{Object.keys(trees).length}</div>
          <div className="muted">Targets computed</div>
        </div>
      );
    }

    return (
      <div className="stat-card" key={key}>
        <div className="stat-label">{key}</div>
        <div className="stat-value">Ready</div>
        <div className="muted">Result available</div>
      </div>
    );
  };

  const handleAddDocument = async () => {
    if (!graphId || !docName || !docUrl) {
      return;
    }
    const id = `doc_${Date.now()}`;
    await addSupportingDocument(graphId, {
      payload: { id, name: docName, type: docType, url: docUrl },
    });
    const next = await listSupportingDocuments(graphId);
    setDocs(next);
    setDocName("");
    setDocUrl("");
    setDocType("pdf");
  };

  const ensureUnassignedDoc = async () => {
    if (!graphId) {
      return "unassigned";
    }
    if (docs.unassigned) {
      return "unassigned";
    }
    await addSupportingDocument(graphId, {
      payload: {
        id: "unassigned",
        name: "Unassigned",
        type: "unknown",
        url: "about:blank",
      },
    });
    const next = await listSupportingDocuments(graphId);
    setDocs(next);
    return "unassigned";
  };

  const handleAddCard = async () => {
    if (!graphId || !cardExcerpt) {
      return;
    }
    const docId = cardDocId || (await ensureUnassignedDoc());
    const titleValue = cardTitle || cardExcerpt.slice(0, 80);
    const id = `card_${Date.now()}`;
    await addEvidenceCard(graphId, {
      payload: {
        id,
        title: titleValue,
        supporting_doc_id: docId,
        excerpt: cardExcerpt,
        confidence: cardConfidence,
      },
    });
    const next = await listEvidenceCards(graphId);
    setCards(next);
    setCardTitle("");
    setCardExcerpt("");
    setCardConfidence(1.0);
  };

  const handleAttachEvidence = async (unitId: string) => {
    if (!graphId || !attachCardId) {
      return;
    }
    await attachEvidenceCard(graphId, unitId, attachCardId);
    const data = await getGraph(graphId);
    setGraph(data.payload as GraphData);
  };

  const handleQuickAttach = async (unitId: string, cardId: string) => {
    if (!graphId) {
      return;
    }
    await attachEvidenceCard(graphId, unitId, cardId);
    const data = await getGraph(graphId);
    setGraph(data.payload as GraphData);
  };

  const handleDeleteClaim = async () => {
    const current = graphRef.current;
    if (!current || !selection || selection.type !== "node") {
      return;
    }
    const nextUnits = { ...current.units };
    delete nextUnits[selection.id];
    const nextRelations = (current.relations || []).filter(
      (rel) => rel.src !== selection.id && rel.dst !== selection.id,
    );
    await updateGraphState({
      ...current,
      units: nextUnits,
      relations: nextRelations,
    });
    setSelection(null);
  };

  const handleDeleteEdge = async () => {
    const current = graphRef.current;
    if (!current || !selection || selection.type !== "edge") {
      return;
    }
    const index = Number(selection.id.replace("e", ""));
    const nextRelations = (current.relations || []).filter(
      (_rel, idx) => idx !== index,
    );
    await updateGraphState({
      ...current,
      relations: nextRelations,
    });
    setSelection(null);
  };

  const topHeight = Math.max(
    0,
    layoutSize.height - bottomHeight - SPLITTER_SIZE,
  );
  const leftBottomHeight = Math.max(
    LAYOUT_MIN.panelHeight,
    topHeight - leftTopHeight - SPLITTER_SIZE,
  );
  const rightBottomHeight = Math.max(
    LAYOUT_MIN.panelHeight,
    topHeight - rightTopHeight - SPLITTER_SIZE,
  );
  const centerWidth = Math.max(
    LAYOUT_MIN.centerWidth,
    layoutSize.width - leftWidth - rightWidth - SPLITTER_SIZE * 2,
  );

  const resetLayouts = () => {
    setLeftWidth(DEFAULT_LAYOUT.leftWidth);
    setRightWidth(DEFAULT_LAYOUT.rightWidth);
    setBottomHeight(DEFAULT_LAYOUT.bottomHeight);
    setLeftTopHeight(DEFAULT_LAYOUT.leftTopHeight);
    setRightTopHeight(DEFAULT_LAYOUT.rightTopHeight);
  };

  useEffect(() => {
    resetLayouts();
  }, []);

  const getPanelStyle = (id: string) => {
    const centerX = leftWidth + SPLITTER_SIZE;
    const rightX = leftWidth + SPLITTER_SIZE + centerWidth + SPLITTER_SIZE;
    if (id === "inspector") {
      return { left: 0, top: 0, width: leftWidth, height: leftTopHeight };
    }
    if (id === "evidence") {
      return {
        left: 0,
        top: leftTopHeight + SPLITTER_SIZE,
        width: leftWidth,
        height: leftBottomHeight,
      };
    }
    if (id === "canvas") {
      return {
        left: centerX,
        top: 0,
        width: centerWidth,
        height: topHeight,
      };
    }
    if (id === "summary") {
      return { left: rightX, top: 0, width: rightWidth, height: rightTopHeight };
    }
    if (id === "reasoning") {
      return {
        left: rightX,
        top: rightTopHeight + SPLITTER_SIZE,
        width: rightWidth,
        height: rightBottomHeight,
      };
    }
    return {
      left: 0,
      top: topHeight + SPLITTER_SIZE,
      width: layoutSize.width,
      height: bottomHeight,
    };
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>ArgLib UI</h1>
          <p>Graph authoring and analysis frontend.</p>
        </div>
        <div className="header-controls">
          <div className="status">
            <span className={`dot ${status}`}></span>
            <span>Server: {status}</span>
          </div>
          <div className="grid">
            <select
              className="input"
              value={llmProvider}
              onChange={(event) =>
                setLlmProvider(
                  event.target.value as "openai" | "anthropic" | "ollama",
                )
              }
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
            </select>
            <input
              className="input"
              placeholder="Model"
              value={llmModel}
              onChange={(event) => setLlmModel(event.target.value)}
            />
          </div>
          <button className="button button-compact" onClick={resetLayouts}>
            Reset Layout
          </button>
          <div className="dataset-controls">
            <input
              ref={graphFileRef}
              className="hidden-input"
              type="file"
              accept=".json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportGraphFile(file);
                }
              }}
            />
            <input
              ref={datasetFileRef}
              className="hidden-input"
              type="file"
              accept=".json,.jsonl"
              multiple
              onChange={(event) => {
                if (event.target.files?.length) {
                  void handleImportDatasetFiles(event.target.files, "file");
                }
              }}
            />
            <input
              ref={folderFileRef}
              className="hidden-input"
              type="file"
              multiple
              // @ts-expect-error webkitdirectory is supported in Chromium-based browsers.
              webkitdirectory=""
              onChange={(event) => {
                if (event.target.files?.length) {
                  void handleImportDatasetFiles(event.target.files, "folder");
                }
              }}
            />
            <button
              className="button button-compact"
              onClick={() => graphFileRef.current?.click()}
            >
              Import Graph
            </button>
            <button
              className="button button-compact"
              onClick={() => datasetFileRef.current?.click()}
            >
              Import Dataset
            </button>
            <button
              className="button button-compact"
              onClick={() => folderFileRef.current?.click()}
            >
              Import Folder
            </button>
            <button className="button button-compact" onClick={handleDownloadGraph}>
              Download Graph
            </button>
            <input
              className="input"
              placeholder="Dataset path"
              value={datasetPath}
              onChange={(event) => setDatasetPath(event.target.value)}
            />
            <button
              className="button"
              onClick={async () => {
                setDatasetError("");
                try {
                  const response = await loadDataset({
                    path: datasetPath,
                    limit: 50,
                  });
                  const nextItems = buildDatasetItems(
                    response.items ?? [],
                    "path",
                  );
                  setDatasetItems(nextItems);
                  setDatasetCount(response.count ?? nextItems.length);
                  setSelectedDatasetId("");
                  setDatasetSource("path");
                } catch (error) {
                  setDatasetItems([]);
                  setDatasetCount(0);
                  setSelectedDatasetId("");
                  setDatasetSource("");
                  setDatasetError(
                    error instanceof Error ? error.message : "Load failed.",
                  );
                }
              }}
            >
              Load Dataset
            </button>
            <select
              className="input"
              value={selectedDatasetId}
              onChange={(event) => setSelectedDatasetId(event.target.value)}
            >
              <option value="">Select a graph</option>
              {datasetItems.map((item) => {
                const id = item.id;
                const label = item.label || "Graph";
                return (
                  <option key={id} value={id}>
                    {label} - {id}
                  </option>
                );
              })}
            </select>
            <button
              className="button"
              onClick={async () => {
                if (!selectedDatasetId) {
                  return;
                }
                const localItem = datasetItems.find(
                  (item) => item.id === selectedDatasetId,
                );
                if (localItem?.payload) {
                  await applyImportedGraph(localItem.payload);
                  logConsole(`Loaded local graph: ${selectedDatasetId}`);
                  return;
                }
                const data = await getGraph(selectedDatasetId);
                setGraphId(data.id);
                setGraph(data.payload as GraphData);
              }}
            >
              Load Graph
            </button>
            <div className="dataset-status">
              {datasetError && <span>Dataset error: {datasetError}</span>}
              {!datasetError && (
                <span>
                  Loaded graphs: {datasetCount}
                  {datasetSource ? ` (${datasetSource})` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="workspace">
        <div className="panel-board" ref={panelBoardRef}>
          <section
            className="panel-window panel-theme-canvas"
            style={getPanelStyle("canvas")}
          >
            <div className="panel-header">
              <h2>Canvas</h2>
            </div>
            <div className="panel-body panel-body-canvas">
              <GraphCanvas
                elements={elements}
                highlightNodes={highlightNodes}
                onSelect={setSelection}
                onAddEdge={(src, dst) => handleAddRelation(src, dst)}
                onAddNode={() => handleAddClaim("New claim")}
              />
            </div>
          </section>
          <section
            className="panel-window panel-theme-1"
            style={getPanelStyle("inspector")}
          >
            <div className="panel-header">
              <h2>Inspector</h2>
            </div>
            <div className="panel-body">
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
                const current = graphRef.current;
                if (!current || !selection) {
                  return;
                }
                    const nextGraph = {
                      ...current,
                      units: {
                        ...current.units,
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
            <button className="button" onClick={handleDeleteClaim}>
              Delete Claim
            </button>
          </div>
              <div className="panel-section">
                <h3>Attached Evidence</h3>
                <div className="list">
                  {graph?.units?.[selection.id]?.evidence_ids?.length ? (
                    graph.units[selection.id].evidence_ids?.map((cardId) => {
                      const card = cards[cardId] as Record<string, unknown>;
                      return (
                        <div className="list-item" key={cardId}>
                          <strong>{String(card?.title ?? cardId)}</strong>
                          <div className="muted">
                            {String(card?.excerpt ?? "")}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="list-item">No evidence attached.</div>
                  )}
                </div>
              </div>
              <div className="panel-section">
                <h3>Quick Attach</h3>
                <div className="list">
                  {Object.entries(cards).map(([cardId, cardValue]) => {
                    const card = cardValue as Record<string, unknown>;
                    const attached =
                      graph?.units?.[selection.id]?.evidence_ids?.includes(
                        cardId,
                      );
                    return (
                      <div className="list-item list-row" key={cardId}>
                        <div>
                          <strong>{String(card?.title ?? cardId)}</strong>
                          <div className="muted">
                            {String(card?.excerpt ?? "")}
                          </div>
                        </div>
                        <button
                          className="button button-compact"
                          disabled={attached}
                          onClick={() =>
                            handleQuickAttach(selection.id, cardId)
                          }
                        >
                          {attached ? "Attached" : "Attach"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="panel-section">
                <h3>LLM Claim Confidence</h3>
                <div className="grid">
                  <button
                    className="button"
                    onClick={handleScoreClaim}
                    disabled={isScoringClaim}
                  >
                    {isScoringClaim ? "Scoring..." : "Score Claim"}
                  </button>
                </div>
                {llmError && <div className="list-item">Error: {llmError}</div>}
                {llmResult && (
                  <div className="list-item">
                    {(() => {
                      const classification = getScoreClassification(
                        llmResult.score,
                      );
                      return (
                        <div
                          className="confidence-pill"
                          style={{
                            color: classification.color,
                            background: classification.bgColor,
                            borderColor: classification.borderColor,
                          }}
                        >
                          {classification.label} - {llmResult.score.toFixed(2)}
                        </div>
                      );
                    })()}
                    <div className="muted">{llmResult.rationale}</div>
                  </div>
                )}
              </div>
              <div className="panel-section">
                <h3>Claim Type (LLM)</h3>
                <div className="grid">
                  <button
                    className="button"
                    onClick={async () => {
                      if (!graphId || !selection) {
                        return;
                      }
                      setClaimTypeError("");
                      setIsClassifyingClaim(true);
                      try {
                        const response = await classifyClaimType(
                          graphId,
                          selection.id,
                          {
                            provider: llmProvider,
                            model: llmModel,
                          },
                        );
                        setClaimTypeResult(response);
                        const data = await getGraph(graphId);
                        setGraph(data.payload as GraphData);
                        logConsole(
                          `Claim type: ${selection.id} -> ${response.claim_type} (${response.confidence ?? "n/a"})`,
                        );
                      } catch (error) {
                        setClaimTypeError(
                          error instanceof Error
                            ? error.message
                            : "Claim type failed.",
                        );
                        logConsole(
                          `Claim type failed: ${error instanceof Error ? error.message : "unknown error"}`,
                        );
                      } finally {
                        setIsClassifyingClaim(false);
                      }
                    }}
                    disabled={isClassifyingClaim}
                  >
                    {isClassifyingClaim ? "Classifying..." : "Classify Claim"}
                  </button>
                </div>
                {claimTypeError && (
                  <div className="list-item">Error: {claimTypeError}</div>
                )}
                {claimTypeResult && (
                  <div className="list-item">
                    <strong>{claimTypeResult.claim_type}</strong>
                    {typeof claimTypeResult.confidence === "number" && (
                      <div className="muted">
                        Confidence: {claimTypeResult.confidence.toFixed(2)}
                      </div>
                    )}
                    {claimTypeResult.rationale && (
                      <div className="muted">{claimTypeResult.rationale}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="panel-section">
                <h3>Manual Claim Credibility</h3>
                <div className="grid">
                  <input
                    className="input"
                    type="number"
                    min="-1"
                    max="1"
                    step="0.01"
                    placeholder="-1.00 to 1.00"
                    value={manualClaimScore}
                    onChange={(event) => setManualClaimScore(event.target.value)}
                  />
                  <button
                    className="button"
                    onClick={async () => {
                      if (!selection || selection.type !== "node") {
                        return;
                      }
                      const score = Number(manualClaimScore);
                      if (!Number.isFinite(score) || score < -1 || score > 1) {
                        return;
                      }
                      const current = graphRef.current;
                      if (!current) {
                        return;
                      }
                      const unit = current.units[selection.id];
                      const nextUnit = {
                        ...unit,
                        metadata: {
                          ...(unit.metadata ?? {}),
                          claim_credibility: score,
                          claim_credibility_method: "manual",
                        },
                      };
                      await updateGraphState({
                        ...current,
                        units: {
                          ...current.units,
                          [selection.id]: nextUnit,
                        },
                      });
                      await handleRunCredibility();
                    }}
                  >
                    Set Manual Score
                  </button>
                  <button
                    className="button"
                    onClick={async () => {
                      if (!selection || selection.type !== "node") {
                        return;
                      }
                      const current = graphRef.current;
                      if (!current) {
                        return;
                      }
                      const unit = current.units[selection.id];
                      const nextMeta = { ...(unit.metadata ?? {}) };
                      delete nextMeta.claim_credibility;
                      delete nextMeta.claim_credibility_method;
                      await updateGraphState({
                        ...current,
                        units: {
                          ...current.units,
                          [selection.id]: { ...unit, metadata: nextMeta },
                        },
                      });
                      setManualClaimScore("");
                      await handleRunCredibility();
                    }}
                  >
                    Clear Manual
                  </button>
                </div>
                <div className="muted">
                  Manual scores are overwritten when LLM scoring runs.
                </div>
              </div>
              <div className="panel-section">
                <h3>Credibility Breakdown</h3>
                {(() => {
                  const metadata = graph?.units?.[selection.id]?.metadata ?? {};
                  const claimScore =
                    typeof metadata.claim_credibility === "number"
                      ? metadata.claim_credibility
                      : null;
                  const weightedScore =
                    typeof metadata.claim_credibility_weighted === "number"
                      ? metadata.claim_credibility_weighted
                      : null;
                  const method =
                    typeof metadata.claim_credibility_method === "string"
                      ? metadata.claim_credibility_method
                      : "";
                  const propagatedScore =
                    typeof metadata.claim_credibility_propagated === "number"
                      ? metadata.claim_credibility_propagated
                      : null;
                  const allPropagated = Object.entries(graph?.units ?? {})
                    .map(([unitId, unit]) => {
                      const unitMeta =
                        (unit as { metadata?: Record<string, unknown> })
                          .metadata ?? {};
                      const value =
                        typeof unitMeta.claim_credibility_propagated ===
                        "number"
                          ? unitMeta.claim_credibility_propagated
                          : null;
                      return { unitId, value };
                    })
                    .filter((entry) => entry.value !== null) as Array<{
                    unitId: string;
                    value: number;
                  }>;
                  const evidence = Array.isArray(
                    metadata.claim_credibility_evidence,
                  )
                    ? (metadata.claim_credibility_evidence as EvidenceMeta[])
                    : [];
                  if (claimScore === null && weightedScore === null) {
                    return (
                      <div className="list-item">
                        No credibility data yet.
                      </div>
                    );
                  }
                  return (
                    <div className="list">
                      <div className="list-item">
                        Claim score:{" "}
                        {claimScore !== null ? claimScore.toFixed(2) : "n/a"}
                      </div>
                      <div className="list-item">
                        Propagated score:{" "}
                        {propagatedScore !== null
                          ? propagatedScore.toFixed(2)
                          : "n/a"}
                      </div>
                      {allPropagated.length ? (
                        <div className="list">
                          <div className="list-item">
                            <strong>All propagated scores</strong>
                          </div>
                          {allPropagated.map((entry) => (
                            <div
                              className="list-item"
                              key={`prop-${entry.unitId}`}
                            >
                              {entry.unitId}: {entry.value.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="list-item">
                        Weighted score:{" "}
                        {weightedScore !== null
                          ? weightedScore.toFixed(2)
                          : "n/a"}
                      </div>
                      {method && (
                        <div className="list-item">Method: {method}</div>
                      )}
                      {evidence.length ? (
                        <div className="list">
                          {evidence.map((item, index) => (
                            <div
                              className="list-item"
                              key={`${item.evidence_id ?? "e"}-${index}`}
                            >
                              <strong>
                                {String(item.evidence_id ?? "evidence")}
                              </strong>
                              <div className="muted">
                                Trust:{" "}
                                {Number(item.trust ?? 0).toFixed(2)} | Score:{" "}
                                {Number(item.score ?? 0).toFixed(2)}
                              </div>
                              {item.rationale && (
                                <div className="muted">
                                  {String(item.rationale)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="list-item">No evidence scores.</div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="grid">
                <select
                  className="input"
                  value={attachCardId}
                  onChange={(event) => setAttachCardId(event.target.value)}
                >
                  <option value="">Select evidence card</option>
                  {Object.entries(cards).map(([cardKey, cardValue]) => {
                    const title = String(
                      (cardValue as Record<string, unknown>)?.title ?? cardKey,
                    );
                    return (
                      <option key={cardKey} value={cardKey}>
                        {title}
                      </option>
                    );
                  })}
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
                  const current = graphRef.current;
                  if (!current || !selection) {
                    return;
                  }
                  const nextGraph = {
                    ...current,
                    relations: (current.relations || []).map((rel, idx) => {
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
              <button className="button" onClick={handleDeleteEdge}>
                Delete Edge
              </button>
              <div className="list-item">
                Weight:{" "}
                {(() => {
                  const current = graphRef.current;
                  const idx = Number(selection.id.replace("e", ""));
                  const rel = current?.relations?.[idx];
                  return typeof rel?.weight === "number"
                    ? rel.weight.toFixed(2)
                    : "n/a";
                })()}
              </div>
            </div>
          )}
          {selection?.type === "edge" && (
            <div className="panel-section">
              <h3>Edge Validation (LLM)</h3>
              <div className="grid">
                <button
                  className="button"
                  onClick={async () => {
                    if (!graphId || !selection) {
                      return;
                    }
                    setEdgeValidationError("");
                    setIsValidatingEdge(true);
                    try {
                      const response = await validateEdge(
                        graphId,
                        selection.id,
                        {
                          provider: llmProvider,
                          model: llmModel,
                        },
                      );
                      setEdgeValidation(response);
                      const data = await getGraph(graphId);
                      setGraph(data.payload as GraphData);
                      await handleRunCredibility();
                      logConsole(
                        `Edge validation: ${selection.id} ${response.evaluation} ${response.score.toFixed(2)}`,
                      );
                    } catch (error) {
                      setEdgeValidationError(
                        error instanceof Error
                          ? error.message
                          : "Edge validation failed.",
                      );
                      logConsole(
                        `Edge validation failed: ${error instanceof Error ? error.message : "unknown error"}`,
                      );
                    } finally {
                      setIsValidatingEdge(false);
                    }
                  }}
                  disabled={isValidatingEdge}
                >
                  {isValidatingEdge ? "Validating..." : "Validate Edge"}
                </button>
              </div>
              {edgeValidationError && (
                <div className="list-item">Error: {edgeValidationError}</div>
              )}
              {edgeValidation && (
                <div className="list-item">
                  <strong>{edgeValidation.evaluation}</strong>{" "}
                  ({edgeValidation.score.toFixed(2)})
                  {edgeValidation.rationale && (
                    <div className="muted">{edgeValidation.rationale}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {selection?.type === "edge" && (
            <div className="panel-section">
              <h3>Implicit Assumptions (LLM)</h3>
              <div className="grid">
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="8"
                  value={edgeAssumptionCount}
                  onChange={(event) =>
                    setEdgeAssumptionCount(Number(event.target.value))
                  }
                />
                <button
                  className="button"
                  onClick={async () => {
                    if (!graphId || !selection) {
                      return;
                    }
                    setEdgeAssumptionsError("");
                    setIsGeneratingAssumptions(true);
                    try {
                      const response = await generateEdgeAssumptions(
                        graphId,
                        selection.id,
                        {
                          provider: llmProvider,
                          model: llmModel,
                          k: edgeAssumptionCount,
                        },
                      );
                      setEdgeAssumptions(response);
                      logConsole(
                        `Assumptions: ${selection.id} generated ${response.assumptions.length}`,
                      );
                    } catch (error) {
                      setEdgeAssumptionsError(
                        error instanceof Error
                          ? error.message
                          : "Assumption generation failed.",
                      );
                      logConsole(
                        `Assumptions failed: ${error instanceof Error ? error.message : "unknown error"}`,
                      );
                    } finally {
                      setIsGeneratingAssumptions(false);
                    }
                  }}
                  disabled={isGeneratingAssumptions}
                >
                  {isGeneratingAssumptions
                    ? "Generating..."
                    : "Generate Assumptions"}
                </button>
              </div>
              {edgeAssumptionsError && (
                <div className="list-item">Error: {edgeAssumptionsError}</div>
              )}
              {edgeAssumptions && (
                <div className="list">
                  {edgeAssumptions.assumptions.length ? (
                    edgeAssumptions.assumptions.map((item, index) => (
                      <div className="list-item" key={`assump-${index}`}>
                        <strong>{item.assumption}</strong>
                        {item.rationale && (
                          <div className="muted">
                            {String(item.rationale)}
                          </div>
                        )}
                        {typeof item.importance === "number" && (
                          <div className="muted">
                            Importance: {item.importance.toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="list-item">No assumptions returned.</div>
                  )}
                </div>
              )}
            </div>
          )}
            </div>
          </section>
          <section
            className="panel-window panel-theme-2"
            style={getPanelStyle("evidence")}
          >
            <div className="panel-header">
              <h2>Evidence</h2>
            </div>
            <div className="panel-body">
            <div className="panel-section">
              <h3>Supporting Documents</h3>
              <div className="grid">
                <input
                  className="input"
                  placeholder="Doc name"
                  value={docName}
                  onChange={(event) => setDocName(event.target.value)}
                />
                <select
                  className="input"
                  value={docType}
                  onChange={(event) => setDocType(event.target.value)}
                >
                  <option value="pdf">pdf</option>
                  <option value="image">image</option>
                  <option value="text">text</option>
                  <option value="doc">doc</option>
                  <option value="other">other</option>
                </select>
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
              <div className="list">
                {Object.entries(docs).map(([docId, docValue]) => {
                  const doc = docValue as Record<string, unknown>;
                  return (
                    <div className="list-item list-row" key={docId}>
                      <div>
                        <strong>{String(doc.name ?? docId)}</strong>
                        <div className="muted">
                          {String(doc.type ?? "doc")} - {docId}
                        </div>
                      </div>
                      <button
                        className="button button-compact"
                        onClick={() => setCardDocId(docId)}
                      >
                        Use
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel-section evidence-panel">
              <h3>Evidence Cards</h3>
              <input
                className="input"
                placeholder="Search evidence..."
                value={evidenceQuery}
                onChange={(event) => setEvidenceQuery(event.target.value)}
              />
              <div className="grid">
                <label className="field">
                  <span>Title (optional)</span>
                  <input
                    className="input"
                    placeholder="Title"
                    value={cardTitle}
                    onChange={(event) => setCardTitle(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Supporting document (optional)</span>
                  <select
                    className="input"
                    value={cardDocId}
                    onChange={(event) => setCardDocId(event.target.value)}
                  >
                    <option value="">Support doc (optional)</option>
                    {Object.entries(docs).map(([docId, docValue]) => {
                      const doc = docValue as Record<string, unknown>;
                      const docName = String(doc["name"] ?? docId);
                      return (
                        <option key={docId} value={docId}>
                          {docName}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="field">
                  <span>Excerpt</span>
                  <textarea
                    className="input textarea"
                    placeholder="Evidence excerpt"
                    value={cardExcerpt}
                    onChange={(event) => setCardExcerpt(event.target.value)}
                  />
                </label>
                {cardDocId && (
                  <div className="muted">
                    Using:{" "}
                    {String(
                      (docs[cardDocId] as Record<string, unknown> | undefined)
                        ?.name ?? cardDocId,
                    )}
                  </div>
                )}
                <label className="field range-field">
                  <span>Confidence</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={cardConfidence}
                    onChange={(event) =>
                      setCardConfidence(Number(event.target.value))
                    }
                  />
                  <span>{cardConfidence.toFixed(2)}</span>
                </label>
                <button className="button" onClick={handleAddCard}>
                  Add Evidence
                </button>
              </div>
              <div className="list">
                {Object.entries(docs).map(([docId, docValue]) => {
                  const doc = docValue as Record<string, unknown>;
                  const docName = String(doc.name ?? docId);
                  const docCards = Object.entries(cards).filter(
                    ([, cardValue]) =>
                      String(
                        (cardValue as Record<string, unknown>)
                          ?.supporting_doc_id ?? "",
                      ) === docId,
                  );
                  const filtered = docCards.filter(([cardId, cardValue]) => {
                    const card = cardValue as Record<string, unknown>;
                    const haystack = `${cardId} ${card.title ?? ""} ${card.excerpt ?? ""} ${docName}`.toLowerCase();
                    return haystack.includes(evidenceQuery.toLowerCase());
                  });
                  if (!filtered.length) {
                    return null;
                  }
                  return (
                    <div className="list-group" key={docId}>
                      <div className="list-group-title">{docName}</div>
                      {filtered.map(([cardId, cardValue]) => {
                        const card = cardValue as Record<string, unknown>;
                        return (
                          <div className="list-item" key={cardId}>
                            <strong>{String(card.title ?? cardId)}</strong>
                            <div className="muted">
                              {docName} -{" "}
                              {Number(card.confidence ?? 0).toFixed(2)}
                            </div>
                            <div className="muted">
                              {String(card.excerpt ?? "")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {Object.entries(cards).some(([_, cardValue]) => {
                  const card = cardValue as Record<string, unknown>;
                  return !card.supporting_doc_id;
                }) && (
                  <div className="list-group">
                    <div className="list-group-title">Unassigned</div>
                    {Object.entries(cards)
                      .filter(([_, cardValue]) => {
                        const card = cardValue as Record<string, unknown>;
                        return !card.supporting_doc_id;
                      })
                      .filter(([cardId, cardValue]) => {
                        const card = cardValue as Record<string, unknown>;
                        const haystack = `${cardId} ${card.title ?? ""} ${card.excerpt ?? ""}`.toLowerCase();
                        return haystack.includes(evidenceQuery.toLowerCase());
                      })
                      .map(([cardId, cardValue]) => {
                        const card = cardValue as Record<string, unknown>;
                        return (
                          <div className="list-item" key={cardId}>
                            <strong>{String(card.title ?? cardId)}</strong>
                            <div className="muted">
                              Unassigned -{" "}
                              {Number(card.confidence ?? 0).toFixed(2)}
                            </div>
                            <div className="muted">
                              {String(card.excerpt ?? "")}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                {Object.keys(docs).length === 0 && (
                  <div className="list-item">No supporting documents yet.</div>
                )}
              </div>
            </div>
            </div>
          </section>
          <section
            className="panel-window panel-theme-3"
            style={getPanelStyle("summary")}
          >
            <div className="panel-header">
              <h2>Summary</h2>
            </div>
            <div className="panel-body">
            <div className="summary-actions">
              <button
                className="button"
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
              >
                Run Diagnostics
              </button>
              <button
                className="button"
                onClick={handleRunCredibility}
                disabled={isRunningCredibility}
              >
                Run Credibility
              </button>
              {(isRunningDiagnostics || isRunningCredibility) && (
                <span className="status-pill">Thinking...</span>
              )}
            </div>
            <div className="summary-section">
              <h3>Diagnostics Highlights</h3>
              <div className="list">
                <label className="list-item checkbox-row">
                  <input
                    type="checkbox"
                    checked={highlightIsolated}
                    onChange={(event) => setHighlightIsolated(event.target.checked)}
                  />
                  <span>Highlight isolated nodes</span>
                </label>
                <label className="list-item checkbox-row">
                  <input
                    type="checkbox"
                    checked={highlightUnsupported}
                    onChange={(event) =>
                      setHighlightUnsupported(event.target.checked)
                    }
                  />
                  <span>Highlight unsupported nodes</span>
                </label>
                <div className="summary-actions">
                  <button
                    className="button button-compact"
                    onClick={() => setDiagnosticFocus([])}
                  >
                    Clear focus
                  </button>
                </div>
              </div>
              {Array.isArray(diagnostics?.cycles) && diagnostics?.cycles.length ? (
                <div className="list">
                  {diagnostics.cycles.map((cycle: string[], index: number) => (
                    <div className="list-item list-row" key={`cycle-${index}`}>
                      <div>Cycle {index + 1}: {cycle.join(", ")}</div>
                      <button
                        className="button button-compact"
                        onClick={() => setDiagnosticFocus(cycle)}
                      >
                        Highlight
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {Array.isArray(diagnostics?.strongly_connected_components) &&
              diagnostics?.strongly_connected_components.length ? (
                <div className="list">
                  {diagnostics.strongly_connected_components.map(
                    (group: string[], index: number) => (
                      <div className="list-item list-row" key={`scc-${index}`}>
                        <div>SCC {index + 1}: {group.join(", ")}</div>
                        <button
                          className="button button-compact"
                          onClick={() => setDiagnosticFocus(group)}
                        >
                          Highlight
                        </button>
                      </div>
                    ),
                  )}
                </div>
              ) : null}
            </div>
            <div className="summary-grid">
              <div className="stat-card">
                <div className="stat-label">Nodes</div>
                <div className="stat-value">
                  {String(diagnostics?.node_count ?? "-")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Relations</div>
                <div className="stat-value">
                  {String(diagnostics?.relation_count ?? "-")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Support</div>
                <div className="stat-value">
                  {String(diagnostics?.support_edge_count ?? "-")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Attack</div>
                <div className="stat-value">
                  {String(diagnostics?.attack_edge_count ?? "-")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Cycles</div>
                <div className="stat-value">
                  {String(diagnostics?.cycle_count ?? "-")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Components</div>
                <div className="stat-value">
                  {String(diagnostics?.component_count ?? "-")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">SCC</div>
                <div className="stat-value">
                  {String(diagnostics?.scc_count ?? "-")}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Max Reach</div>
                <div className="stat-value">
                  {String(diagnostics?.max_reachability ?? "-")}
                </div>
              </div>
            </div>
            <div className="summary-section">
              <h3>Quality Flags</h3>
              <div className="list">
                <div className="list-item">
                  Isolated:{" "}
                  {(diagnostics?.isolated_units as string[] | undefined)?.join(
                    ", ",
                  ) || "None"}
                </div>
                <div className="list-item">
                  Unsupported:{" "}
                  {(diagnostics?.unsupported_claims as string[] | undefined)?.join(
                    ", ",
                  ) || "None"}
                </div>
              </div>
            </div>
            <div className="summary-section">
              <h3>Degree Summary</h3>
              <div className="list">
                <div className="list-item">
                  Avg In:{" "}
                  {Number(
                    (diagnostics?.degree_summary as Record<string, number> | undefined)
                      ?.avg_in ?? 0,
                  ).toFixed(2)}
                  , Avg Out:{" "}
                  {Number(
                    (diagnostics?.degree_summary as Record<string, number> | undefined)
                      ?.avg_out ?? 0,
                  ).toFixed(2)}
                </div>
                <div className="list-item">
                  Max In:{" "}
                  {(diagnostics?.degree_summary as Record<string, number> | undefined)
                    ?.max_in ?? "-"}
                  , Max Out:{" "}
                  {(diagnostics?.degree_summary as Record<string, number> | undefined)
                    ?.max_out ?? "-"}
                </div>
              </div>
            </div>
            <div className="summary-section">
              <h3>Credibility</h3>
              <div className="list">
                {credibility ? (
                  (() => {
                    const scores = (
                      (credibility.final_scores as Record<string, number>) ?? {}
                    );
                    const entries = Object.entries(scores);
                    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
                    const top = sorted.slice(0, 3);
                    const bottom = sorted.slice(-3).reverse();
                    return (
                      <>
                        <div className="list-item">
                          Iterations:{" "}
                          {Array.isArray(credibility.iterations)
                            ? credibility.iterations.length
                            : "-"}
                        </div>
                        <div className="list-item">
                          Top:{" "}
                          {top.length
                            ? top
                                .map(
                                  ([id, score]) =>
                                    `${id} (${score.toFixed(2)})`,
                                )
                                .join(", ")
                            : "n/a"}
                        </div>
                        <div className="list-item">
                          Bottom:{" "}
                          {bottom.length
                            ? bottom
                                .map(
                                  ([id, score]) =>
                                    `${id} (${score.toFixed(2)})`,
                                )
                                .join(", ")
                            : "n/a"}
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="list-item">Run credibility to see scores.</div>
                )}
              </div>
            </div>
            <div className="summary-section">
              <h3>Argument Mining</h3>
              <div className="field">
                <input
                  className="input"
                  placeholder="Doc id (optional)"
                  value={miningDocId}
                  onChange={(event) => setMiningDocId(event.target.value)}
                />
              </div>
              <div className="field">
                <input
                  className="input"
                  placeholder="Article URL (https://...)"
                  value={miningUrl}
                  onChange={(event) => setMiningUrl(event.target.value)}
                />
              </div>
              <div className="field">
                <textarea
                  className="input textarea"
                  placeholder="Paste text to mine into a graph"
                  value={miningText}
                  onChange={(event) => setMiningText(event.target.value)}
                />
              </div>
              <div className="summary-actions">
                <button
                  className="button"
                  onClick={handleMineText}
                  disabled={isMining}
                >
                  Mine Text
                </button>
                <button
                  className="button"
                  onClick={handleMineUrl}
                  disabled={isMining}
                >
                  Mine URL
                </button>
                <label className="list-item checkbox-row">
                  <input
                    type="checkbox"
                    checked={miningIncludeLinks}
                    onChange={(event) =>
                      setMiningIncludeLinks(event.target.checked)
                    }
                  />
                  <span>Attach link sources</span>
                </label>
                {isMining && <span className="status-pill">Thinking...</span>}
              </div>
              {miningError && (
                <div className="list-item">Error: {miningError}</div>
              )}
            </div>
            </div>
          </section>
          <section
            className="panel-window panel-theme-4"
            style={getPanelStyle("reasoning")}
          >
            <div className="panel-header">
              <h2>Reasoning</h2>
            </div>
            <div className="panel-body">
            <div className="muted">
              Last run: {reasoning?.semantics ?? "none"}
            </div>
            {reasoning && (
              <pre className="code-block">
                {JSON.stringify(reasoning, null, 2)}
              </pre>
            )}
            <div className="reasoning-results list">
              {reasoningError && (
                <div className="list-item">Error: {reasoningError}</div>
              )}
              {!reasoning && !reasoningError && (
                <div className="list-item">
                  Run a semantics to view extensions.
                </div>
              )}
              {reasoning && (
                <div className="list-item">
                  <strong>{reasoning.semantics}</strong>
                  <div className="muted">
                    Arguments: {reasoning.arguments.length}
                  </div>
                </div>
              )}
              {reasoning?.extensions && reasoning.extensions.length === 0 && (
                <div className="list-item">No extensions returned.</div>
              )}
              {reasoning?.extensions &&
                reasoning.extensions.map((ext, idx) => (
                  <div
                    className="list-item"
                    key={`${reasoning.semantics}-${idx}`}
                  >
                    <div>Extension {idx + 1}: {ext.join(", ") || "none"}</div>
                    <button
                      className="button button-compact"
                      onClick={() => setReasoningHighlight(ext)}
                    >
                      Highlight
                    </button>
                  </div>
                ))}
              {reasoning && !reasoning.extensions && !reasoning.labeling && (
                <div className="list-item">
                  Result: {JSON.stringify(reasoning)}
                </div>
              )}
              {reasoning?.labeling && (
                <div className="list-item">
                  Labeling:{" "}
                  {Object.entries(reasoning.labeling ?? {})
                    .map(([id, label]) => `${id}:${label}`)
                    .join(", ")}
                </div>
              )}
            </div>
            <div className="summary-actions">
              <button
                className="button button-compact"
                onClick={() => setReasoningHighlight([])}
              >
                Clear highlight
              </button>
              {reasoning?.labeling && (
                <button
                  className="button button-compact"
                  onClick={() =>
                    setReasoningHighlight(
                      Object.entries(reasoning.labeling ?? {})
                        .filter(([, label]) => label === "in")
                        .map(([id]) => id),
                    )
                  }
                >
                  Highlight in-label
                </button>
              )}
            </div>
            <div className="summary-actions">
              <button
                className="button"
                onClick={() => handleRunReasoning("grounded")}
              >
                Grounded
              </button>
              <button
                className="button"
                onClick={() => handleRunReasoning("preferred")}
              >
                Preferred
              </button>
              <button
                className="button"
                onClick={() => handleRunReasoning("stable")}
              >
                Stable
              </button>
              <button
                className="button"
                onClick={() => handleRunReasoning("complete")}
              >
                Complete
              </button>
              <button
                className="button"
                onClick={() => handleRunReasoning("labelings")}
              >
                Labeling
              </button>
            </div>
            <div className="summary-section">
              <h3>Reasoner Pack</h3>
              <div className="list">
                {[
                  "grounded_extension",
                  "preferred_extensions",
                  "stable_extensions",
                  "complete_extensions",
                  "grounded_labeling",
                  "credibility_propagation",
                  "aba_dispute_trees",
                ].map((task) => (
                  <label key={task} className="list-item checkbox-row">
                    <input
                      type="checkbox"
                      checked={reasonerTasks.includes(task)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setReasonerTasks((prev) => [...prev, task]);
                        } else {
                          setReasonerTasks((prev) =>
                            prev.filter((value) => value !== task),
                          );
                        }
                      }}
                    />
                    <span>{task}</span>
                  </label>
                ))}
              </div>
              <button className="button" onClick={handleRunReasonerPack}>
                Run Pack
              </button>
              {reasonerError && (
                <div className="list-item">Error: {reasonerError}</div>
              )}
              {reasonerResults && (
                <div className="summary-grid">
                  {Object.entries(reasonerResults.results).map(
                    ([key, value]) => renderReasonerResult(key, value),
                  )}
                </div>
              )}
            </div>
            </div>
          </section>
          <section
            className="panel-window panel-theme-5"
            style={getPanelStyle("console")}
          >
            <div className="panel-header">
              <h2>Console</h2>
            </div>
            <div className="panel-body">
              <div className="console">
                {consoleEntries.length ? (
                  consoleEntries.map((entry, index) => (
                    <div className="console-line" key={`${entry.ts}-${index}`}>
                      <span className="console-time">{entry.ts}</span>
                      <span className="console-msg">{entry.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="muted">No activity yet.</div>
                )}
              </div>
            </div>
          </section>
          <div
            className="splitter vertical"
            style={{
              left: leftWidth,
              top: 0,
              width: SPLITTER_SIZE,
              height: topHeight,
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              setResizing({
                kind: "left",
                startX: event.clientX,
                startY: event.clientY,
                leftWidth,
                rightWidth,
                bottomHeight,
                leftTopHeight,
                rightTopHeight,
              })
            }}
          />
          <div
            className="splitter vertical"
            style={{
              left: leftWidth + SPLITTER_SIZE + centerWidth,
              top: 0,
              width: SPLITTER_SIZE,
              height: topHeight,
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              setResizing({
                kind: "right",
                startX: event.clientX,
                startY: event.clientY,
                leftWidth,
                rightWidth,
                bottomHeight,
                leftTopHeight,
                rightTopHeight,
              })
            }}
          />
          <div
            className="splitter horizontal"
            style={{
              left: 0,
              top: topHeight,
              width: layoutSize.width,
              height: SPLITTER_SIZE,
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              setResizing({
                kind: "bottom",
                startX: event.clientX,
                startY: event.clientY,
                leftWidth,
                rightWidth,
                bottomHeight,
                leftTopHeight,
                rightTopHeight,
              })
            }}
          />
          <div
            className="splitter horizontal"
            style={{
              left: 0,
              top: leftTopHeight,
              width: leftWidth,
              height: SPLITTER_SIZE,
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              setResizing({
                kind: "left-vert",
                startX: event.clientX,
                startY: event.clientY,
                leftWidth,
                rightWidth,
                bottomHeight,
                leftTopHeight,
                rightTopHeight,
              })
            }}
          />
          <div
            className="splitter horizontal"
            style={{
              left: leftWidth + SPLITTER_SIZE + centerWidth + SPLITTER_SIZE,
              top: rightTopHeight,
              width: rightWidth,
              height: SPLITTER_SIZE,
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              setResizing({
                kind: "right-vert",
                startX: event.clientX,
                startY: event.clientY,
                leftWidth,
                rightWidth,
                bottomHeight,
                leftTopHeight,
                rightTopHeight,
              })
            }}
          />
        </div>
      </main>
    </div>
  );
}
