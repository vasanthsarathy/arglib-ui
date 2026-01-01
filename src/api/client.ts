import type {
  EvidenceCardPayload,
  DatasetLoadRequest,
  DatasetLoadResponse,
  GraphPayload,
  GraphResponse,
  ReasoningRequest,
  ReasoningResponse,
  ReasonerRequest,
  ReasonerResponse,
  LLMClaimConfidenceRequest,
  LLMClaimConfidenceResponse,
  LLMClaimTypeRequest,
  LLMClaimTypeResponse,
  LLMEdgeValidationRequest,
  LLMEdgeValidationResponse,
  EdgeAssumptionsRequest,
  EdgeAssumptionsResponse,
  SupportingDocumentPayload,
} from "./types";

const baseUrl = import.meta.env.VITE_ARGLIB_SERVER_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchHealth(): Promise<{ status: string }> {
  return request("/health");
}

export function createGraph(body: GraphPayload): Promise<GraphResponse> {
  return request("/graphs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getGraph(graphId: string): Promise<GraphResponse> {
  return request(`/graphs/${graphId}`);
}

export function updateGraph(graphId: string, body: GraphPayload): Promise<void> {
  return request(`/graphs/${graphId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function runDiagnostics(graphId: string): Promise<Record<string, unknown>> {
  return request(`/graphs/${graphId}/diagnostics`, { method: "POST" });
}

export function runCredibility(graphId: string): Promise<Record<string, unknown>> {
  return request(`/graphs/${graphId}/credibility`, { method: "POST" });
}

export function runReasoning(
  graphId: string,
  body: ReasoningRequest,
): Promise<ReasoningResponse> {
  return request(`/graphs/${graphId}/reasoning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function runReasoner(
  graphId: string,
  body: ReasonerRequest,
): Promise<ReasonerResponse> {
  return request(`/graphs/${graphId}/reasoner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function scoreClaimConfidence(
  graphId: string,
  unitId: string,
  body: LLMClaimConfidenceRequest,
): Promise<LLMClaimConfidenceResponse> {
  return request(`/graphs/${graphId}/units/${unitId}/llm-confidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function classifyClaimType(
  graphId: string,
  unitId: string,
  body: LLMClaimTypeRequest,
): Promise<LLMClaimTypeResponse> {
  return request(`/graphs/${graphId}/units/${unitId}/claim-type`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function validateEdge(
  graphId: string,
  edgeId: string,
  body: LLMEdgeValidationRequest,
): Promise<LLMEdgeValidationResponse> {
  return request(`/graphs/${graphId}/edges/${edgeId}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function generateEdgeAssumptions(
  graphId: string,
  edgeId: string,
  body: EdgeAssumptionsRequest,
): Promise<EdgeAssumptionsResponse> {
  return request(`/graphs/${graphId}/edges/${edgeId}/assumptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listEvidenceCards(
  graphId: string,
): Promise<Record<string, unknown>> {
  return request(`/graphs/${graphId}/evidence-cards`);
}

export function addEvidenceCard(
  graphId: string,
  body: EvidenceCardPayload,
): Promise<void> {
  return request(`/graphs/${graphId}/evidence-cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function attachEvidenceCard(
  graphId: string,
  unitId: string,
  cardId: string,
): Promise<void> {
  return request(`/graphs/${graphId}/units/${unitId}/evidence-cards/${cardId}`, {
    method: "POST",
  });
}

export function listSupportingDocuments(
  graphId: string,
): Promise<Record<string, unknown>> {
  return request(`/graphs/${graphId}/supporting-documents`);
}

export function addSupportingDocument(
  graphId: string,
  body: SupportingDocumentPayload,
): Promise<void> {
  return request(`/graphs/${graphId}/supporting-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function loadDataset(
  body: DatasetLoadRequest,
): Promise<DatasetLoadResponse> {
  return request("/datasets/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
