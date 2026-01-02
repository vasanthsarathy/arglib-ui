/* Generated via `npm run gen:api` from arglib-server/openapi.yaml. */
export type GraphPayload = {
  payload: Record<string, unknown>;
  validate?: boolean;
};

export type GraphResponse = {
  id: string;
  payload: Record<string, unknown>;
};

export type EvidenceCardPayload = {
  payload: Record<string, unknown>;
};

export type SupportingDocumentPayload = {
  payload: Record<string, unknown>;
};

export type DatasetLoadRequest = {
  path: string;
  limit?: number;
};

export type DatasetLoadResponse = {
  count: number;
  items: Array<Record<string, unknown>>;
};

export type MiningRequest = {
  text: string;
  doc_id?: string | null;
  provider?: "openai" | "anthropic" | "ollama";
  model?: string | null;
  temperature?: number | null;
  use_llm?: boolean;
  long_document?: boolean;
};

export type MiningUrlRequest = {
  url: string;
  doc_id?: string | null;
  provider?: "openai" | "anthropic" | "ollama";
  model?: string | null;
  temperature?: number | null;
  use_llm?: boolean;
  long_document?: boolean;
  include_links?: boolean;
  max_links?: number;
};

export type ReasoningRequest = {
  semantics: "grounded" | "preferred" | "stable" | "complete" | "labelings";
};

export type ReasoningResponse = {
  semantics: string;
  arguments: Array<string>;
  extensions?: Array<Array<string>> | null;
  labeling?: Record<string, string> | null;
};

export type ReasonerRequest = {
  tasks: Array<string>;
  explain?: boolean;
};

export type ReasonerResponse = {
  results: Record<string, unknown>;
};

export type LLMClaimConfidenceRequest = {
  provider: "openai" | "anthropic" | "ollama";
  model?: string | null;
  temperature?: number | null;
};

export type LLMClaimConfidenceResponse = {
  score: number;
  weighted_score?: number | null;
  rationale: string;
  provider: string;
  model: string;
  score_source?: string | null;
};

export type LLMClaimTypeRequest = {
  provider: "openai" | "anthropic" | "ollama";
  model?: string | null;
  temperature?: number | null;
};

export type LLMClaimTypeResponse = {
  claim_type: string;
  confidence?: number | null;
  rationale?: string | null;
  provider: string;
  model: string;
};

export type LLMEdgeValidationRequest = {
  provider: "openai" | "anthropic" | "ollama";
  model?: string | null;
  temperature?: number | null;
};

export type LLMEdgeValidationResponse = {
  evaluation: string;
  score: number;
  rationale?: string | null;
  provider: string;
  model: string;
};

export type EdgeAssumptionsRequest = {
  provider: "openai" | "anthropic" | "ollama";
  model?: string | null;
  temperature?: number | null;
  k?: number;
};

export type EdgeAssumptionItem = {
  assumption: string;
  rationale?: string | null;
  importance?: number | null;
};

export type EdgeAssumptionsResponse = {
  edge_id: string;
  assumptions: Array<EdgeAssumptionItem>;
};
