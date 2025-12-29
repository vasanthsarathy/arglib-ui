import type { GraphPayload, GraphResponse } from "./types";

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
