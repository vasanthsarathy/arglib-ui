import type {
  EvidenceCardPayload,
  DatasetLoadRequest,
  DatasetLoadResponse,
  GraphPayload,
  GraphResponse,
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
